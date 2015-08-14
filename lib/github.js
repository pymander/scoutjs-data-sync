var CONCURRENT_DOWNLOADS = 1;

var github = require('octonode');
var Q = require('q');
var _ = require('lodash');
var GitUrlParse = require('git-url-parse');
var orchestrate = require('orchestrate');

var creds = require('./credentials.js');
var checkpoint = require('./checkpoint.js')('github');

var db = orchestrate(creds.api_key, creds.data_center);


function update (repo) {
  if (!repo) return Q({});

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
        var resetTime = (_.get(err, 'headers.x-ratelimit-reset') * 1000);
        var delay = resetTime - Date.now();

        return deferred.reject({
          type: 'API-limit',
          delay: delay,
          resetTime: resetTime,
        });
      };

      return deferred.reject({
        error: err,
      });
    };

    deferred.resolve(data);
  });

  return deferred.promise;
};


function getRepoName (path) {
  if (!path || !_.includes(path, 'github')) return null;

  var match = GitUrlParse(path);
  if (!match || !match.name) return null;

  return match.owner + '/' + match.name;
};



module.exports = {
  update: update,
  getRepoName: getRepoName,
};