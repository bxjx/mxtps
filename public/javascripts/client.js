(function($) {

  var Helpers = function(app) {
    this.helpers({
      postJSON: function(url, data, success){
        $.ajax({ url: url, type: 'POST', data: data, dataType: 'json', success: success });
      },

      loadMixtape:  function(id, callback){
        // look at a cache first?
        $.getJSON('/mixtapes/' + id, callback);
      }
    });
  };


  var app = $.sammy(function() {
    this.element_selector = '#content';

    this.use(Helpers);
    this.use(Sammy.EJS);

    this.get('#/', function(ctx){
      $.getJSON('/', function(res){
        console.log(res);
        console.log(res.random_mixtapes);
        ctx.partial('views/index.ejs', { random_mixtapes: res.random_mixtapes, popular_mixtapes: res.popular_mixtapes});
      });
    });

    this.post('#/mixtapes', function(ctx){
      ctx.postJSON('/mixtapes', {theme : ctx.params['theme']}, function(mixtape){
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
          function(mixtape){
            ctx.redirect('#/mixtapes/' + mixtape._id)
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
