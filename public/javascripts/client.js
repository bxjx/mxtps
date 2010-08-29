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
  Playlist.prototype.current = function() {
    return this.items[this.index];
  }
  Playlist.prototype.getCurrentUrl = function() {
    if (this.current()) {
      return this.items[this.index].url;
    }
  };
  Playlist.prototype.getCurrentTitle = function() {
    if (this.current()) {
      return this.items[this.index].title + ' by ' + this.items[this.index].artist;
    }
  }
  Playlist.prototype.setItems = function(items) {
    this.index = 0;
    this.items = items;
  };

  Playlist.prototype.appendItem = function(item) {
    this.items.push(item);
  };


  var Helpers = function(app) {
    this.helpers({
      errorDialog: function(o){
        $('#dialog')
          .text("Couldn't save mixtape because: " + _.reduce(o.errors, function(s, w){ return s == '' ? w : s + ", " + w; }, ''))
          .dialog({ modal: true });
      },

      postJSON: function(url, data, success){
        $.ajax({ url: url, type: 'POST', data: data, dataType: 'json', success: success });
      },

      storeMixtape: function(mixtape){
        if (this.app.storage.isAvailable() && this.app.useStorage){
          this.app.storage.set(mixtape._id, mixtape)
        }
      },

      loadMixtape:  function(id, callback){
        var ctx = this;
        if (ctx.app.storage.isAvailable()  && this.app.useStorage && ctx.app.storage.exists(id)){
          callback(ctx.app.storage.get(id));
        }else{
          $.getJSON('/mixtapes/' + id, function(mixtape){
            ctx.storeMixtape(mixtape)
            callback(mixtape);   
          });
        }
      },

      subscribeAll: function(){
        var ctx = this;
        if (!this.faye)
          this.faye = new Faye.Client('/events');
        if (!this.subscription){
          this.subscription = this.faye.subscribe('/mixtapes/*', function(message) {
            console.log("GOT :");
            console.log(message);
            if (message.mixtape){
              ctx.storeMixtape(message.mixtape);
              var path = '#/mixtape/' + message.mixtape._id;
              if (ctx.path == path && message.what != 'created'){
                // we're looking at this mixtape and there has been an update, let's reload the mixtape
                this.swap(path);
              }
            }
            console.info("comparing" + message.mixtape._id + " and " + ctx.currentMixtapeId);
            if (message.what == 'mp3ok' && message.mixtape._id == ctx.currentMixtapeId){
              console.log("appending... " + message.to.title);
              ctx.playlist.appendItem(message.to);
            }
            ctx.renderEvent(message);
          });
        }
      },

      renderEvent : function(subEvent){
        this.partial('views/events/show.ejs', {subEvent: subEvent}, function(rendered) {
          $('#events').prepend(rendered).children(':first').hide().fadeIn(2000);
        });
      },

      renderCurrentTrackInfo : function() {
        $("#current-track").text(this.playlist.getCurrentTitle());
      },

      renderCurrentMixtapeInfo : function(mixtape) {
        var ctx = this;
        ctx.partial('views/player/nowplaying.ejs', {mixtape: mixtape, playlist: ctx.playlist}, function (rendered) {
          $("#now-playing").html(rendered);
          ctx.renderCurrentTrackInfo();
        });
      },

      playMixtape : function(id) {
        var ctx = this;
        this.loadMixtape(id, function(mixtape){
          ctx.playlist.setItems(mixtape.contributions);
          ctx.player.jPlayer("setFile", ctx.playlist.getCurrentUrl()).jPlayer('play');
          ctx.postJSON('/mixtapes/'+mixtape._id+'/played');
          ctx.renderCurrentMixtapeInfo(mixtape);
          ctx.currentMixtapeId = mixtape._id;
        });
      },

      gotoNextTrack : function() {
        if (this.playlist.next()) {
          this.player.jPlayer('setFile', this.playlist.getCurrentUrl()).jPlayer('play');
        }
        this.renderCurrentTrackInfo();
      },

      gotoPrevTrack : function() {
        if (this.playlist.prev()) {
          this.player.jPlayer('setFile', this.playlist.getCurrentUrl()).jPlayer('play');
        }
        this.renderCurrentTrackInfo();
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
          ctx.gotoNextTrack();
        });

        $('#play-mixtape').live('click', function(){
          var currentMixtapeId = location.hash.replace(/^#\/mixtapes\/([0-9a-f]+)$/, '$1');
          ctx.playMixtape(currentMixtapeId);
        });

        $('.jp-next').live('click', function(){
          ctx.gotoNextTrack();
          $(this).blur();
        });

        $('.jp-previous').live('click', function(){
          ctx.gotoPrevTrack();
          $(this).blur();
        });
      },

      addRecentEvents : function(){
        var ctx = this;
        ctx.clearEvents();
        $.getJSON('/recent_events', function(events){
          $.each(events.reverse(), function(i, e){
            ctx.renderEvent(e);
          });
        });
      },

      clearEvents : function(){
        $.each($('#events').children('.event'), function(i, e){
          $(e).fadeOut(2000);
        });
      },

      addRecentEventsForMixtape : function(mixtape){
        var ctx = this;
        ctx.clearEvents();
        $.getJSON('/mixtapes/' + mixtape._id + '/recent_events', function(events){
          $.each(events.reverse(), function(i, e){
            ctx.renderEvent(e);
          });
        });
      }
    });
  };


  var app = $.sammy(function() {
    this.element_selector = '#content';

    this.use(Helpers);
    this.use(Sammy.EJS);
    this.storage  = new Sammy.Store();
    this.useStorage = false;
    this.subscription = null;

    this.bind('run', function(){
      this.initPlayer();
      this.subscribeAll();
    });

    this.bind('changed', function(){
      $('input, textarea').filter(':first').focus();
    });

    this.get('#/', function(ctx){
      $.getJSON('/', function(mixtape_collections){
        ctx.partial('views/index.ejs', mixtape_collections);
        ctx.addRecentEvents();
      });
    });

    this.post('#/mixtapes', function(ctx){
      ctx.postJSON('/mixtapes', {theme : ctx.params['theme'], user: ctx.params['user']}, function(mixtape){
        if (mixtape.errors.length){
          ctx.errorDialog(mixtape);
        }else{
          if (ctx.params['user'].length) {
            $.cookie('user', ctx.params['user']);
          }
          ctx.storeMixtape(mixtape);
          ctx.redirect('#/mixtapes/' + mixtape._id)
        }
      });
    });

    this.get('#/mixtapes/new', function(ctx){
      ctx.partial('views/mixtapes/new.ejs', {user: $.cookie('user')});
    });

    this.get('#/mixtapes/:id/contributions/new', function(ctx){
      this.loadMixtape(this.params['id'], function(mixtape){
        ctx.partial('views/contributions/new.ejs', {mixtape : mixtape, user: $.cookie('user')});
      });
    });

    this.post('#/mixtapes/:id/contributions', function(ctx){
      this.loadMixtape(this.params['id'], function(mixtape){
        ctx.postJSON(
          '/mixtapes/' + mixtape._id + '/contributions',
          {artist: ctx.params['artist'], title: ctx.params['title'], comments: ctx.params['comments'], url: ctx.params['url'], user: ctx.params['user']},
          function(returned_mixtape){
            if (returned_mixtape.errors.length){
              ctx.errorDialog(returned_mixtape);
            }else{
              ctx.storeMixtape(returned_mixtape);
              ctx.redirect('#/mixtapes/' + returned_mixtape._id)
            }
          }
        );
      });
    });

    this.get('#/mixtapes/:id', function(ctx){
      this.loadMixtape(this.params['id'], function(mixtape){
        ctx.partial('views/mixtapes/show.ejs', { mixtape: mixtape });
        ctx.addRecentEventsForMixtape(mixtape);
      });
    });
  });


  $(function() {
    $("abbr.timeago").livequery(function(){
      $(this).timeago();
    });
    app.run('#/');
  });

})(jQuery);
