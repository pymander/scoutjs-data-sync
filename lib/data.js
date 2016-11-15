var CONCURRENT_DOWNLOADS = 1;

var async = require('async');
var _ = require('lodash');
var Q = require('q');

var creds = require('./credentials.js');
var downloads = require('./downloads.js');
var github = require('./github.js');
var denorm = require('./denorm.js');
var creds = require('./credentials.js');
var checkpoint = require('./checkpoint.js')('data');

var mongodbUrl = 'mongodb://' + creds.mongodbHost + ':27017/scout';
var MongoClient = require('mongodb').MongoClient

var queue = async.queue(queueWorker, CONCURRENT_DOWNLOADS);

queue.drain = function() {
  start();
};


function start () {
  checkpoint.get()
    .then(function (key) {
      console.log('DATA starting after:', key);
      return db.list('npm', { limit: 30, afterKey: key });
    })
    .then(function (result) {

      // do we need to restart the crawl?
      if (!result.body.count) {
        return checkpoint.update(null);
      };

      var items = result.body.results;

      _.each(items, function (item) {
        var repo = github.getRepoName(item.value.repository);

        queue.push({ 
          id: item.path.key,
          repo: repo,
        });
      });
    })
    .fail(function (err) {
      console.log('downloads start failed', err);
    });
};

function queueWorker (task, done) {
  Q.all([
    github.update(task.repo),
    downloads.update(task.id),
  ])
  .fail(function (err) {
    console.log('queue failed', err);
    // if github failed bacause we're over our limit, pause the queue
    if (_.get(err, 'type') === 'API-limit') {
      queue.pause();
      console.log('--- OVER GITHUB LIMIT ---',  _.get(err, 'delay') / 1000);
      setTimeout(function(){
        queue.resume();
      }, _.get(err, 'delay') || 1000);
    };

    done(err);
  })

  // denorm the data
  .then(function () {
    return denorm.update(task.id);
  })

  // update the checkpoint
  .then(function () {
    return checkpoint.update(task.id);
  })

  // we're done
  .then(function () {
    console.log('DATA:', task.id);
    done();
  })
  .fail(function (err) {
    done(err);
  });
};


module.exports = {
  start: start,
};
