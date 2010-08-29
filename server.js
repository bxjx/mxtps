var port = parseInt(process.env.PORT) || 3000;
var mongoUri = process.env.MONGO_URI || 'mongodb://localhost/mixtapes';

// models
var mongoose = require('./lib/mongoose/mongoose').Mongoose;
var db = mongoose.connect(mongoUri);

mongoose.model('Mixtape', {
  // need to validate uniquness of theme
  properties: ['theme', 'play_count', 'slug', 'created_at', 'updated_at', 'id', 'user', {'contributions': []}],
  //indexes: [[{ slug: 1 }, {unique: true}]],
  methods: {
    toJSON: function(){
      return this._normalize();
    },
    id: function(){
      return this._id.toHexString();
    },
    addContribution: function(contribution){
      this._dirty['contributions'] = true;
      this.contributions.push(contribution)
    },
    save: function(fn){
      var after_save;
      var saved_mixtape = this;
      var contribution;
      if (this.isNew){
        this.created_at = new Date();
        after_save = function(){
          bayeux.getClient().publish(
            '/mixtapes/' + saved_mixtape.id(),
            {what: 'created', when: saved_mixtape.created_at, who: saved_mixtape.user || 'anon', mixtape: saved_mixtape.toObject()}
          );
          fn();
        }
      }else{
        if (this._dirty['contributions']){
          contribution = this.contributions[this.contributions.length - 1];
          after_save = function(){
            bayeux.getClient().publish(
              '/mixtapes/' + saved_mixtape.id(),
              {what: 'contribution', when: contribution.created_at || new Date(), who: contribution.user, mixtape: saved_mixtape.toObject(), to: contribution.toObject()}
            );
            fn();
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
      this.find({}).sort([['updated_at', direction]]).all(fn);
    }, 

    popular: function(fn){
      this.find({}).sort([['play_count', -1]]).all(fn);
    },
  }
});
var Mixtape = db.model('Mixtape',db);

mongoose.model('Contribution', {
  properties: ['artist', 'title', 'comments', 'url'],
  methods: {
    toJSON: function(){
      return this._normalize();
    },
    id: function(){
      return this._id.toHexString();
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

app.post('/mixtapes', function(req, res){
  var mixtape = new Mixtape(req.body);
  mixtape.save(function(){
    res.send(JSON.stringify(mixtape));
  });
});

app.post('/mixtapes/:id/contributions', function(req, res){
  Mixtape.findById(req.params.id, function(mixtape){
    var contribution = new Contribution(req.body)
    contribution.save(function(){
      mixtape.addContribution(contribution);
      mixtape.save(function(){
        res.send(JSON.stringify(mixtape));
      });
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
