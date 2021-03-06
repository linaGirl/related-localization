process.argv.push('--related-errors');
//process.argv.push('--related-sql');

(function() {
	'use strict';


	process.env.debug_sql = true;

	var   Class 		= require('ee-class')
		, log 			= require('ee-log')
		, assert 		= require('assert')
		, fs 			= require('fs')
		, ORM 			= require('related');



	var   Localization = require('../')
		, sqlStatments
		, extension
		, orm
		, db;


	// sql for test db
	sqlStatments = fs.readFileSync(__dirname+'/db.postgres.sql').toString().split(';').map(function(input){
		return input.trim().replace(/\n/gi, ' ').replace(/\s{2,}/g, ' ')
	}).filter(function(item){
		return item.length;
	});



	describe('Travis', function(){
		it('should have set up the test db', function(done){
			var config;

			try {
				config = require('../config.js').db
			} catch(e) {
				config = [{
		              type      : 'postgres'
		            , database  : 'test'
		            , schema    : 'related_localization_test'
		            , hosts: [{}]
		        }];
			}

			this.timeout(5000);
			orm = new ORM(config);
			orm.load(done)
		});

		it('should be able to drop & create the testing schema ('+sqlStatments.length+' raw SQL queries)', function(done) {
			orm.getDatabase('related_localization_test').getConnection('write').then((connection) => {
                return new Promise((resolve, reject) => {
                    let exec = (index) => {
                        if (sqlStatments[index]) {
                            connection.query(sqlStatments[index]).then(() => {
                                exec(index + 1);
                            }).catch(reject);
                        }
                        else resolve();
                    }

                    exec(0);
                });
            }).then(() => {
                done();
            }).catch(done);
		});
	});


	var expect = function(val, cb) {
		var expectation = val ? (typeof val === 'string' ? JSON.parse(val) : val) : undefined;

		return function(err, result){
			if (err) cb(err);
			else {
				if (!expectation) {
					try {
						assert.equal(result, expectation);
					} catch (err) {
						return cb(err);
					}
				}
				else {
					try {
						assert.deepEqual(result.toJSON(), expectation);
					} catch (err) {
						return cb(err);
					}
				}

				cb();
			}

		}
	};


	describe('The Localization Extension', function() {
		var oldDate;

		it('should not crash when instatiated', function() {
			db = orm.related_localization_test;
			extension = new Localization();
		});


		it('should not crash when injected into the orm', function(done) {
			orm.use(extension);
			orm.reload(done);
		});

		it('set var should work ;)', function() {
			db = orm.related_localization_test;
		});


		it('(inserting test data)', function(done) {
			Promise.all(['en', 'nl', 'de', 'it'].map((code) => {
				return new db.language({code: code}).save();
			})).then(() => {
				let evt = new db.event();
				evt.venue = new db.venue({});
				evt.eventLocale.push(new db.eventLocale({title: 'de', description: 'de', language: db.language({code:'de'})}));
				evt.eventLocale.push(new db.eventLocale({title: 'en', language: db.language({code:'en'})}));
				evt.eventLocale.push(new db.eventLocale({description: 'nl', language: db.language({code:'nl'})}));
				evt.save(done);
			});
		});
	});



	describe('[Querying]', function() {
		it('the extension should return inline locale data', function(done) {
			db.event(['*']).setLocale(['nl', 'de']).find(expect('[{"id":1,"title":null,"id_venue":1,"description":"nl"}]', done));
		});

		it('the extension should NOT return inline locale data if not told to do so', function(done) {
			db.event(['*']).find(expect('[{"id":1,"title":null,"id_venue":1}]', done));
		});


		it('the extension should remove selected fields from the parent entity', function(done) {
			db.event(['id', 'description']).setLocale(['nl', 'de']).find(expect('[{"id":1,"description":"nl"}]', done));
		});



		it('should work on non localized tables ', function(done) {
			db.venue('*').find(expect('[{"id":1}]', done));
		});

		it('should work on non localized tables when selecting locales on them', function(done) {
			db.venue('*').setLocale(['de', 'nl']).getEvent('*').find(expect('[{"event":[{"id":1,"id_venue":1,"title":null,"description":"de"}],"id":1}]', done));
		});


		it('the extension should move filters to the correct entity', function(done) {
			db.event('*', {
				  id: 1
				, description: ORM.like('nl')
			}).setLocale(['nl', 'de']).find(expect('[{"id":1,"id_venue":1,"title":null,"description":"nl"}]', done));
		});

		it('the extension should move a bit more complex filters to the correct entity', function(done) {
			db.event('*', {
				_: ORM.or({
					  id: 1
				}, {
					description: ORM.like('nl')
				})
			}).setLocale(['nl', 'de']).find(expect('[{"id":1,"id_venue":1,"title":null,"description":"nl"}]', done));
		});

		it('the extension should move order statements to the correct entity', function(done) {
			db.event('*', {
				_: ORM.or({
					  id: 1
				}, {
					description: ORM.like('nl')
				})
			}).order('description').setLocale(['nl', 'de']).find(expect('[{"id":1,"id_venue":1,"title":null,"description":"nl"}]', done));
		});
	});




	describe('[Storing]', function() {
		it('new locale records should work!', function(done) {
			new db.event({
	              description: 'saved. win!'
	            , id_venue: 1
        	}).setLocale('nl').save(expect('{"id":2,"id_venue":1,"title":null,"description":"saved. win!"}', done));
		});

		it('updating existing records should work!', function(done) {
			db.event({id:2}).setLocale(['en']).findOne(function(err, evt) {
				if (err) done(err);
				else if (!evt) done(new Error('record not found'));
				else {
					evt.description = 'a title. ya!';
					evt.setLocale('nl');
					evt.save(expect('{"id":2,"id_venue":1,"title":null,"description":"a title. ya!"}', done));
				}
			}.bind(this));
		});

		it('updating existing records with empty values should work!', function(done) {
			db.event({id:2}).setLocale(['en']).findOne(function(err, evt) {
				if (err) done(err);
				else if (!evt) done(new Error('record not found'));
				else {
					evt.title = null;
					evt.description = null;
					evt.setLocale('nl');
					evt.save(expect('{"id":2,"id_venue":1,"title":null}', done));
				}
			}.bind(this));
		});

		it('removing one of two localized values should work', function(done) {
			db.venue({id:1}).setLocale(['it']).findOne(function(err, venue) {
				if (err) done(err);
				else if (!venue) done(new Error('record not found'));
				else {
					venue.title = 'my-title';
					venue.description = 'my-description';
					venue.setLocale('it');

					venue.save(expect('{"id":1,"title":"my-title","description":"my-description"}', () => {
						db.venue({id:1}).setLocale(['it']).findOne((err, newVenue) => {
							newVenue.description = null;
							newVenue.setLocale('it');
							newVenue.save(expect('{"id":1,"title":"my-title"}', done));
						});
					}));
				}
			}.bind(this));
		});
	});





	describe('Special cases', function() {
		it('localized languages table', function(done) {
			db.language('*')
				.setLocale(['en'])
				.findOne(done);
		});


		it('localized languages table with alias name', function(done) {
			db.language.setMappingAccessorName('languageLocale', 'locale')

			db.language('*')
				.setLocale(['en'])
				.findOne(done);
		});
	});	
})();
