var CONCURRENT_DOWNLOADS = 1;

var creds = require('./credentials.js');
var denorm = require('./denorm.js');
var checkpoint = require('./checkpoint.js')('npm');

var orchestrate = require('orchestrate');
var db = orchestrate(creds.api_key, creds.data_center);

var _ = require('lodash');
var normalize = require('npm-normalize');
var follow = require('follow');
var async = require('async');

var feed;
var queue = getQueue();



function getFeed (seq) {
  return new follow.Feed({
    db: creds.npm_url,
    include_docs: true,
    since: seq || 0
  });
};



function getQueue () {
  return async.queue(function (change, done) {
    var ref;

    update(change.doc)
    .fail(function (err) {
      done(err);
      quit();
    })
    .then(function (res) {
      ref = res.headers.etag.slice(1, -1);
    })
    .then(function () {
      return checkpoint.update(change.seq);
    })
    .fail(function (err) {
      console.error(err.statusCode, change.id, err.body.message);
      checkpoint.rollback(err, change.id, ref);
      quit();
      done(err);
    })
    .then(function () {
      console.log('NPM:', change.id);
      done();
    });
  }, CONCURRENT_DOWNLOADS);
};



function quit () {
  feed.stop();
  queue.pause();
};



function start () {
  checkpoint.get()
  .then(function (seq) {
    console.log('NPM starting at:', seq);
    feed = getFeed(seq);
  })
  .then(function () {
    feed.on('change', function (change) {
      feed.pause();
      queue.push(change, function (err) {
        if (!err) feed.resume();
      });
    });
  })
  .then(function () {
    feed.follow();
  })
  .fail(function (err) {
    console.log(err.body);
  });
};



function update (doc) {
  var ref;
  var id = doc._id;

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
  data['date_scraped'] = Date.now();

  return db.put('npm', id, data)
  .fail(function (err) {
    console.log('error with update', err);
  });
};



function normalizeTime (doc) {
  ['times', 'time'].forEach(function (time) {
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