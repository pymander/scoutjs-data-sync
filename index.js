var Hapi = require('hapi');

var server = new Hapi.Server();
server.connection({ 
  host: '0.0.0.0', 
  port: ~~process.env.PORT || 3000 
});

server.route({
  method: 'GET',
  path:'/', 
  handler: function (request, reply) {
    reply('hello world');
  }
});

server.start(function() {
  console.log('Server running at:', server.info.uri);
});



// keep in sync with NPM from their couchDB
var npm = require('./lib/npm.js');
npm.start();


// keep in sync with the data from Github and NPM downloads
var data = require('./lib/data.js');
data.start();