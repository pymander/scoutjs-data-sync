var creds = require('./credentials');
var orchestrate = require('orchestrate');
var Q = require('q');
var db = orchestrate(creds.api_key, creds.data_center);


module.exports = function (collection) {
  var lastCheckpoint = null;

  var get = function () {
    // get the last checkpoint out of memory if it exists
    if (lastCheckpoint) {
      return Q(lastCheckpoint);
    };

    return db.get('checkpoints', collection)
    .then(function (res) {
      return res.body.seq;
    })
    .fail(function (err) {
      if (err.statusCode === 404) {
        return 0;
      } else {
        return err;
      }
    });
  };

  var update = function (seq) {
    lastCheckpoint = seq;
    return db.put('checkpoints', collection, {
      seq: seq
    });
  };

  var rollback = function (err, id, ref) {
    return db.remove(collection, id, ref);
  };

  return {
    get: get,
    update: update,
    rollback: rollback
  };
};