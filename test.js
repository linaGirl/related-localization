

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
    


        db.event({id:2}).setLocale(['en']).findOne(function(err, evt) {
                if (err) log(err);
                else if (!evt) log(new Error('record not found'));
                else {
                    evt.title = 'a title. ya!';
                    evt.setLocale('nl');
                    evt.save(log);
                }
            }.bind(this));


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