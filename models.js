var mongoUri = process.env.MONGO_URI || 'mongodb://localhost/mixtapes';
var mongoose = require('./lib/mongoose/mongoose').Mongoose;
var db = mongoose.connect(mongoUri);
var pubsub = require('./pubsub');

mongoose.model('Mixtape', {
  properties: ['theme', 'play_count', 'slug', 'created_at', 'updated_at', 'id', 'user', 'closed', {'contributions': []}],
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
      contribution.created_at = new Date();
      contribution.mixtape_id = this._id;
      this._dirty['contributions'] = true;
      this.contributions.push(contribution.toObject())
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
                var e2 = new MxtpsEvent()
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
exports.Mixtape = Mixtape;

mongoose.model('Contribution', {
  properties: ['artist', 'title', 'comments', 'url', 'user', 'url_status', 'created_at', 'mixtape_id', 'status'],
  methods: {
    toObject: function(){
      var o = this.__super__();
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
  }
});
var Contribution = db.model('Contribution',db);
exports.Contribution = Contribution;

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
exports.User = User;

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
        pubsub.bayeux.getClient().publish('/mixtapes/' + this.mixtape.id(), this.toObject());
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

    publishMp3Ok: function(mixtape, contribution){
      var e = new MxtpsEvent();
      e.what = 'mp3ok';
      e.when = new Date();
      e.who = null;
      e.to = contribution;
      e.mixtape = mixtape;
      e.save();
    }
  }
});
var MxtpsEvent = db.model('MxtpsEvent',db);
exports.MxtpsEvent = MxtpsEvent;

