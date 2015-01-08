

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
    


       //return;
        db.event('*', {
            _: ORM.or({
                  id: 1
            }, {
                description: ORM.like('nl')
            })
        }).setDebugMode().setLocale(['nl', 'de']).find(log);  
    });