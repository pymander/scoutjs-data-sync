var CONCURRENT_DOWNLOADS = 1;

var _ = require('lodash');
var orchestrate = require('orchestrate');
var moment = require('moment');
var Q = require('q');

var creds = require('./credentials.js');
var github = require('./github.js');
var db = orchestrate(creds.api_key, creds.data_center);


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
    data.rank = calculateRank(data);
    console.log('rank', data.rank);
    return db.put('packages', id, data);
  })

  .fail(function (err) {
    console.log('error with denorm');
    console.log(_.get(err, 'body') || err);
  });
  
};

function calculateRank (data) {
  var downloads = _.get(data, 'downloads.daily_total');
  var stars = _.get(data, 'github.stargazers_count');
  var forks = _.get(data, 'github.forks_count');
  var updated = moment(_.get(data, 'github.updated_at'));

  return (downloads/1000000) + (stars/1000) + (forks/100);
};




module.exports = {
  update: update,
};