var port = parseInt(process.env.PORT) || 3000;


// models
var mongoose = require('./lib/mongoose/mongoose').Mongoose;
var db = mongoose.connect('mongodb://localhost/mixtapes');

mongoose.model('Mixtape', {
  // need to validate uniquness of theme
  properties: ['theme', 'created_at', 'updated_at', {'contributions': []}, 'user'],
  methods: {
    toJSON: function(){
      return this._normalize();
    },
  }
});
var Mixtape = db.model('Mixtape',db);

mongoose.model('Contribution', {
  properties: ['artist', 'title', 'comments']
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

      // validation should go here: checke email and name are unique
      
      this.__super__(fn);
    }
  }

});
var User = db.model('User',db);




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
    var popular_mixtapes = [];
    Mixtape.find().all(function(random_mixtapes){
      res.send(JSON.stringify({random_mixtapes: random_mixtapes, popular_mixtapes: popular_mixtapes}));
    });
  }
});

app.post('/mixtapes', function(req, res){
  var mixtape = new Mixtape(req.body);
  //mixtape.user = res.currentUser;
  mixtape.save(function(){
    res.send(JSON.stringify(mixtape));
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

app.listen(port);
