(function($) {

  function Playlist() {
    this.index = 0;
    this.items = [];
  };
  Playlist.prototype.next = function() {
    if (this.index < this.items.length-1) {
      this.index += 1;
      return true;
    }
    return false;
  };
  Playlist.prototype.prev = function() {
    if (this.index > 0 && this.items.length > 0) {
      this.index -= 1;
      return true;
    }
    return false;
  };
  Playlist.prototype.getCurrentUrl = function() {
    return this.items[this.index] || "";
  };
  Playlist.prototype.setItems = function(items) {
    this.index = 0;
    this.items = items;
  };


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
          callback(ctx.app.storage.get(id));
        }else{
          $.getJSON('/mixtapes/' + id, function(mixtape){
            ctx.storeMixtape(mixtape)
            callback(mixtape);   
          });
        }
      },

      startFaye: function(){
        this.faye = new Faye.Client('/events');
        this.subscription = null; 
      },

      subscribeAll: function(){
        var ctx = this;
        this.subscription = this.faye.subscribe('/mixtapes/*', function(message) {
          ctx.renderEvent(message);
        });
        //$.each(this.subscriptions, function(i, sub){ sub.cancel() });
      },

      subscribeToMixtape: function(mixtape){
        /*
        if (this.subscriptions.length > 10){
          this.subscriptions.shift.cancel();
        }
        if (this.mainSubscription){
          this.mainSubscription.cancel();
        }
        var ctx = this;
        this.subscriptions.push(
          this.faye.subscribe('/mixtapes/' + mixtape._id, function(message) {
            ctx.renderEvent(message);
          })
        );
        */
      },

      renderEvent : function(subEvent){
        this.partial('views/events/show.ejs', {subEvent: subEvent}, function(rendered) {
          $('#events').prepend(rendered).children(':first').hide().fadeIn(2000);
        });
      },

      initPlayer : function(){
        var ctx = this;
        ctx.player = $("#player");
        ctx.playlist = new Playlist();
        ctx.player.jPlayer({
          swfPath: '/javascripts/lib/jplayer',
          volume: 50,
          ready: function(){
            this.element.jPlayer('setFile', ctx.playlist.getCurrentUrl());
          }
        }).jPlayer('onSoundComplete', function(){
          if (ctx.playlist.next()) {
            this.element.jPlayer('setFile', ctx.playlist.getCurrentUrl()).jPlayer('play');
          }
          // TODO: set "now playing" track name?
        });

        $('#play-mixtape').live('click', function(){
          // TODO: pull in actual mixtape urls, title, etc.
          ctx.playlist.setItems([
            "http://butterteam.com/05 Negative_Thinking.mp3",
            "http://a1926.g.akamai.net/downloadstor.download.akamai.com/mtv.com/downloads/mp3/a/arcade_fire/arcade_fire_rebellion.mp3"
          ]);
          // TODO: set "now playing" to mixtape title.
          ctx.player.jPlayer('setFile', ctx.playlist.getCurrentUrl()).jPlayer('play');
        });

        $('.jp-next').live('click', function(){
          if (ctx.playlist.next()) {
            ctx.player.jPlayer('setFile', ctx.playlist.getCurrentUrl()).jPlayer('play');
          }
          // TODO: set "now playing" track name?
        });

        $('.jp-previous').live('click', function(){
          if (ctx.playlist.prev()) {
            ctx.player.jPlayer('setFile', ctx.playlist.getCurrentUrl()).jPlayer('play');
          }
          // TODO: set "now playing" track name?
        });
      }
    });
  };


  var app = $.sammy(function() {
    this.element_selector = '#content';

    this.use(Helpers);
    this.use(Sammy.EJS);
    this.storage  = new Sammy.Store();

    this.bind('run', function(){
      this.initPlayer();
    });

    this.bind('changed', function(){
      $('input, textarea').filter(':first').focus();
    });

    this.before(function() {
      this.startFaye();
    });

    this.get('#/', function(ctx){
      $.getJSON('/', function(res){
        ctx.subscribeAll();
        ctx.partial('views/index.ejs', { random_mixtapes: res.random_mixtapes, popular_mixtapes: []});
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
    app.run('#/');
  });

})(jQuery);
