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
	
	/* aliases */
	this.find = this.run;
	
	this.init (config);
	
};

mongo.Db.prototype.open = function (callback) {
	var self = this; 
	
	if (self._state == 'connected') {
		return callback (null, self);
	}
	
	// Set the status of the server
	if (this.openCalled)
		self._state = 'connecting';

	// Set up connections
	if(self.serverConfig instanceof mongo.Server || self.serverConfig instanceof mongo.ReplSet) {
		if (!this._openCallbacks) this._openCallbacks = [];
		
		if (callback)
			this._openCallbacks.push (callback);
		
		if (!this.openCalled) self.serverConfig.connect(self, {firstCall: true}, function(err, result) {
			
			if(err != null) {
				// Return error from connection
				self.emit ('error', err);
				self._openCallbacks.map (function (item) {
					item (err, null);
				});
				self._openCallbacks = [];
				return;
			}
			// Set the status of the server
			self._state = 'connected';      
			// Callback
			self.emit ('open', self);
			self._openCallbacks.map (function (item) {
				item (null, self);
			});
			self._openCallbacks = [];
			return;
		});

		// Set that db has been opened
		this.openCalled = true;
	} else {
		var err = new Error ("Server parameter must be of type Server or ReplSet");
		self.emit ('error', err);
		return callback(err, null);
	}
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
			console.log (
				'checking project.connections', self.connector, self.collection,
				project.connections[self.connector][self.collection] === void 0 ? 'not cached' : 'cached'
			);
		
		// check collection existing in cache
		// if collection cached - return through callback this collection
		if (project.connections[self.connector][self.collection]) {
			cb.call (self, false, project.connections[self.connector][self.collection]);
			return;
		}
		
		// otherwise open db connection
		client.open (function (err, p_client) {
			// get collection
			client.collection (self.collection, function (err, collection) {
				if (err) {
					console.log (err);
				} else {
					// add to collections cache
					if (this.verbose)
						console.log ('storing project.connections', self.connector, self.collection);
					project.connections[self.connector][self.collection] = collection;
				}
				cb.call (self, err, collection);
			});
		});
	},
	
	// private method to create ObjectID
	
	_objectId: function (hexString) {
		
		if (!hexString) return null;
		
		if (!hexString.substring) return hexString;
		
		var ObjectID = project.connectors[this.connector].bson_serializer.ObjectID;
		
		var id;
		
		try {
			id = new ObjectID(hexString);
		} catch (e) {
			console.error(hexString);
			id = hexString.toString();
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
				sort = self.sort || self.pager && self.pager.sort || {};
			
			if (self.pager) {
				if (self.pager.page && self.pager.limit && self.pager.limit < 100) {
					options.skip = self.pager.start;
					options.limit = self.pager.limit;
				}
				
				filter = self.pager.filter;
				options.sort = sort;
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
							return self._objectId(id);
						});
					}
				}
			}
			
			//remap options fields
			if (options.fields) {
				var fields = options.fields,
					include = fields["$inc"],
					exclude = fields["$exc"];
				
				delete fields.$inc;
				delete fields.$exc;
				
				if (include) {
					include.map(function(field) {fields[field] = 1});
				} else if (exclude) {
					include.map(function(field) {fields[field] = 0})
				}
			}
			
			if (self.verbose)
				console.log ("collection.find", self.collection, filter, options);
			
			var cursor = collection.find(filter, options);
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
				
				if (self.timestamp) {
					item.created = item.updated = ~~(new Date().getTime()/1000);
				}
				if (item._id == null || item._id == '') {
					delete item._id;
				} else {
					docsId.push(item._id);
				}
				
			});
			
			if (self.insertingSafe) {
			
				// find any records alredy stored in db
				
				collection.find({_id: {$in: docsId}}).toArray(function(err, alreadyStoredDocs) {
					
					var alreadyStoredDocsObj = {};
					
					alreadyStoredDocs.map (function(item) {
						alreadyStoredDocsObj[item._id] = true;
					});
					
					// build list of new records
					var dataToInsert = [];
					
					self.data.map(function(item) {
					
						if (!alreadyStoredDocsObj[item._id]) dataToInsert.push(item);
						
					});
										
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

					if (err) {
						console.error(err);
					}
					
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
		var options = self.options || {};
		var idList;

		var callback = function (err) {
			if (err) {
				self.failed(err);
			} else {
				self.completed ({
					_id: { $in: idList }
				});
			}
		};
		
		if (self.verbose)
			self.emit ('log', 'update called ', self.data);
		
		self._openCollection (function (err, collection) {
			
			if (self.data.constructor != Array) {
				self.data = [self.data];
			}
			
			if (self.verbose)
				console.log ('data for update', self.data);
				
			idList = self.data.map (function (item) {
				
				if (item._id || self.criteria || options.upsert) {
					
					var set = {};
					util.extend(true, set, item);
					delete set._id;
					
					var criteriaObj = (self.criteria) ? self.criteria : {};
					
					if (!criteriaObj._id && item._id) criteriaObj._id = self._objectId(item._id);
						
					var newObj;
					
					if (self.modify) {
						
						newObj = {};
						var modify = self.modify;
						
						for (var m in modify) {
							newObj[m] = {};
							
							modify[m].map(function(field) {
								newObj[m][field] = set[field];
								delete set[field];
							});
						}
						
						if (!('$set' in modify)) {
							newObj.$set = set;
						}
						
					} else {
						newObj = (self.replace) ? (set) : ({$set: set});
					}
					
					if (self.timestamp) {
						var timestamp = ~~(new Date().getTime()/1000);
						if (newObj.$set) newObj.$set.updated = timestamp;
						else newObj.updated = timestamp;
					}

					options.safe = true;
					
					if (self.verbose)
						console.log('collection.update ', criteriaObj, newObj, options);
					
					collection.update(criteriaObj, newObj, options, callback);
						
					return item._id;
					
				} else {
					// something wrong. this couldn't happen
					self.emit ('log', 'strange things with _id: "'+item._id+'"');
				}

				return null;
			});
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
			
			self.completed(idList);
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
	},

	readGridFS: function () {
		var self = this;
		this.openGridFS('r', function (gs) {
			gs.read(function (err, data) {
				if (err) {
					self.failed(err);
				} else {
					self.completed(data);
				}
			});
		});
	},

	pipeGridFS: function () {
		var self = this;
		var toStream = this.toStream;

		this.openGridFS('r', function (gs) {
			var stream = gs.stream(true);

			stream.on('end', function () {
				self.completed(stream);
			});

			stream.on('error', function (err) {
				self.failed(err);
			});

			stream.pipe(toStream);
		});
	},

	writeGridFS: function () {
		var self = this;
		var data = this.fileData;

		this.openGridFS('w', function (gs) {
			gs.write(data, function (err) {
				if (err) {
					self.failed(err);
				} else {
					gs.close(function (err, result) {
						if (err) {
							self.failed(err);
						} else {
							self.completed(result);
						}
					});
				}
			});
		});
	},
	
	openGridFS: function (mode, cb) {
		var self = this;
		var options = this.options;
		var fileName = this.fileName;

		this.connector = 'mongo';
		var db = this._getConnector();

		db.open(function (err, db) {
			var gs = new mongo.GridStore(db, fileName, mode, options);

			gs.open(function (err, gs) {
				if (err) {
					self.failed(err);
				} else {
					cb(gs);
				}
			});
		
		});
	},

	createDbRef: function () {
		var self = this;
		var DBRef = project.connectors[
			this.connector
		].bson_serializer.DBRef;
		var data = this.data;
		var colName = this.refCollection;

		var createRef = function (item) {
			return new DBRef(
				colName, self._objectId(item._id)
			);
		};

		try {
			if (data instanceof Array) {
				var refs = data.map(createRef);
			} else {
				refs = createRef(data);
			}

			this.completed(refs);
		} catch (e) {
			this.failed(e);
		}
	}
});
