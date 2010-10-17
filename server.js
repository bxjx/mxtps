var port = parseInt(process.env.PORT) || 3000;

var http = require('http');
var URL = require('url');
var path = require('path');

process.chdir(path.dirname(process.argv[1]));

var _ = require('./public/javascripts/lib/underscore-min')._;
require.paths.unshift('./vendor');

var models = require('./models');
var Mixtape = models.Mixtape;
var MxtpsEvent = models.MxtpsEvent;
var Contribution = models.Contribution;

var findmp3s = require('./findmp3s');
var pubsub = require('./pubsub');


var connect = require('connect');
var express = require('express');
var app = express.createServer(
  connect.bodyDecoder(),
  connect.methodOverride(),
  connect.cookieDecoder(),
  connect.session(),
  connect.staticProvider(__dirname + '/public')
);

app.set('view engine', 'jade');

app.get('/', function(req, res){
  if (!req.xhr){
    res.render('index');
  }else{
    Mixtape.random(function(random_mixtapes){
      Mixtape.popular(function(popular_mixtapes){
        res.send(JSON.stringify({random_mixtapes: random_mixtapes, popular_mixtapes: popular_mixtapes}));
      });
    });
  }
});

app.get('/find_prince', function(req, res){
  contribution = new Contribution();
  contribution.title = 'Cream';
  contribution.artist = 'Prince';
  findmp3s.forThisContributionOnYoutube(null, contribution);
});

app.get('/recent_events', function(req, res){
  MxtpsEvent.recent(function(events){
    res.send(JSON.stringify(events));
  });
});

app.post('/mixtapes', function(req, res){
  var mixtape = new Mixtape(req.body);
  if (mixtape.valid()){
    mixtape.save(function(){
      res.send(JSON.stringify(mixtape));
    });
  }else{
    res.send(JSON.stringify(mixtape));
  }
});

app.post('/mixtapes/:id/contributions', function(req, res){
  Mixtape.findById(req.params.id, function(mixtape){
    var contribution = new Contribution(req.body)
    if (/^http/.test(contribution.url)){
      contribution.url_status = 200;
      contribution.status == 'unverified';
    }
    mixtape.addContribution(contribution);
    if (contribution.valid()){
      if (mixtape.valid()){
        mixtape.save(function(){
          res.send(JSON.stringify(mixtape));
          if (contribution.url_status == 200){
            MxtpsEvent.publishMp3Ok(mixtape, contribution);
          }else{
            findmp3s.forThisContributionOnYoutube(mixtape, contribution);
          }
        });
      }else{
        res.send(JSON.stringify(mixtape));
      }
    }else{
      res.send(JSON.stringify(contribution));
    }
  });
});

app.get('/mixtapes/:id/recent_events', function(req, res){
  Mixtape.findById(req.params.id, function(mixtape){
    MxtpsEvent.forMixtape(mixtape, function(events){
      res.send(JSON.stringify(events));
    });
  });
});

app.post('/mixtapes/:id/played', function(req, res){
  Mixtape.findById(req.params.id, function(mixtape){
    if (mixtape){
      mixtape.play_count += 1;
      mixtape.save(function(){
        res.send(JSON.stringify(mixtape));
      });
    }else{
      res.send("Can't find mixtape with that id??", 404);
    }
  });
});

app.get('/mixtapes/:id', function(req, res){
  Mixtape.findById(req.params.id, function(mixtape){
    if (mixtape){
      res.send(JSON.stringify(mixtape));
    }else{
      res.send("Can't find mixtape with that id??", 404);
    }
  });
});

pubsub.bayeux.attach(app);
app.listen(port);
