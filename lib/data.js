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
      var deferred = Q.defer();
      
      console.log('DATA starting after:', key);

      MongoClient.connect(mongodbUrl, function (err, db) {
        var collection = db.collection('npm');

        collection.find({ "seq" : { "$gte" : key } })
          .toArray(function (error, docs) {
            deferred.resolve(docs.slice(0, 30));

            db.close();
          });
      });

      return deferred.promise;
    })
    .then(function (items) {

      // do we need to restart the crawl?
      if (0 == items.length) {
        console.log("DATA restarting crawl");
        return checkpoint.update(null);
      };

      _.each(items, function (item) {
        var repo = github.getRepoName(item.repository);

        queue.push({ 
          id: item.id,
          repo: repo,
          seq: item.seq
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
    return checkpoint.update(task.seq);
  })

  // we're done
  .then(function () {
    console.log('DATA:', task.id, task.seq);
    done();
  })
  .fail(function (err) {
    done(err);
  });
};


module.exports = {
  start: start,
};
