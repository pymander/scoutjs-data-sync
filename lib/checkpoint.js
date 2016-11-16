var creds = require('./credentials');
var Q = require('q');

var mongodbUrl = 'mongodb://' + creds.mongodbHost + ':27017/scout';
var MongoClient = require('mongodb').MongoClient

module.exports = function (checkpointName) {
  var lastCheckpoint = null;

  // Retrieves the checkpoint sequence associated with "checkpointName"
  var get = function () {
    // get the last checkpoint out of memory if it exists
    if (lastCheckpoint) {
      return Q(lastCheckpoint);
    };

    var deferred = Q.defer();

    MongoClient.connect(mongodbUrl, function (err, db) {
      var collection = db.collection('checkpoints');

      collection.findOne(
        { "checkpoint" : checkpointName },
        { "sort" : { "seq" : -1 } },
        function (err, record) {
          if (null == record || null != err) {
            deferred.resolve(0);
          }
          else {
            deferred.resolve(record["seq"]);
          };

          db.close();
        });
    });

    return deferred.promise;
  };

  var update = function (seq) {
    var deferred = Q.defer();

    if (!seq) {
      seq = 0;
    }
    
    lastCheckpoint = seq;

    MongoClient.connect(mongodbUrl, function (err, db) {
      var collection = db.collection('checkpoints');
      var newRecord = {
        "checkpoint" : checkpointName,
        "seq" : seq
      };
      
      collection.insert(
        newRecord,
        function (err, record) {
          deferred.resolve(seq);

          db.close();
        });
    });

    return deferred.promise;
  };

  // This function is only used in one place and it's unclear what it's supposed to do. I'm just guessing.
  var rollback = function (err, id, ref) {
    MongoClient.connect(mongodbUrl, function (err, db) {
      var collection = db.collection('checkpoints');

      collection.findOneAndDelete(
        { "checkpoint" : checkpointName,
          "seq" : ref },
        null,
        function (err, record) {
          deferred.resolve(ref);

          db.close();
        });
    });

    return deferred.promise;
  };

  return {
    get: get,
    update: update,
    rollback: rollback
  };
};
