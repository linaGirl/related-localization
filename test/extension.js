
	
	process.env.debug_sql = true;

	var   Class 		= require('ee-class')
		, log 			= require('ee-log')
		, assert 		= require('assert')
		, async 		= require('ee-async')
		, fs 			= require('fs')
		, ORM 			= require('ee-orm');



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
		            , schema    : 'ee_orm_localization_test'
		            , hosts: [{
		                  host           : 'localhost'
		                , username       : 'postgres'
		                , password       : ''
		                , port           : 5432
		                , mode           : 'readwrite'
		            }]
		        }];
			}

			this.timeout(5000);
			orm = new ORM(config);
			orm.load(done)
		});

		it('should be able to drop & create the testing schema ('+sqlStatments.length+' raw SQL queries)', function(done) {
			orm.getDatabase('ee_orm_localization_test').getConnection(function(err, connection) {
				if (err) done(err);
				else async.each(sqlStatments, connection.queryRaw.bind(connection), done);
			});				
		});
	});


	var expect = function(val, cb){
		return function(err, result){
			try {
				assert.equal(JSON.stringify(result), val);
			} catch (err) {
				return cb(err);
			}
			cb();
		}
	};


	describe('The Localization Extension', function() {
		var oldDate;

		it('should not crash when instatiated', function() {
			db = orm.ee_orm_localization_test;
			extension = new Localization({orm: orm});
		});


		it('should not crash when injected into the orm', function(done) {
			orm.use(extension);
			orm.reload(done);
		});

		it('set var should work ;)', function() {
			db = orm.ee_orm_localization_test;
		});


		it('(inserting test data)', function(done) {
			var wait = async.waiter(function(){
				var evt = new db.event();
				evt.venue = new db.venue({});
				evt.eventLocale.push(new db.eventLocale({title: 'de', description: 'de', language: db.language({code:'de'})}));
				evt.eventLocale.push(new db.eventLocale({title: 'en', language: db.language({code:'en'})}));
				evt.eventLocale.push(new db.eventLocale({description: 'nl', language: db.language({code:'nl'})}));
				evt.save(done);
			});

			new db.language({code: 'en'}).save(wait());
			new db.language({code: 'nl'}).save(wait());
			new db.language({code: 'de'}).save(wait());
			new db.language({code: 'it'}).save(wait());
		});
	});



	describe('[Querying]', function() {
		it('the extension should return inline locale data', function(done) {
			db.event(['*']).setLocale(['nl', 'de']).find(expect('[{"id":1,"id_venue":1,"description":"nl","title":"de"}]', done));
		});

		it('the extension should NOT return inline locale data if not told to do so', function(done) {
			db.event(['*']).find(expect('[{"id":1,"id_venue":1}]', done));
		});

		it('the extension should remove selected fields from the parent entity', function(done) {
			db.event(['id', 'description']).setLocale(['nl', 'de']).find(expect('[{"id":1,"description":"nl"}]', done));
		});

		it('should work on non localized tables ', function(done) {
			db.venue('*').find(expect('[{"id":1}]', done));
		});

		it('should work on non localized tables when selecting locales on them', function(done) {
			db.venue('*').setLocale(['de', 'nl']).getEvent('*').find(expect('[{"event":[{"id":1,"id_venue":1,"description":"de","title":"de"}],"id":1}]', done));
		});


		it('the extension should move filters to the correct entity', function(done) {
			db.event('*', {
				  id: 1
				, description: ORM.like('nl')
			}).setLocale(['nl', 'de']).find(expect('[{"id":1,"id_venue":1,"description":"nl","title":"de"}]', done));
		});

		it('the extension should move a bit more complex filters to the correct entity', function(done) {
			db.event('*', {
				_: ORM.or({
					  id: 1
				}, {
					description: ORM.like('nl')
				})
			}).setLocale(['nl', 'de']).find(expect('[{"id":1,"id_venue":1,"description":"nl","title":"de"}]', done));
		});

		it('the extension should move order statements to the correct entity', function(done) {
			db.event('*', {
				_: ORM.or({
					  id: 1
				}, {
					description: ORM.like('nl')
				})
			}).order('description').setLocale(['nl', 'de']).find(expect('[{"id":1,"id_venue":1,"description":"nl","title":"de"}]', done));
		});
	});


	describe('[Storing]', function() {
		it('new locale records should work!', function(done) {
			new db.event({
	              description: 'saved. win!'
	            , id_venue: 1
        	}).setLocale('nl').save(expect('{"id":2,"id_venue":1,"description":"saved. win!"}', done));
		});

		it('updating existing records should work!', function(done) {
			db.event({id:2}).setLocale(['en']).findOne(function(err, evt) {
				if (err) done(err);
				else if (!evt) done(new Error('record not found'));
				else {
					evt.title = 'a title. ya!';
					evt.setLocale('nl');
					evt.save(expect('{"id":2,"id_venue":1,"title":"a title. ya!"}', done));
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
					evt.save(expect('{"id":2,"id_venue":1}', done));
				}
			}.bind(this));
		});
	});

