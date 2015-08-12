var follow = require('follow');
var async = require('async');

var checkpoint = require('./checkpoint');
var update = require('./update');
var creds = require('./credentials');

var feed;
var queue = get_queue();

function get_feed (seq) {
  return new follow.Feed({
    db: creds.npm_url,
    include_docs: true,
    since: seq || 0
  });
}

function get_queue () {
  return async.queue(function (change, done) {
    var ref;

    console.log('change', change);

    update(change.doc)
    .fail(function (err) {
      console.error(err.statusCode, change.id, err.body.message);
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
    .then(function (res) {
      console.log(res.statusCode, change.id);
      done();
    });
  }, 1);
}

function quit () {
  feed.stop();
  queue.pause();
}

function start () {
  checkpoint.get()
  .then(function (seq) {
    console.log(seq);
    feed = get_feed(seq);
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
}

module.exports = function () {
  start();
  return {
    quit: quit
  };
};