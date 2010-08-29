var port = parseInt(process.env.PORT) || 3000;
var mongoUri = process.env.MONGO_URI || 'mongodb://localhost/mixtapes';

var http = require('http');
var URL = require('url');
var _ = require('./public/javascripts/lib/underscore-min')._;

// models
var mongoose = require('./lib/mongoose/mongoose').Mongoose;
var db = mongoose.connect(mongoUri);

mongoose.model('MxtpsEvent', {
  properties: ['what', 'when', 'who', 'to', 'mixtape_id', 'mixtape'],
  methods: {
    toJSON: function(){
      return this._normalize();
    },
    save: function(fn){
      if (this.isNew){
        if (!this.when)
          this.when = new Date();
        if (!this.mixtape_id)
          this.mixtape_id = this.mixtape._id;
        //console.info('sending off ' + JSON.stringify(this.toObject()) + ' to ' +  '/mixtapes/' + this.mixtape.id());
        bayeux.getClient().publish('/mixtapes/' + this.mixtape.id(), this.toObject());
      }
      this.__super__(fn);
    }
  },
  static: {
    recent: function(fn){
      this.find({}).sort([['when', -1]]).limit(10).all(fn);
    },

    forMixtape: function(mixtape, fn){
      this.find({'mixtape_id': mixtape._id}).sort([['when', -1]]).limit(10).all(fn);
    },
  }
});
var MxtpsEvent = db.model('MxtpsEvent',db);

mongoose.model('Mixtape', {
  properties: ['theme', 'play_count', 'slug', 'created_at', 'updated_at', 'id', 'user', 'closed', {'contributions': []}],
  //indexes: [[{ slug: 1 }, {unique: true}]],
  methods: {
    toJSON: function(){
      var o = this._normalize();
      o['errors'] = this.errors || [];
      return o;
    },
    id: function(){
      return this._id.toHexString();
    },
    valid : function(){
      this.errors = [];
      var mixtape = this;
      _.each(['theme', 'user'], function(attr){
        if (!mixtape[attr] || !mixtape[attr].trim().length){
          mixtape.errors.push(attr + " is blank");
        }
      });
      if (this.closed){
        this.errors.push("This mixtape has been closed!");
      }
      return this.errors.length == 0;
    },
    addContribution: function(contribution){
      this._dirty['contributions'] = true;
      this.contributions.push(contribution)
    },
    save: function(fn){
      var after_save;
      var saved_mixtape = this;
      var contribution;
      var closedNow = false;
      if (this.isNew){
        this.created_at = new Date();
        after_save = function(){
          var e = new MxtpsEvent()
          e.what = 'created';
          e.when = saved_mixtape.created_at;
          e.who = saved_mixtape.user || 'anon'
          e.mixtape = saved_mixtape;
          e.save(fn);
        };
      }else{
        if (this._dirty['contributions']){
          contribution = this.contributions[this.contributions.length - 1];
          if (saved_mixtape.contributions.length >= 10 && !this.closed){
            this.closed = true;
            this.closed_at = new Date();
            closedNow = true;
          }
          after_save = function(){
            var e = new MxtpsEvent()
            e.what = 'contribution';
            e.when = contribution.created_at;
            e.who = contribution.user || 'anon'
            e.mixtape = saved_mixtape;
            e.to = contribution;
            if (closedNow){
              e.save(function(){
                var e = new MxtpsEvent()
                e2.what = 'closed';
                e2.when = saved_mixtape.closed_at;
                e2.who = null
                e2.mixtape = saved_mixtape;
                e2.save(fn);
              });
            }else{
              e.save(fn);
            }
          }
        }else{
          after_save = fn;
        }
      }
      this.updated_at = new Date();
      this.__super__(after_save);
    }
  },
  static:  {

    random: function(fn){
      var direction = !Math.round(Math.random()) ? 1 : -1;
      this.find({}).sort([['updated_at', direction]]).limit(5).all(fn);
    }, 

    popular: function(fn){
      this.find({'play_count': {'$gt':1}}).sort([['play_count', -1]]).limit(10).all(fn);
    },
  }
});
var Mixtape = db.model('Mixtape',db);

function check_url_status(url, cb) {
  var u = URL.parse(url);
  var client = http.createClient(u.port || 80, u.hostname);
  var request = client.request('HEAD', u.pathname+u.search, {'host':u.hostname});
  request.end();
  request.on('response', function (response){
    console.info(JSON.stringify(response.headers));
    if (response.headers.location) {
      console.info("redirected!  checking " + response.headers.location);
      // TODO: response.headers.location string contains the url plus "undefined"
      // assume 200 for now
      // check_url_status(response.headers.location, cb);
      cb(200);
    } else {
      cb(response.statusCode);
    }
  });
};

mongoose.model('Contribution', {
  properties: ['artist', 'title', 'comments', 'url', 'user', 'url_status'],
  methods: {
    toJSON: function(){
      var o = this._normalize();
      if (this.errors)
        o['errors'] = this.errors;
      return o;
    },
    valid : function(){
      this.errors = [];
      var contribution = this;
      _.each(['artist', 'title', 'user'], function(attr){
        if (!contribution[attr] || !contribution[attr].trim().length){
          contribution.errors.push(attr + " is blank");
        }
      });
      return this.errors.length == 0;
    },
    id: function(){
      return this._id.toHexString();
    },
    save: function(fn){
      var after_save;
      var that = this;
      if (!this.url_status && /^http/.test(that.url)) {
        after_save = function(){
          console.info("new contribution; checking url: " + that.url);
          check_url_status(that.url, function(statusCode){
            Contribution.findById(that._id, function(contribution){
              contribution.url_status = statusCode;
              console.info("url check complete: " + contribution.url + " is HTTP " + contribution.url_status);
              contribution.save(fn);
            });
          });
        };
      } else {
        after_save = fn;
      }
      this.__super__(after_save);
    }
  }
});
var Contribution = db.model('Contribution',db);
mongoose.model('User', {
  properties: ['name', 'email', 'password', 'created_at', 'updated_at'],
  indexes: [[{ name: 1 }, {unique: true}]],
  methods: {
    save: function(fn){
      if (this.isNew){
        this.created_at = new Date();
      }
      this.updated_at = new Date();
      this.__super__(fn);
    }
  }

});
var User = db.model('User',db);




faye = require('faye');
var bayeux = new faye.NodeAdapter({
  mount:    '/events',
  timeout:  45
});

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


var http = require('http');
var querystring = require('querystring');
function lookForMp3(mixtape, contribution){
  var host = 'skreemr.org';
  var url = '/advanced_results.jsp?advanced=true&';
  url += querystring.stringify({song: contribution.title, artist: contribution.artist})
  url += '&album=&genre=&bitrate=0&length=';
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
      var match = body.match(/soundFile=(.*)'/);
      if (match){
        var mp3Url = querystring.unescape(match[1]);
        contribution.url = mp3Url;
        contribution.save(function(){
          console.log('saved! with ' + mp3Url);
        });
      }
    });
  });
}

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
  lookForMp3(null, contribution);
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
    mixtape.addContribution(contribution);
    if (contribution.valid()){
      if (mixtape.valid()){
        contribution.save(function(){
          mixtape.save(function(){
            res.send(JSON.stringify(mixtape));
            lookForMp3(mixtape, contribution);
          });
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

bayeux.attach(app);
app.listen(port);
