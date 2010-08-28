(function($) {

  var Helpers = function(app) {
    this.helpers({
      postJSON: function(url, data, success){
        $.ajax({ url: url, type: 'POST', data: data, dataType: 'json', success: success });
      },

      storeMixtape: function(mixtape){
        console.log("storing mixtape " + mixtape._id);
        this.app.storage.set(mixtape._id, mixtape)
      },

      loadMixtape:  function(id, callback){
        var ctx = this;
        if (ctx.app.storage.exists(id)){
          console.info("cache hit " + id)
          callback(ctx.app.storage.get(id));
        }else{
          console.info("cache miss " + id)
          $.getJSON('/mixtapes/' + id, function(mixtape){
            ctx.storeMixtape(mixtape)
            callback(mixtape);   
          });
        }
      },

      startFaye: function(){
        this.faye = new Faye.Client('/events');
        this.mainSubscription = null; 
        this.subscriptions = []; 
        Logger = {
          incoming: function(message, callback) {
            console.log('incoming', message);
            callback(message);
          },
          outgoing: function(message, callback) {
            console.log('outgoing', message);
            callback(message);
          }
        };
        this.faye.addExtension(Logger);
      },

      subscribeAll: function(){
        this.mainSubscription = this.faye.subscribe('/mixtapes/*', function(message) {
          console.info("got ALL message" + JSON.stringify(message));
        });
        $.each(this.subscriptions, function(i, sub){ sub.cancel() });
      },

      subscribeToMixtape: function(mixtape){
        if (this.subscriptions.length > 10){
          console.info("cancelled first subscription");
          this.subscriptions.shift.cancel();
        }
        if (this.mainSubscription){
          this.mainSubscription.cancel();
        }
        console.info("subscribing to /mixtapes/" + mixtape._id);
        this.subscriptions.push(
          this.faye.subscribe('/mixtapes/' + mixtape._id, function(message) {
            console.info("got subscribed message" + JSON.stringify(message));
          })
        );
      }
    });
  };


  var app = $.sammy(function() {
    this.element_selector = '#content';

    this.use(Helpers);
    this.use(Sammy.EJS);
    this.storage  = new Sammy.Store();

    this.before(function() {
      this.startFaye();
    });

    this.get('#/', function(ctx){
      $.getJSON('/', function(res){
        ctx.partial('views/index.ejs', { recent_mixtapes: res.recent_mixtapes});
        ctx.subscribeAll();
      });
    });

    this.post('#/mixtapes', function(ctx){
      ctx.postJSON('/mixtapes', {theme : ctx.params['theme']}, function(mixtape){
        ctx.storeMixtape(mixtape);
        ctx.redirect('#/mixtapes/' + mixtape._id)
      });
    });

    this.get('#/mixtapes/new', function(ctx){
      ctx.partial('views/mixtapes/new.ejs');
    });

    this.get('#/mixtapes/:id/contributions/new', function(ctx){
      this.loadMixtape(this.params['id'], function(mixtape){
        ctx.partial('views/contributions/new.ejs', {mixtape : mixtape});
      });
    });

    this.post('#/mixtapes/:id/contributions', function(ctx){
      this.loadMixtape(this.params['id'], function(mixtape){
        ctx.postJSON(
          '/mixtapes/' + mixtape._id + '/contributions',
          {artist: ctx.params['artist'], title: ctx.params['title'], comments: ctx.params['comments']},
          function(returned_mixtape){
            ctx.storeMixtape(returned_mixtape);
            ctx.redirect('#/mixtapes/' + returned_mixtape._id)
          }
        );
      });
    });

    this.get('#/mixtapes/:id', function(ctx){
      this.loadMixtape(this.params['id'], function(mixtape){
        ctx.subscribeToMixtape(mixtape);
        ctx.partial('views/mixtapes/show.ejs', { mixtape: mixtape });
      });
    });
  });


  $(function() {
    $('#player').jPlayer({
      swfPath: '/javascripts/lib/jplayer',
      ready: function(){
        this.element.jPlayer('setFile', 'http://butterteam.com/05 Negative_Thinking.mp3').jPlayer('play');
      },
      volume: 50
    })
    .jPlayer('onSoundComplete', function(){
      this.element.jPlayer('play');
    });

    app.run('#/');
  });

})(jQuery);
