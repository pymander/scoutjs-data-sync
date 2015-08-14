var CONCURRENT_DOWNLOADS = 1;

var orchestrate = require('orchestrate');
var async = require('async');
var _ = require('lodash');

var creds = require('./credentials.js');
var downloads = require('./downloads.js');
var github = require('./github.js');
var denorm = require('./denorm.js');
var creds = require('./credentials.js');
var checkpoint = require('./checkpoint.js')('data');

var db = orchestrate(creds.api_key, creds.data_center);

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
      queue.push({ restart: true });
      return;
    };

    var items = result.body.results;

    _.each(items, function (item) {
      var repo = github.getRepoName(_.get(item, 'value.repository'));

      var task = { 
        id: _.get(item, 'path.key'),
        repo: repo,
      };

      queue.push(task);
    });
  })
  .fail(function (err) {
    console.log('downloads start failed', err);
  });
};

function queueWorker (task, done) {


  // restart the crawl if we finished the listing
  if (task.restart) {
    checkpoint.update(null)
    .then(function () {
      done();
    });

    return;
  };

  // update github
  github.update(task.repo)

  // update the download count from NPM
  .then(function () {
    return downloads.update(task.id);
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