var chai = require('chai');
var should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

var nock = require('nock');

var Downloads = require('../lib/downloads.js');

describe('Get downloads from NPM', function () {

  it('should get the last month', function () {
    nock('https://api.npmjs.org')
    .get('/downloads/range/last-month/react-native')
    .replyWithFile(200, __dirname + '/react-native.txt');

    return Downloads.getLastMonth('react-native')
    .should.eventually.have.property('downloads', 550400);
  });

  it('should get the downloads for a date', function () {
    nock('https://api.npmjs.org')
    .get('/downloads/point/2015-01-01:2015-01-31/jquery')
    .replyWithFile(200, __dirname + '/jquery.txt');

    return Downloads.getDate('jquery', '2015-01-05')
    .should.eventually.deep.equals({
      'downloads': 206712,
      'date': {
        'year': '2015',
        'month': '01',
      },
    });
  });
});

