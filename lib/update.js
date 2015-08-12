var creds = require('./credentials');
var orchestrate = require('orchestrate');
var db = orchestrate(creds.api_key, creds.data_center);
var normalize = require('npm-normalize');
var collections = {
  registry: creds.collection,
  checkpoints: 'checkpoints'
};

function update (doc) {
  var ref;
  var id = doc._id;
  var normalized = [
    normalize,
    normalize_time,
    normalize_scripts
  ].reduce(function (doc, func) {
    if (doc) {
      return func(doc); 
    } else {
      return doc;
    }
  }, doc);

  return db.put(collections.registry, id, normalized || {});
}

function normalize_time (doc) {
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
}

function normalize_scripts (doc) {
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
}

module.exports = update;