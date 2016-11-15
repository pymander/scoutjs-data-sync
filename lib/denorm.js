var CONCURRENT_DOWNLOADS = 1;

var _ = require('lodash');
var moment = require('moment');
var Q = require('q');

var creds = require('./credentials.js');
var github = require('./github.js');

var mongodbUrl = 'mongodb://' + creds.mongodbHost + ':27017/scout';
var MongoClient = require('mongodb').MongoClient

var MS_PER_DAY = 86400000;

var WEIGHTS = {
  DOWNLOADS: 1,
  STARS: 0.8,
  FORKS: 0.4,
  UPDATES: 0.2,
};

var MAX = {
  DOWNLOADS: 2000000,
  STARS: 10000,
  FORKS: 10000,
};

function getAllFromSource (sourceName, id) {
  var deferred = Q.defer();
  
  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection(sourceName);

    collection.find({"id" : id}).toArray(function (err, docs) {
      deferred.resolve(docs);

      db.close();
    });
  });

  return deferred.promise;
};


function update (id) {
  var data = {};

  // get the NPM & Downloads data
  return Q.all([
    getFromSource('npm', id),
    getFromSource('downloads', id)
  ])
  .then(function (res) {
    data = _.get(res, '[0].body') || {};
    data.downloads = cleanDownloadData(_.get(res, '[1].body'));
    data.date_denormed = Date.now();
  })
  // get the Github data
  .then(function () {
    var repo = github.getRepoName(_.get(data, 'repository'));
    if (!repo) return Q();

    return db.get('github', repo).fail(function(){ return {} });
  })
  .then(function (res) {
    data.github = _.get(res, 'body') || null;
  })


  // build the denormed data to store
  .then(function () {
    var deferred = Q.defer();
    data.npf_rank = calculateRank(data);
    // console.log(data.id, data.npf_rank);

    // store the updated and created dates in a name/format Orchestrate will parse
    data.created_date = data.created;
    data.modified_date = data.modified;
    data.id = id;
    delete data.created;
    delete data.modified;

    MongoClient.connect(mongodbUrl, function (err, db) {
      var collection = db.collection('packages');

      collection.insert(data, function (err, rec) {
        deferred.resolve(err);
        
        db.close();
      });
    });

    return deferred.promise();
  })

  .then(function () {
    return data;
  })

  .fail(function (err) {
    console.log('error with denorm', id, _.get(err, 'body.message') );
  });
  
};

function calculateRank (data) {
  var downloads = _.get(data, 'downloads.daily_total') || 0;
  var stars = _.get(data, 'github.stargazers_count') || 0;
  var forks = _.get(data, 'github.forks_count') || 0;
  var daysSinceUpdate = (new Date() - new Date(_.get(data, 'modified'))) / MS_PER_DAY;
  var updatedWeight = (daysSinceUpdate < 180) ? 1 : 0;

  // handle packages that link to other repos
  // like this: https://www.npmjs.com/package/node-core-lib
  if ((downloads / stars) < 0.3) {
    stars = 0;
    forks = 0;
  };

  return (
    ((downloads/MAX.DOWNLOADS) * WEIGHTS.DOWNLOADS) + 
    ((stars/MAX.STARS) * WEIGHTS.STARS) + 
    ((forks/MAX.FORKS) * WEIGHTS.FORKS) + 
    ((updatedWeight) * WEIGHTS.UPDATES) 
  );
};


function cleanDownloadData (data) {
  var monthly = [];

  _.each(data, function(value, key){
    if (!_.includes(key, 'month')) return;

    var nameParts = key.split('_');
    var month = parseInt(nameParts[2], 10) || 0;
    var year = parseInt(nameParts[1], 10) || 0;

    monthly.push({
      month: month,
      year: year,
      date: moment().month(month).year(year).day(1).valueOf(),
      count: value,
    })
  });

  return {
    monthly: _.sortBy(monthly, 'date'),
    daily: data.daily,
    daily_total: data.daily_total,
  };
}




module.exports = {
  update: update,
};
