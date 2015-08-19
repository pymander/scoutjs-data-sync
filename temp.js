var Q = require('q');
var _ = require('lodash');
var github = require('./lib/github.js');
var downloads = require('./lib/downloads.js');
var denorm = require('./lib/denorm.js');

var all = [];
var results = [];

var ITEMS = [
	{id: 'bluebird',     repo: 'petkaantonov/bluebird'},
	{id: 'gulp',         repo: 'gulpjs/gulp'},
	{id: 'async',        repo: 'caolan/async'},
	{id: 'react-native', repo: 'facebook/react-native'},
	{id: 'react',        repo: 'facebook/react'},
	{id: 'orchestrate',  repo: 'orchestrate-io/orchestrate.js'},
	{id: 'lodash',       repo: 'lodash/lodash'},
	{id: 'jquery',       repo: 'jquery/jquery'},
	{id: 'hapi',         repo: 'hapijs/hapi'},
	{id: 'express',      repo: 'strongloop/express'},
	{id: 'cordova'},
	{id: 'browserify',   repo: 'substack/node-browserify'},
	{id: 'grunt-cli',    repo: 'gruntjs/grunt-cli'},
	{id: 'bower',        repo: 'bower/bower'},
];

function getData (item) {
	return github.update(item.repo)
	.then(function(){
		return downloads.update(item.id);
	})
	.then(function(){
		return denorm.update(item.id);
	})
	.then(function(data){
		results.push(data);
	});
};

all = ITEMS.map(getData);

Q.all(all).then(function(){
	var sorted = _.sortBy(results, 'npf_rank');
	_.each(sorted.reverse(), function(item){
		console.log(item.id, item.npf_rank);
	})
})