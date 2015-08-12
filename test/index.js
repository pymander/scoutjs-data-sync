var NpmSync = require('../lib-cov');

describe('npm-orchestrate', function () {
  beforeEach(function () {
    this.syncer = NpmSync();
  });

  it('should not break', function (done) {
    var self = this;
    var wait = 8000;
    this.timeout(wait);
    
    setTimeout(function () {
      self.syncer.quit();
      done();
    }, wait * 0.666);
  });
});
