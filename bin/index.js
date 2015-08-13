#!/usr/bin/env node

var assert = require('assert');

assert(process.env.ORCHESTRATE_API_KEY, "Must provide ORCHESTRATE_API_KEY as environment variable.");

require('../');