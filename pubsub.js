var faye = require('faye');
exports.bayeux = new faye.NodeAdapter({
  mount:    '/events',
  timeout:  45
});
