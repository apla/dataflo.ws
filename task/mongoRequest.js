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
 * A class for creating MongoDB-related tasks.
 * 
 * To use, set {@link #className} to `"mongoRequest"`.
 *
 * ### Example
 *
	{
		workflows: [{
			url: "/entity/suggest",

			tasks: [{
				functionName:  "parseFilter',
				url:           "{$request.url}",
				produce:       "data.suggest"
			}, {
				className:     "mongoRequest",
				connector:     "mongo",
				collection:    "messages",
				filter:        "{$data.suggest.tag}",
				produce:       "data.records"
			}, {
				className:     "renderTask",
				type:          "json",
				data:          "{$data.records}",
				output:        "{$response}"
			}]
		}]
	}
 *
 * @cfg {String} connector (required) The **config name** for connector
 * in the project configuration object or prepared **MongoDB.Db connection**
 *
 * @cfg {String} collection (required) The collection name from MongoDB.
 *
 * @cfg {String} [method="run"] The name of the method name to be called
 * after the task requirements are statisfied.
 *
 * Possible values:
 *
 * - `run`, selects from the DB
 * - `insert`, inserts into the DB
 * - `update`, updates records in the DB
 *
 * @cfg {String} filter (required) The name of the property of the workflow
 * instance or the identifier of an object with filter fields for `select`,
 * `insert` or `update` methods (see {@link #method}). Filter can be mongo's
 * ObjectID, ObjectID array (in such case mongo requested with {$in: []})
 * or real {@link http://www.mongodb.org/display/DOCS/Querying mongo query}
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
		
		// connector is real connector object
		if (!this.connector.substring && this.connector.open)
			return this.connector;
		
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
		
		if (!hexString.substring) return hexString;
		
		var ObjectID = project.connectors[this.connector].bson_serializer.ObjectID;
		
		var id;
		
		try {
			id = new ObjectID(hexString);
		} catch (e) {
			console.error(hexString);
			throw e;
		}
		
		return id;
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
			var filter = self.filter,
				options = self.options || {},
				sort = self.sort || [];
			
			if (self.verbose)
				console.log ("collection.find", self.collection, self.filter);

			if (self.pager) {
				if (self.pager.page && self.pager.limit && self.pager.limit < 100) {
					options.skip = self.pager.start;
					options.limit = self.pager.limit;
				}
				
				filter = self.pager.filter;
				//sort = self.pager.sort;
			}

			// find by filter or all records
			if (filter) {
				if (filter.constructor === Array)
					filter = {_id: {'$in': filter}};
				// filter is string
				if (filter.substring) {
					filter = {_id: self._objectId (filter)};
				// filter is hash
				} else if (filter._id) {
					// filter._id is string
					if (filter._id.substring) filter._id = self._objectId (filter._id);
					// filter._id is hash with $in quantificators
					if (filter._id['$in']) {
						filter._id['$in'] = filter._id['$in'].map(function(id) {
							return self._objectId (id);
						});
					}
				}
			}
			
			console.log('MONGO REQUEST', 'filter', filter)
			console.log('MONGO REQUEST', 'sort', sort)
			console.log('MONGO REQUEST', 'options', options)

			var cursor = collection.find(filter, sort, options);
			cursor.toArray (function (err, docs) {
				
				if (self.verbose)
					console.log ("findResult", docs);
				
				if (docs) {
					docs.map (function (item) {
						if (self.mapping) {
							self.mapFields (item);
						}
					});
				}
				
				cursor.count(function (err, n) {
					self.completed ({
						success:	(err == null),
						total:		n || 0,
						err:		err,
						data:		docs
					});
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
				if (item._id && item._id != '') docsId.push(item._id);
				
			});
			
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
				
				if (item._id) {
					
					var set = {};
					
					Object.keys(item).forEach(function(k) {
						if (k != '_id')
							set[k] = item[k];
					});
					
					if (self.timestamp) set.updated = new Date().getTime();
					
					var newObj = (self.replace) ? set : {$set: set};
					
					collection.update ({_id: self._objectId(item._id)}, newObj);
						
					return item._id;
					
				} else {
					// something wrong. this couldn't happen
					self.emit ('log', 'strange things with _id: "'+item._id+'"');
				}
			});
			
			self.completed ({_id: {$in: idList}});
		});
	},
	
	remove: function () {
		var self = this;
		
		if (self.verbose) {
			self.emit('log', 'remove called ', self.data);
		}
		
		self._openCollection (function (err, collection) {
			
			if (self.data.constructor != Array) {
				self.data = [self.data];
			}
			
			if (self.verbose) {
				console.log ('data for update', self.data);
			}
				
			var idList = self.data.map(function (item) {
				if (item._id) {
					collection.remove({
						_id: self._objectId(item._id)
					}/*, options, callback */);
						
					return item._id;
				} else {
					// something wrong. this couldn't happen
					self.emit('log', 'strange things with _id: "'+item._id+'"');
				}
			});
			
			self.completed({ _id: { $in: idList } });
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
