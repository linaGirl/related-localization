
	
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
/*
	describe('[Inserting]', function() {
		it('should set corrent position parameters when inserting records', function(done) {
			

			new db.tree({name: 'root1'}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});

		it('should set corrent position parameters when inserting a root node above another node', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'root2'}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});


		it('should set corrent position parameters when inserting a root node below another node', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'root3'}).setParent(null, true).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 5);
					assert.equal(node.right, 6);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node as child of another node using an id', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'child1.1'}).setParent(1).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 4);
					assert.equal(node.right, 5);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node as child of another node using a query', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'child1.2'}).setParent(db.tree({id:1})).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 4);
					assert.equal(node.right, 5);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node after another node using a model', function(done) {
			db = orm.ee_orm_nestedset_test;

			db.tree({name: 'child1.2'}, ['*']).findOne(function(err, model) {
				if (err) done(err);
				else {
					new db.tree({name: 'child1.3'}).after(model).save(function(err, node) {
						if (err) done(err);
						else {
							assert.equal(node.left, 6);
							assert.equal(node.right, 7);
							done();
						}
					});
				}
			});
		});



		it('should set corrent position parameters when inserting before another node using an id', function(done) {
			db = orm.ee_orm_nestedset_test;

			db.tree({name: 'child1.2'}, ['*']).findOne(function(err, model) {
				if (err) done(err);
				else {
					new db.tree({name: 'child1.4'}).before(5).save(function(err, node) {
						if (err) done(err);
						else {
							assert.equal(node.left, 4);
							assert.equal(node.right, 5);
							done();
						}
					});
				}
			});
		});
	});
	


	describe('[Updating]', function() {
		it('setting a new parent, moving left', function(done) {
			db.tree({id: 5}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(2).save(function(err, movedNode) {
						if (err) done(err);
						else {
							assert.equal(movedNode.left, 2);
							assert.equal(movedNode.right, 3);
							done();
						}
					});
				}
			});
		});

		it('setting a new parent, moving right', function(done) {
			db.tree({id: 7}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(3).save(function(err, movedNode) {
						if (err) done(err);
						else {
							assert.equal(movedNode.left, 12);
							assert.equal(movedNode.right, 13);
							done();
						}
					});
				}
			});
		});
	});



	
	describe('[Deleting]', function() {
		it('deleting a node containing children should not be possible', function(done) {
			db.tree({id: 2}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.delete(function(err, deletedNode) {
						assert(err instanceof Error);
						done();
					});
				}
			});
		});

		it('deleting a node not containing children', function(done) {
			db.tree({id: 5}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.delete(function(err, deletedNode) {
						if (err) done(err);
						else {
							assert.equal(deletedNode.isDeleted(), true);
							done();
						}
					});
				}
			});
		});
	});
	

		
	describe('[TreeBuilding]', function() {
		it('fetching the tree', function(done) {
			db.tree().loadTree(expect('[{"id":2,"left":1,"right":2},{"id":1,"left":3,"right":8,"children":[{"id":6,"left":4,"right":5},{"id":4,"left":6,"right":7}]},{"id":3,"left":9,"right":12,"children":[{"id":7,"left":10,"right":11}]}]', done));
		});
	});
	*/