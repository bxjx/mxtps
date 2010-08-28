(function($) {

  var mocktapes = [
    {
      theme: "Songs that are good"
    },
    {
      theme: "Songs that are really good"
    }
  ];

  var app = $.sammy(function() {
    this.element_selector = '#content';

    this.use(Sammy.EJS);

    this.get('#/', function(){
      this.partial('views/index.ejs', { random_mixtapes: mocktapes });
    });

    this.get('#/mixtape/:id', function(){
      this.partial('views/mixtape.ejs', { mixtape: mocktapes[this.params['id']] });
    });

    this.get('#/mixtapes/new', function(){
      this.swap('todo')
    });
  });

  $(function() {
    app.run('#/');
  });

})(jQuery);
