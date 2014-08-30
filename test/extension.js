
	
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
				config = {
					ee_orm_localization_test: {
						  type: 'postgres'
						, hosts: [
							{
								  host 		: 'localhost'
								, username 	: 'postgres'
								, password 	: ''
								, port 		: 5432
								, mode 		: 'readwrite'
								, database 	: 'test'
							}
						]
					}
				};
			}

			this.timeout(5000);
			orm = new ORM(config);
			orm.on('load', done);
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
			db.event(['*']).setLocale(['nl', 'de']).find(expect('[{"id":1,"description":"nl","title":"de"}]', done));
		});

		it('the extension should NOT return inline locale data if not told to do so', function(done) {
			db.event(['*']).find(expect('[{"id":1}]', done));
		});
	})