var http = require('http');
var querystring = require('querystring');

var models = require('./models');
var MxtpsEvent = models.MxtpsEvent;

exports.checkUrlStatus = function(url, cb) {
  return cb(200);
  var u = URL.parse(url);
  var client = http.createClient(u.port || 80, u.hostname);
  var request = client.request('HEAD', u.pathname+u.search, {'Host':u.hostname});
  request.end();
  request.on('response', function (response){
    console.info(JSON.stringify(response.headers));
    if (response.headers.location) {
      console.info("redirected!  checking " + response.headers.location);
      // TODO: response.headers.location string == url+"undefined" ?? assume 200 for now
      // TODO: enforce redirect limit
      // checkUrlStatus(response.headers.location, cb);
      cb(200);
    } else {
      cb(response.statusCode);
    }
  });
};

exports.forThisContribution = function(mixtape, contribution){
  var host = 'musicmp3.ru';
  var url = '/search.html?';
  url += querystring.stringify({text: contribution.title + " " + contribution.artist})
  var server = http.createClient(80, host);
  console.log(url);
  var request = server.request('GET', url, { Host: host,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Keep-Alive': '115',
      'Connection': 'keep-alive',
      'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
      'Accept-Language': 'en-us,en;q=0.5',
      });
  request.end();
  request.on('response', function (response) {
    response.setEncoding('utf8');
    var body = "";
    response.on('data', function (data) { body += data; });
    response.on('end', function () {
      puts 
      var match = body.match(/Play\(this,'(http:.*?lofi.mp3)'/);
      if (match){
        var mp3Url = match[1];
        console.info("found " + mp3Url);
        contribution.url = mp3Url;
        contribution.url_status = 200;
        contribution.status = 'found';
        mixtape.save(function(){
          MxtpsEvent.publishMp3Ok(mixtape, contribution);
        });
      }
    });
  });
}

