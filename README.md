# related-localization

[![npm](https://img.shields.io/npm/dm/related-localization.svg?style=flat-square)](https://www.npmjs.com/package/related-localization)
[![Travis](https://img.shields.io/travis/eventEmitter/related-localization.svg?style=flat-square)](https://travis-ci.org/eventEmitter/related-localization)
[![node](https://img.shields.io/node/v/related-localization.svg?style=flat-square)](https://nodejs.org/)

Adds support for locale table sot the related. If you store your locale data on mapping tables between the entity and a 
lanugage table this extension loads the locale data and puts the on the entity itself. currently read only.



## requirements

You need to store your localized data on mapping tables if you want to use this extension.See the example below:

**event**

- id: integer


**language**

- id: integer
- code: varchar(2)


**eventLocale**

- id_event: integer
- id_language: integer
- description: text
- tite: varchar(200)


## API


To add the extension to the orm you have to initialize the extension first.
    
    var   orm               = require('related')
        , ORMLocalization   = require('related-localization');


    var orm = new ORM(dbConfig);

    // you may set the names of the language table and 
    // the column containing the language codes
    // default is «language» and «code». The extions 
    // will apply itself to all entites which 
    // have a mapping to the language table
    var localized = new ORMLocalization({
          languageTable     : 'lang'
        , codeField         : 'name'
        , orm               : orm
    });

    // add the extension to the orm
    orm.use(localized);

    orm.on('load', readyCallback);



### setLocale method on the querybuilder

if you want the locale data returned inline with the base entity you have to call the «setLocale» method.
    
    orm.myDatabase.event(['*']).setLocale(['en', 'nl']).limit(1).find(cb);

    // the result if there is an event with an english 
    // title but only with an dutch description
    {
          id: 1
        , title: 'best event ever'
        , description: 'Komende winter staat het centrum van Zwoll...'
    }


if you don't want to load the locales you shold not call the «setLocale» method!

    orm.myDatabase.event(['*']).limit(1).find(cb);

    // no locale data ....
    {
          id: 1
    }
