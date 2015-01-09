

    var Class       = require('ee-class')
        , log       = require('ee-log')
        , async     = require('ee-async')
        , ORM       = require('../ee-orm')
        , project   = require('ee-project')
        , Extension = require('./');



    var orm = new ORM(project.config.db);

    orm.use(new Extension({orm:orm}));


    orm.load(function(err) {
        log('orm loaded');
        var   db = orm.ee_orm_localization_test
            , start;
    


        new db.event({
              description: 'saved. win!'
            , id_venue: 1
        }).setLocale('nl').save(log);


        return;

       //return;
        db.event('*', {
            _: ORM.or({
                  id: 1
            }, {
                description: ORM.like('nl')
            })
        }).order('description').setDebugMode().setLocale(['nl', 'de']).find(log);  
    });