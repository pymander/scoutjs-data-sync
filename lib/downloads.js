var CONCURRENT_DOWNLOADS = 1;

var creds = require('./credentials.js');
var checkpoint = require('./checkpoint.js')('downloads');

var orchestrate = require('orchestrate');
var db = orchestrate(creds.api_key, creds.data_center);

var moment = require('moment');
var Q = require('q');
var request = require('request');
var _ = require('lodash');


function update (package) {
  var data;

  return Q.all([
    getDownloadsForLastFullMonth(package),
    getDownloadsForDate(package, moment().subtract(1,'months')),
  ])
  .then(function(results){
    var dailyResults = results[0];
    var monthlyResults = results[1];

    // build a new object to be merged into the database
    data = {
      'date_scraped': Date.now(),
      'daily': dailyResults.dates,
      'daily_total': dailyResults.downloads || 0,
    };

    // save the monthly download count as a unique field. this way it keeps it over time. 
    // but overwrites any existing month incase the data changed.
    // stores data in `month_YEAR_MONTH` format.
    data['month_' + monthlyResults.date.year + '_' + monthlyResults.date.month] = monthlyResults.downloads;

    return db.merge('downloads', package, data, {'upsert':true});
  })
  .then(function(){
    return data;
  })
  .fail(function (err) {
    console.log('err', err);
  });
};



function getDownloadsForLastFullMonth (package) {
  var deferred = Q.defer();

  var url = 'https://api.npmjs.org/downloads/range/last-month/' + package;

  request.get(url, function (error, response, body){
    if (error) {
      deferred.reject(new Error(error));
    } else {
      var data = JSON.parse(body);

      var downloads = 0;
      var dates = _.map(_.get(data, 'downloads'), function(item){
        downloads += item.downloads;

        return {
          'date': new Date(item.day).getTime(),
          'count': item.downloads,
        };
      });

      deferred.resolve({
        downloads: downloads,
        dates: dates,
      });
    }
  });

  return deferred.promise;
};



function getDownloadsForDate (package, date) {
  var deferred = Q.defer();

  var startOfMonth = moment(date).startOf('month').format('YYYY-MM-DD');
  var endOfMonth = moment(date).endOf('month').format('YYYY-MM-DD');

  var url = 'https://api.npmjs.org/downloads/point/' + startOfMonth + ':' + endOfMonth + '/' + package;

  request.get(url, function (error, response, body){
    if (error) {
      deferred.reject(new Error(error));
    } else {
      var data = JSON.parse(body);
      deferred.resolve({
        downloads: _.get(data, 'downloads'),
        date: {
          year: moment(date).startOf('month').format('YYYY'),
          month: moment(date).startOf('month').format('MM'),
        },
      });
    }
  });

  return deferred.promise;
};



module.exports = {
  update: update,
  getLastMonth: getDownloadsForLastFullMonth,
  getDate: getDownloadsForDate,
};