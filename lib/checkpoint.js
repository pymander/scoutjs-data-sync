var creds = require('./credentials');
var orchestrate = require('orchestrate');
var db = orchestrate(creds.api_key, creds.data_center);
var collections = {
  registry: creds.collection,
  checkpoints: 'checkpoints'
};

function get () {
  return db.get(collections.checkpoints, 'seq')
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
}

function update (seq) {
  return db.put(collections.checkpoints, 'seq', {
    seq: seq
  });
}

function rollback (err, id, ref) {
  return db.remove(collections.registry, id, ref);
}

module.exports = {
  get: get,
  update: update,
  rollback: rollback
};