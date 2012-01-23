var EventEmitter = require ('events').EventEmitter,
	crypto       = require ('crypto'),
	task         = require ('task/base'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	spawn        = require ('child_process').spawn,
	mongo        = require ('mongodb');

/**
 * @author 
 * @docauthor
 * @class task.mongoRequest
 * @extends task.task
 * 
 * A class implement few methods of working with MongoDB. Config parameter "className" must be equal to class name, that is "mongoRequest".
 *
 * Example:
 <pre><code>
	{
		workflows: [{
			url: "/entity/suggest",
			tasks: [{
				functionName: 'parseFilter',
				url: "{$request.url}",
				produce: "data.suggest"
			}, {
				className:  "mongoRequest",
				connector:  "mongo",
				collection: "messages",
				filter:     "{$data.suggest.tag}",
				produce:    "data.records"
			}, {
				className: "renderTask",
				type: "json",
				data: "{$data.records}",
				output: "{$response}"
			}]
		}]
	}
 </code></pre>
 *
 * @cfg {String} connector (Require) config name in project object.
 *
 * @cfg {String} collection (Require) collection name from mongodb.
 *
 * @cfg {String} method (Optional) method name, wich will be called after task requirements statisfied.
 * <li>
 * <ul>run - default value, do selection from db</ul>
 * <ul>insert - do insertion to db</ul>
 * <ul>update - do update some records in db</ul>
 * <li>
 *
 * @cfg {String} filter (Require) name of the property in workflow scope or object with filter fields for select | insert | update methods.
 *
 */
var mongoRequestTask = module.exports = function (config) {
	
	this.timestamp = true;
	this.insertingSafe = false;
	
	this.init (config);
	
};

util.inherits (mongoRequestTask, task);

util.extend (mongoRequestTask.prototype, {
	
	// private method get connector
	
	_getConnector: function () {
	
		// get connector config from project if it created
		
		if (project.connectors[this.connector]) {
			return project.connectors[this.connector];
		}
		
		// otherwise create connector from project config and add to project.connectors
		
		var connectorConfig = project.config.db[this.connector];
		
		//console.log (connectorConfig);
		
		// create connector
		
		var connector = new mongo.Db (
			connectorConfig.database,
			new mongo.Server (connectorConfig.host, connectorConfig.port),
			{native_parser: true}
		);
		
		project.connectors[this.connector] = connector;
		project.connections[this.connector] = {};
		
		return connector;
	},
	
	// private method to collection open
	
	_openCollection: function (cb) {
		
		var self = this;
		
		// get db client
		var client = self._getConnector ();
		
		if (this.verbose)
			console.log ('checking project.connections', self.connector, self.collection);
		
		// check collection existing in cache
		// if collection cahed - return through callback this collection
		if (project.connections[self.connector][self.collection]) {
			cb.call (self, false, project.connections[self.connector][self.collection]);
			// console.log ('%%%%%%%%%% cached');
			return;
		}
		
		// otherwise open db connection
		client.open (function (err, p_client) {
			// get collection
			client.collection(self.collection, function (err, collection) {
				if (err) {
					console.log (err);
				} else {
					// add to collections cache
					if (this.verbose)
						console.log ('storing project.connections', self.connector, self.collection);
					project.connections[self.connector][self.collection] = collection;
				}
				// console.log ('%%%%%%%%%% not cached');
				cb.call (self, err, collection);
			});
		});
	},
	
	// private method to create ObjectID
	
	_objectId: function (hexString) {
		var ObjectID = project.connectors[this.connector].bson_serializer.ObjectID;
		return new ObjectID (hexString);
	},
	
	// actually, it's a fetch function
	
	run: function () {
		var self = this;
		
		if (this.verbose)
			self.emit ('log', 'run called');
		
		// primary usable by Ext.data.Store
		// we need to return {data: []}
		
		// open collection
		self._openCollection (function (err, collection) {
			
			if (self.verbose)
				console.log ("collection.find", self.collection, self.filter);
			
			var filter = self.filter;
			
			var windowBegin, windowWidth;
			var findArgs = [];

			if (self.pager && self.pager.page && self.pager.limit && self.pager.limit < 100) {
				windowBegin = self.pager.start;
				windowWidth = self.pager.limit;
				filter = self.pager.filter;
				findArgs.push ({}, windowBegin, windowWidth);
			}

			// find by filter or all records
			if (filter && filter.substring)
				filter = {_id: self._objectId (filter)};
			
			findArgs.unshift (filter || {});

			collection.find.apply (collection, findArgs).toArray (function (err, docs) {
			
				if (self.verbose)
					console.log ("findResult", docs);
				
				if (docs) {
					docs.map (function (item) {
						if (self.mapping) {
							self.mapFields (item);
						}
					});
				}
				
				self.completed ({
					success:	(err == null),
					total:		(docs && docs.length) || 0,
					err:		err,
					data:		docs
				});
			});
		});
	},
	
	insert: function () {
		
		var self = this;
		
		if (self.verbose)
			self.emit ('log', 'insert called ' + self.data);
		
		self._openCollection (function (err, collection) {
			
			if (self.data.constructor != Array) {
				self.data = [self.data];
			}
			
			var docsId = [];
			
			self.data.map(function(item) {
				
				if (self.timestamp) item.created = item.updated = new Date().getTime();
				console.log ('item._id', item._id);
				if (item._id && item._id != '') docsId.push(item._id);
				
			});
			
			console.log ('mongoRequestTask.insert', self.data);
			
			if (self.insertingSafe) {
			
				// find any records alredy stored in db
				
				collection.find({_id: {$in: docsId}}).toArray(function(err, alreadyStoredDocs) {
					
					//console.log("alreadyStoredDocs", alreadyStoredDocs);
					var alreadyStoredDocsObj = {};
					
					alreadyStoredDocs.map (function(item) {
						alreadyStoredDocsObj[item._id] = true;
					});
					
					// build list of new records
					var dataToInsert = [];
					
					self.data.map(function(item) {
					
						if (!alreadyStoredDocsObj[item._id]) dataToInsert.push(item);
						
					});
					
					//console.log ("dataToInsert", dataToInsert);
										
					if (dataToInsert.length == 0) {
						
						self.completed ({
							success:	(err == null),
							total:		alreadyStoredDocs.length,
							err:		err || null,
							data:		alreadyStoredDocs
						});
						
						return;
					}
					
					collection.insert (dataToInsert, {safe: true}, function (err, docs) {
						
						//console.log ('collection.insert', docs, err);
						
						if (docs) docs.map (function (item) {
							if (self.mapping) {
								self.mapFields (item);
							}
						});
						
						var insertedRecords = alreadyStoredDocs.concat(docs);
						
						self.completed ({
							success:	(err == null),
							total:		(insertedRecords && insertedRecords.length) || 0,
							err:		err || null,
							data:		insertedRecords
						});
						
					});
				
				});
			} else {
				
				collection.insert (self.data, {safe: true}, function (err, docs) {
					
					// TODO: check two parallels tasks: if one from its completed, then workflow must be completed (for exaple mongo & ldap tasks)
					if (this.verbose)
						console.log ('collection.insert', docs, err);
					
					if (docs) docs.map (function (item) {
						if (self.mapping) {
							self.mapFields (item);
						}
					});
					
					self.completed ({
						success:	(err == null),
						total:		(docs && docs.length) || 0,
						err:		err || null,
						data:		docs
					});
					
				});
			
			}
			
		});
	},
	
	update: function () {
		
		var self = this;
		
		if (self.verbose)
			self.emit ('log', 'update called ', self.data);
		
		self._openCollection (function (err, collection) {
			
			if (self.data.constructor != Array) {
				self.data = [self.data];
			}
			
			if (self.verbose)
				console.log ('data for update', self.data);
			
			var idList = self.data.map (function (item) {
				
				if (item._id && item._id != "") {
					
					//var id = self._objectId (item._id);
					
					var set = {};
					
					for (var k in item) {
						if (k != '_id')
							set[k] = item[k];
					}
					
					if (self.timestamp) set.updated = new Date().getTime();
					
					collection.update ({_id: item._id}, {$set: set});
						
					return item._id;
					
				} else {
					// something wrong. this couldn't happen
					self.emit ('log', 'strange things with _id: "'+item._id+'"');
				}
			});
			
			self.completed ({_id: {$in: idList}});
		});
	},
	
	emitError: function (e) {
		if (e) {
			this.state = 5;
			this.emit('error', e);
			this.cancel();
			return true;
		} else {
			return false;
		}
	}
});
