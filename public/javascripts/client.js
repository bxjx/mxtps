(function($) {

  var Helpers = function(app) {
    this.helpers({
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

      startFaye: function(){
        this.faye = new Faye.Client('/events');
        this.subscription = null; 
      },

      subscribeAll: function(){
        var ctx = this;
        this.subscription = this.faye.subscribe('/mixtapes/*', function(message) {
          ctx.renderEvent(message);
        });
      },

      renderEvent : function(subEvent){
        this.partial('views/events/show.ejs', {subEvent: subEvent}, function(rendered) {
          $('#events').prepend(rendered).children(':first').hide().fadeIn(2000);
        });
      }
    });
  };


  var app = $.sammy(function() {
    this.element_selector = '#content';

    this.use(Helpers);
    this.use(Sammy.EJS);
    this.storage  = new Sammy.Store();

    /*
    this.bind('changed', function(){
      $('input, textarea').filter(':first').focus();
    });
    */

    this.before(function() {
      this.startFaye();
    });

    this.get('#/', function(ctx){
      $.getJSON('/', function(mixtape_collections){
        ctx.subscribeAll();
        ctx.partial('views/index.ejs', mixtape_collections);
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
          {artist: ctx.params['artist'], title: ctx.params['title'], comments: ctx.params['comments'], url: ctx.params['url']},
          function(returned_mixtape){
            ctx.storeMixtape(returned_mixtape);
            ctx.redirect('#/mixtapes/' + returned_mixtape._id)
          }
        );
      });
    });

    this.get('#/mixtapes/:id', function(ctx){
      this.loadMixtape(this.params['id'], function(mixtape){
        ctx.partial('views/mixtapes/show.ejs', { mixtape: mixtape });
      });
    });
  });


  $(function() {
    /*$('#player').jPlayer({
      swfPath: '/javascripts/lib/jplayer',
      ready: function(){
        this.element.jPlayer('setFile', 'http://butterteam.com/05 Negative_Thinking.mp3').jPlayer('play');
      },
      volume: 50
    })
    .jPlayer('onSoundComplete', function(){
      this.element.jPlayer('play');
    });*/

    app.run('#/');
  });

})(jQuery);
