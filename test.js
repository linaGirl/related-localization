

    var Class       = require('ee-class')
        , log       = require('ee-log')
        , async     = require('ee-async')
        , ORM       = require('../ee-orm')
        , project   = require('ee-project')
        , Extension = require('./');

    var orm = new ORM(project.config.db);

    orm.use(new Extension({orm:orm}));


    orm.on('load', function(err) {
        log('orm loaded');
        var   db = orm.ee_orm_localization_test
            , start;
   

        var done = function(err, data){
            if (err) log(err);
            if (data && data.dir) data.dir();
            log(data);
        }


        db.event(['*']).setLocale(['nl', 'en']).find(function(err, list) {
            log(err, list, list.length);

        });   
    });