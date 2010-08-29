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
      errorDialog: function(o){
        $('#dialog')
          .text("Couldn't save mixtape because: " + _.reduce(o.errors, function(s, w){ return s == '' ? w : s + ", " + w; }, ''))
          .dialog({ modal: true });
      },

      postJSON: function(url, data, success){
        $.ajax({ url: url, type: 'POST', data: data, dataType: 'json', success: success });
      },

      storeMixtape: function(mixtape){
        if (this.app.storage.isAvailable()){
          this.app.storage.set(mixtape._id, mixtape)
        }
      },

      loadMixtape:  function(id, callback){
        var ctx = this;
        if (ctx.app.storage.isAvailable() && ctx.app.storage.exists(id)){
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
            ctx.renderEvent(message);
          });
        }
      },

      renderEvent : function(subEvent){
        this.partial('views/events/show.ejs', {subEvent: subEvent}, function(rendered) {
          $('#events').prepend(rendered).children(':first').hide().fadeIn(2000);
        });
      },

      playMixtape : function(id) {
        var ctx = this;
        this.loadMixtape(id, function(mixtape){
          var items = $.map(mixtape.contributions, function(contribution){
            return contribution.url;
          });
          ctx.playlist.setItems(items);
          ctx.player.jPlayer("setFile", ctx.playlist.getCurrentUrl()).jPlayer('play');
          ctx.postJSON('/mixtapes/'+mixtape._id+'/played');
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
            ctx.player.jPlayer('setFile', ctx.playlist.getCurrentUrl()).jPlayer('play');
          }
          // TODO: set "now playing" track name
        });

        $('#play-mixtape').live('click', function(){
          var currentMixtapeId = window.location.hash.replace(/^#\/mixtapes\/([0-9a-f]+)$/, '$1');
          ctx.playMixtape(currentMixtapeId);
        });

        $('.jp-next').live('click', function(){
          if (ctx.playlist.next()) {
            ctx.player.jPlayer('setFile', ctx.playlist.getCurrentUrl()).jPlayer('play');
          }
          $(this).blur();
          // TODO: set "now playing" track name
        });

        $('.jp-previous').live('click', function(){
          if (ctx.playlist.prev()) {
            ctx.player.jPlayer('setFile', ctx.playlist.getCurrentUrl()).jPlayer('play');
          }
          $(this).blur();
          // TODO: set "now playing" track name
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
