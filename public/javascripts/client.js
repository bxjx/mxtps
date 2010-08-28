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
      }
    });
  };


  var app = $.sammy(function() {
    this.element_selector = '#content';

    this.use(Helpers);
    this.use(Sammy.EJS);
    this.storage  = new Sammy.Store();

    this.get('#/', function(ctx){
      $.getJSON('/', function(res){
        ctx.partial('views/index.ejs', { random_mixtapes: res.random_mixtapes, popular_mixtapes: res.popular_mixtapes});
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
        ctx.partial('views/mixtapes/show.ejs', { mixtape: mixtape });
      });
    });

    $(function() {
      app.run('#/');
    });

  });

 })(jQuery);
