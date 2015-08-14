var CONCURRENT_DOWNLOADS = 1;

var _ = require('lodash');
var orchestrate = require('orchestrate');
var moment = require('moment');
var Q = require('q');

var creds = require('./credentials.js');
var github = require('./github.js');
var db = orchestrate(creds.api_key, creds.data_center);

var MS_PER_DAY = 86400000;

var WEIGHTS = {
  DOWNLOADS: 1,
  STARS: 1,
  FORKS: 0.4,
  UPDATES: 0.2,
};

var MAX = {
  DOWNLOADS: 2000000,
  STARS: 10000,
  FORKS: 10000,
};


function update (id) {
  var data = {};


  // get the NPM & Downloads data
  return Q.all([
    db.get('npm', id),
    db.get('downloads', id),
  ])
  .then(function (res) {
    data = _.get(res, '[0].body') || {};
    data.downloads = _.get(res, '[1].body');
    data.date_denormed = Date.now();
  })


  // get the Github data
  .then(function () {
    var repo = github.getRepoName(_.get(data, 'repository'));
    if (!repo) return Q();

    return db.get('github', repo);
  })
  .then(function (res) {
    data.github = _.get(res, 'body') || null;
  })


  // build the denormed data to store
  .then(function () {
    data.npf_rank = calculateRank(data);

    // store the updated and created dates in a name/format Orchestrate will parse
    data.created_date = data.created;
    data.modified_date = data.modified;
    delete data.created;
    delete data.modified;

    console.log(data.id, data.npf_rank);

    // console.log('rank', data.rank);
    return db.put('packages', id, data);
  })

  .fail(function (err) {
    console.log('error with denorm', _.get(err, 'body.message') );
  });
  
};

function calculateRank (data) {
  var downloads = _.get(data, 'downloads.daily_total') || 0;
  var stars = _.get(data, 'github.stargazers_count') || 0;
  var forks = _.get(data, 'github.forks_count') || 0;
  var daysSinceUpdate = (new Date() - new Date(_.get(data, 'modified'))) / MS_PER_DAY;
  var updatedWeight = (daysSinceUpdate < 180) ? 1 : 0;

  return (
    ((downloads/MAX.DOWNLOADS) * WEIGHTS.DOWNLOADS) + 
    ((stars/MAX.STARS) * WEIGHTS.STARS) + 
    ((forks/MAX.FORKS) * WEIGHTS.FORKS) + 
    ((updatedWeight) * WEIGHTS.UPDATES) 
  );
};




module.exports = {
  update: update,
};