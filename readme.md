# NPM Orchestrate [![Build Status](https://travis-ci.org/orchestrate-io/npm-orchestrate.svg?branch=master)](https://travis-ci.org/orchestrate-io/npm-orchestrate) [![Coverage Status](https://coveralls.io/repos/orchestrate-io/npm-orchestrate/badge.png)](https://coveralls.io/r/orchestrate-io/npm-orchestrate)

Replicate NPM's registry metadata into an Orchestrate collection.

## Install

You'll need [node.js](http://nodejs.org/) installed to get npm-orchestrate. Then:

    npm install -g npm-orchestrate

If your system says you don't have permission to install packages globally, try this:

    sudo npm install -g npm-orchestrate

## Usage

To sync into an Orchestrate collection, you'll need an [account](https://dashboard.orchestrate.io/), which you can use to create applications and get API keys. Once you've got one, run this:

    export ORCHESTRATE_API_KEY=YOUR_API_KEY
    npm-orchestrate

You're now syncing with Orchestrate!

## Deploy to Heroku

Don't want to wait around while NPM syncs? Deploy to Heroku!

You'll need a [Heroku account](https://www.heroku.com/), and the [Heroku toolbelt](https://toolbelt.heroku.com/) for this. Once you've got both, do this:

    git clone git@github.com:orchestrate-io/npm-orchestrate.git
    cd npm-orchestrate
    heroku create
    heroku config:set ORCHESTRATE_API_KEY=YOUR_API_KEY
    git push heroku master

You did it!

## Tests

The tests require a valid API key to run. To set it, do this:

    export ORCHESTRATE_API_KEY=YOUR_API_KEY

Then, run the tests:

    npm test

## License

[ASLv2][license], yo.

[license]: http://www.apache.org/licenses/LICENSE-2.0