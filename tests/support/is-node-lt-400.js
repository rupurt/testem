'use strict';

module.exports = function() {
  var nodeVer = process.version.substr(1).split('.').map(function(num) {
    return parseInt(num, 10);
  });
  return (nodeVer[0] < 4);
};
