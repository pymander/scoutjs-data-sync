var CONCURRENT_DOWNLOADS = 10;

var creds = require('./credentials.js');
var checkpoint = require('./checkpoint.js')('github');

var orchestrate = require('orchestrate');
var db = orchestrate(creds.api_key, creds.data_center);

var github = require('octonode');
var async = require('async');
var Q = require('q');
var _ = require('lodash');
var GitUrlParse = require('git-url-parse');



var queue = async.queue(queueWorker, CONCURRENT_DOWNLOADS);
queue.drain = function() {
  start();
};



function start () {
  checkpoint.get()
  .then(function (key) {
    console.log('GITHUB starting after:', key);
    return db.list('npm', { limit: 30, afterKey: key });
  })
  .then(function (result) {
    var items = result.body.results;

    _.each(items, function (item) {
      var repoUrl = _.get(item, 'value.repository');
      if (!repoUrl) return;

      var match = GitUrlParse(repoUrl);
      if (!match || !match.name) return;

      var task = {
        id: _.get(item, 'path.key'),
        username: match.owner,
        repo: match.name,
      };

      queue.push(task);
    });
  })
  .fail(function (err) {
    console.log('github start failed', err);
  });
};



function queueWorker (task, done) {
  var ref;

  update(task.username + '/' + task.repo)
  .then(function (res) {
    if (!res) return;

    ref = _.get(res, 'headers.etag').slice(1, -1);
  })
  .then(function () {
    return checkpoint.update(task.id);
  })
  .then(function () {
    console.log('GITHUB:', task.id);
    done();
  })
  .fail(function (err) {
    // console.error(err);
    console.log('GITHUB FAILED:', task.id);
    checkpoint.rollback(err, task.id, ref);
    done(err);
  })
};



function update (repo) {
  return getRepo(repo)
  .then(function (data){
    if (!data) return null;

    // add the date_scraped
    data['date_scraped'] = Date.now();

    // save to database
    return db.put('github', repo, data);
  });
};



function getRepo (repo) {
  var deferred = Q.defer();

  // get the repo
  var client = github.client(creds.github);
  var ghrepo = client.repo(repo);
  ghrepo.info(function(err, data) {
    if (err) {

      // the repo doesn't exist anymore, skip it
      if (err.statusCode === 404) {
        console.log(repo, 'not found');
        deferred.resolve(null);
      };
      
      // we are over our rate limit
      if (err.statusCode === 403) {
        var resetTime = _.get(err, 'headers.x-ratelimit-reset');
        var delay = (resetTime * 1000) - Date.now();
        console.log('over github ratelimit, delaying', Math.round(delay/60/1000), 'minutes');
        setTimeout(deferred.reject, delay);
        return;
      };

      return deferred.reject(err);
    };

    deferred.resolve(data);
  });

  return deferred.promise;
};



module.exports = {
  update: update,
  start: start,
};