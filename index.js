// keep in sync with NPM from their couchDB
var npm = require('./lib/npm.js');
npm.start();


// keep in sync with the data from Github and NPM downloads
var data = require('./lib/data.js');
data.start();