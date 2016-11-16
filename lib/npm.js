var CONCURRENT_DOWNLOADS = 10;

var creds = require('./credentials.js');
var denorm = require('./denorm.js');
var checkpoint = require('./checkpoint.js')('npm');

var mongodbUrl = 'mongodb://' + creds.mongodbHost + ':27017/scout';
var MongoClient = require('mongodb').MongoClient

var _ = require('lodash');
var normalize = require('npm-normalize');
var follow = require('follow');
var async = require('async');
var Q = require('q');

var feed;
var queue = async.queue(queueWorker, CONCURRENT_DOWNLOADS);

queue.drain = function () {
  feed.resume();
};

queue.saturated = function () {
  feed.pause();
};


function getFeed (seq) {
  feed = new follow.Feed({
    db: creds.npm_url,
    include_docs: true,
    since: seq || 0
  });

  feed.on('change', function (change) {
    queue.push(change);
  });

  feed.on('error', function(er) {
    console.error('Since Follow always retries on errors, this must be serious', er);
    throw er;
  });

  feed.follow();
};


function queueWorker (change, done) {
  var ref;

  update(change.doc, change.seq)
    .fail(function (err) {
      done(err);
      quit();
    })
    .then(function (res) {
      //ref = res.headers.etag.slice(1, -1);
      ref = change.seq;
    })
    .then(function () {
      return checkpoint.update(change.seq);
    })
    .fail(function (err) {
      console.error('error', change.id, _.get(err, 'statusCode'), _.get(err, 'body.message'));
      checkpoint.rollback(err, change.id, ref);
      quit();
      done(err);
    })
    .then(function () {
      console.log('NPM:', change.id);
      done();
    });
};



function quit () {
  console.log('quit -------------');
  feed.stop();
  queue.pause();
};



function start () {
  checkpoint.get()
    .then(function (seq) {
      console.log('NPM starting at:', seq);
      getFeed(seq);
    })
    .fail(function (err) {
      console.log(_.get(err, 'body') || err);
    });
};



function update (doc, seq) {
  var deferred = Q.defer();
  var ref;
  var normalized = [
    normalize,
    normalizeTime,
    normalizeScripts
  ].reduce(function (doc, func) {
    if (doc) {
      return func(doc); 
    } else {
      return doc;
    }
  }, doc);

  var data = normalized || {};
  data['id'] = doc._id;
  data['date_scraped'] = Date.now();
  data['seq'] = seq;

  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection('npm');

    collection.insert(data, function (err, rec) {
      deferred.resolve(err);
      
      db.close();
    });
  });

  return deferred.promise;
};



function normalizeTime (doc) {
  var names = ['times', 'time'];
  names.forEach(function (time) {
    if (doc[time]) {
      var times = [];
      Object.keys(doc[time]).forEach(function (field) {
        times.push({
          version: field,
          date: doc[time][field]
        });
      });
      doc[time] = times;
    }
  });

  return doc;
};



function normalizeScripts (doc) {
  if (doc.scripts) {
    var scripts = [];
    
    Object.keys(doc.scripts).forEach(function (field) {
      var command = doc.scripts[field];
      
      // handle fickle script objects
      if (typeof command === 'object') {
        command = JSON.stringify(command);
      }

      scripts.push({
        script: field,
        command: command
      });
    });

    doc.scripts = scripts;
  }

  return doc;
};




module.exports = {
  start: start,
  quit: quit,
};
