var port = parseInt(process.env.PORT) || 3000;

var connect = require('connect');
var express = require('express');

var app = express.createServer(
  // connect.logger(),
  connect.bodyDecoder(),
  connect.methodOverride(),
  connect.cookieDecoder(),
  connect.session(),
  connect.staticProvider(__dirname + '/public')
);

app.set('view engine', 'jade');

app.get('/', function(req, res){
  res.render('index');
});

app.listen(port);
