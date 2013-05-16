var EventEmitter = require ('events').EventEmitter,
	crypto       = require ('crypto'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	spawn        = require ('child_process').spawn,
	mongo        = require ('mongodb'),
	task         = require ('./base');

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
 * - `remove`, removes records from the DB
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


	_log : function(){
		var self = this;
		if (self.verbose){
			console.log.apply (console, arguments);
		}
	},

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

		var connOptions;
		if (!connectorConfig.options)
			connectorConfig.options = {};

		connOptions = connectorConfig.options;

		if (!connOptions.hasOwnProperty('native_parser'))
			connOptions['native_parser'] = true;

		if (!connOptions.hasOwnProperty('journal') ||
			!connOptions.hasOwnProperty('w') ||
			!connOptions.hasOwnProperty('fsync'))
			connOptions['journal'] = true;

		// create connector

		var connector = new mongo.Db (
			connectorConfig.database,
			new mongo.Server (connectorConfig.host, connectorConfig.port),
			connOptions
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

	objectId: function () {
		this.completed(this._objectId(this.id));
	},

	// private method to create ObjectID

	_objectId: function (hexString) {

		if (!hexString) return null;

		var ObjectID = project.connectors[this.connector].bson_serializer.ObjectID;

		if (hexString.constructor === ObjectID) return hexString;

		var id;

		try {
			id = new ObjectID(hexString);
		} catch (e) {
			console.error(hexString);
			id = hexString.toString();
		}

		if (this.verbose) console.log('ObjectID',id);

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
		self._openColOrFail(function (collection) {
			var filter = self.filter,
				options = self.options || {},
				sort = self.sort || (self.pager && self.pager.sort) || {};

			if (self.pager) {
				if (self.pager.limit) {
					options.limit = self.pager.limit;
					options.page = self.pager.page || 0;
					//options.skip = self.pager.start || 0;
					options.skip = self.pager.start || options.limit * options.page;
				}

				if (!filter) filter = self.pager.filter;
			}

			options.sort = sort;

			if (self.verbose)
				console.log ("collection.find >> ", self.collection, filter, options );

			// find by filter or all records
			if (filter) {
				if (filter.constructor === Array)
					filter = {_id: {'$in': filter}};
				// filter is string
				if (filter.constructor === String) {
					filter = {_id: self._objectId (filter)};
				// filter is hash
				} else if (filter._id) {
					// filter._id is string
					if (filter._id.constructor === String) filter._id = self._objectId (filter._id);
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
					console.log ("findResult", docs.length);

				if (docs) {
					docs.map (function (item) {
						if (self.verbose) console.log(item._id);
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

					if (!err & 0 == n) {
						self.empty();
					}
				});
			});
		});
	},

	insert: function () {

		var self = this;

		if (!self.data) self.data = {};

		if (self.verbose) {
			self.emit ('log', 'insert called ' + self.data);
		}

		self._openCollection (function (err, collection) {

			if (self.data.constructor != Array) {
				self.data = [self.data];
			}

			var docsId = [];
			self.data = self.data.map(function(item) {
				
				var clone = util.extend(true, {}, item);

				if (self.timestamp) {
					clone.created = clone.updated = ~~(new Date().getTime()/1000);
				}
				if (clone._id == null || clone._id == '') {
					delete clone._id;
				} else {
					docsId.push(clone._id);
				}
				
				return clone;

			});

			/* MODIFIED: optionally check if records already in collection by self.filter, otherwise by _id
			 * if records found :
			 *		if self.forceUpdate is true of updateData is provided
			 *			: update records using updateData or data
			 * if records not found : insert
			 */

			var filter = self.filter || {_id: {$in: docsId}};

			self._log('Filter: ', filter, ', Update: ', self.updateData);

			if (self.insertingSafe) {

				// find any records alredy stored in db

				self._log('insertingSafe data = ', self.data);

				collection.find(filter).toArray(function (err, alreadyStoredDocs) {

					self._log('Already stored: ', alreadyStoredDocs.length, ' docs');

					if (alreadyStoredDocs.length > 0 && (self.forceUpdate || self.updateData)) {

						var updateData = self.updateData || self.data;

						self._log('Updating @filter: ', filter, ' with: ', updateData);

						if (self.emulate) {
							console.log('EMULATION: Update');
							self.completed ({
								success:	true,
								total: alreadyStoredDocs.length,
								err: null,
								data: []
							});

							if (0 == alreadyStoredDocs.length) {
								self.empty();
							}

							return;
						}

						collection.update(
							filter, updateData, { safe: true }, Boolean
						);

						self._log(alreadyStoredDocs);

						self.completed ({
							success:	true,
							total:	alreadyStoredDocs.length,
							err:		false,
							data:		alreadyStoredDocs
						});

						if (0 == alreadyStoredDocs.length) {
							self.empty();
						}

						return;

					} else {

						// build list of new records

						self._log('Really inserting. Creating dataToInsert with unique = ', self.unique);

						var dataToInsert = [];

						/* if self.unique array is provided, its fields are used to check whether doc is already in collection
						 *	doc is not inserted only if all unique fields of the new doc are equal to the same fields of the old doc
						 *
						 * if self.unique is not provided checks by _id
						 */

						if (alreadyStoredDocs.length == 0) {

							self.data.map(function (item) { dataToInsert.push(item) });

						} else {

							if (!self.unique) {

								var alreadyStoredDocsIds = {};

								alreadyStoredDocs.map (function(item) {
									alreadyStoredDocsIds[item._id] = true;
								});

								self.data.map(function(item) {
									if (!alreadyStoredDocsIds[item._id]) dataToInsert.push(item);
								});

							} else {
								var unique = self.unique;
								if ( !(unique instanceof Array) ) unique = [unique];

								dataToInsert = self.data.filter(function(item) {
									var uniqueField;
									for (var k = 0; k < alreadyStoredDocs.length; k++) {
										for (var l = 0; l < unique.length; l++) {
											uniqueField = unique[l];
											if (alreadyStoredDocs[k][uniqueField] != item[uniqueField]) return true;
										}
									}
									return false;
								});

							}
						}

						if (dataToInsert.length == 0) {

							self._log('Nothing to insert');

							self.completed ({
								success:	(err == null),
								total:		alreadyStoredDocs.length,
								err:		err || null,
								data:		alreadyStoredDocs
							});

							if (!err && 0 == alreadyStoredDocs.length) {
								self.empty();
							}

							return;
						}


						self._log('Perform insert of ', dataToInsert.length, ' items', dataToInsert);

						if (self.emulate) {
							console.log('EMULATION: Insert Safe');
							self.completed ({
								success:	true,
								total: 1,
								err: null,
								data: []
							});
							return;
						}

						collection.insert (dataToInsert, {safe: true}, function (err, docs) {

							if (docs) docs.map (function (item) {
								if (self.mapping) {
									self.mapFields (item);
								}
							});

							self._log('inserted ', docs, err);

							var insertedRecords = alreadyStoredDocs.concat(docs);


							self.completed ({
								success:	(err == null),
								total:		(insertedRecords && insertedRecords.length) || 0,
								err:		err || null,
								data:		insertedRecords
							});

							if (!err && 0 == insertedRecords.length) {
								self.empty();
							}
						});
					}

				}); //collection.find(filter).toArray

			} else {

				if (self.emulate) {
					console.log('EMULATION: Insert');
					self.completed ({
						success:	true,
						total: 1,
						err: null,
						data: []
					});
					return;
				}
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

					if (!err && 0 == docs.length) {
						self.empty();
					}
				});

			}

		});
	},

/**
 * Params:
 *
 * @cfg {Object} criteria - object for select updating object (see MongoDB docs).
 *
 * @cfg {Array} criteriaFields - this array must contains field names, by wich will
 * be constructed criteriaObj. This parameter is for updating many records.
 *
 * @cfg {Array | Object} data - main data container.
 *
 * @cfg {Object} modify - object {operation: [fieldName], ...} for modifying data,
 * f.e. {$push: ['comment'], $set: ['title']}
 *
 * @cfg {Array} options (upsert, multi, safe)
 *
 */
	
	update: function () {
		
		var self = this,
			options = self.options || {},
			idList,
			total = 0,
			success = 0,
			failed = 0,
			criteriaFields = self.criteriaFields || ["_id"];
			
		var callback = function (err) {
			
			if (idList.length > 1) { // many records
				
				total++;
				
				if (err) {
					failed++
				} else {
					success++;
				}
				
				if (total == idList.length) {
					if (total == success) {
						if (self.verbose) self.emit('log', 'Updated IDs', idList);
						self.completed({
							_id: { $in: idList }
						});
					} else {
						self.failed({
							msg: 'Not all records updated',
							failed: failed,
							total: total,
							success: success
						});
					}
				}
			
			} else { // single object
				
				if (err) {
					self.failed(err);
				} else {
					
					self.completed ({
						_id: idList[0]
					});
					
					if (0 == idList.length) {
						self.empty();
					}
				}
			}
		
		};

		if (self.verbose)
			self.emit ('log', 'update called ', self.data);

		self._openCollection (function (err, collection) {

			// wrap single record to array
			
			if (self.data.constructor != Array) {
				self.data = [self.data];
			}

			idList = self.data.map (function (item) {

				if (item._id || self.criteria || options.upsert) {

					// clone before update
					
					var set = util.extend(true, {}, item);
					delete set._id;
					
					// criteriaObj

					var criteriaObj;
					
					if (!self.criteria) {
						
						// default by _id or by defined first level fields just
						
						criteriaObj = {};
						
						criteriaFields.forEach(function(fieldName) {
						
							if (fieldName == "_id") {
								if (item[fieldName]) criteriaObj[fieldName] = self._objectId(item[fieldName]);
							} else {
								if (set[fieldName]) criteriaObj[fieldName] = set[fieldName];
							}
						
						});
						
					} else {
						criteriaObj = self.criteria;
					}
					
					// newObj

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
					
					// set timestamp

					if (self.timestamp) {
						var timestamp = ~~(new Date().getTime()/1000);
						if (newObj.$set) newObj.$set.updated = timestamp;
						else newObj.updated = timestamp;
					}

					// safe
					
					options.safe = true;

					// show input params
					if (self.verbose)
						console.log('collection.update ', criteriaObj, newObj, options);
					
					// do update
					collection.update(criteriaObj, newObj, options, callback);
					
					// return Id for map operation
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
		var self = this,
			ids;

		self.options = self.options || { safe: true };

		if (self.verbose) {
			self.emit('log', 'remove called ', self.data);
		}
		
		if (!Object.is('Array', self.data)) {
			self.data = [self.data];
		}
		
		ids = self.data.filter(function (item) {
			return null != item._id;
		});
		
		if (self.data.length != ids.length && ids.length == 0) {
			
			ids = self.data.filter(function (id) {
				return null != id;
			}). map(function (id) {
				return self._objectId(id);
			});
			
		} else {
			
			ids = ids.map(function (item) {
				return self._objectId(item._id);
			});
			
		}

		self._openCollection(function (err, collection) {
			
			if (self.verbose) {
				console.log('data for remove', self.data);
			}

			collection.remove({
				_id: { $in: ids }
			}, self.options, function (err, records) {
				self.completed ({
					err: err,
					success: err == null,
					total: records.length,
					data: records
				});
			});
		});
	},

	removeAll: function () {
		var self = this;

		self.options = self.options || { safe: true };

		if (self.verbose) {
			self.emit('log', 'removeAll');
		}
		
		self._openCollection(function (err, collection) {
			collection.remove({
			}, self.options, function (err, records) {
				self.completed ({
					err: err,
					success: err == null,
					total: records.length,
					data: records
				});
			});
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
	},

/**
 * Run a group command across a collection
 *
 * @param {Object|Array|Function|Code} keys an object, array or function expressing the keys to group by.
 * @param {Object} condition an optional condition that must be true for a row to be considered.
 * @param {Object} initial initial value of the aggregation counter object.
 * @param {Function|Code} reduce the reduce function aggregates (reduces) the objects iterated
 * @param {Function|Code} finalize an optional function to be run on each item in the result set just before the item is returned.
 * @param {Boolean} command specify if you wish to run using the internal group command or using eval, default is true.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback returns the results.
 * @return {null}
 * @api public
 * @group(keys, condition, initial, reduce, finalize, command, options, callback)
 */

	group: function () {

		var self = this;

		if (this.verbose)
			self.emit ('log', 'group called');

		// open collection
		/*self._openCollection (function (err, collection) {
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
		});*/
	},

/**
 * Run Map Reduce across a collection. Be aware that the inline option for out will return an array of results not a collection.
 *
 * Options
 *  - **out** {Object, default:*{inline:1}*}, sets the output target for the map reduce job. *{inline:1} | {replace:'collectionName'} | {merge:'collectionName'} | {reduce:'collectionName'}*
 *  - **query** {Object}, query filter object.
 *  - **sort** {Object}, sorts the input objects using this key. Useful for optimization, like sorting by the emit key for fewer reduces.
 *  - **limit** {Number}, number of objects to return from collection.
 *  - **keeptemp** {Boolean, default:false}, keep temporary data.
 *  - **finalize** {Function | String}, finalize function.
 *  - **scope** {Object}, can pass in variables that can be access from map/reduce/finalize.
 *  - **jsMode** {Boolean, default:false}, it is possible to make the execution stay in JS. Provided in MongoDB > 2.0.X.
 *  - **verbose** {Boolean, default:false}, provide statistics on job execution time.
 *  - **readPreference** {String, only for inline results}, the preferred read preference (Server.PRIMARY, Server.PRIMARY_PREFERRED, Server.SECONDARY, Server.SECONDARY_PREFERRED, Server.NEAREST).
 *
 * @param {Function|String} map the mapping function.
 * @param {Function|String} reduce the reduce function.
 * @param {Objects} [options] options for the map reduce job.
 * @return {Objects} returns the result of the map reduce job, (error, results, [stats])
 */

	mapReduce: function () {
		var self = this;

		var options = self.options || {};
		options.out = { inline: 1 }; // override any external out defenition

		self._openColOrFail(function (collection) {
			collection.mapReduce(
				self.map, self.reduce, options,
				self._onResult.bind(self)
			);
		});
	},

	_openColOrFail: function (callback) {
		this._openCollection(function (err, collection) {
			if (err) {
				this.failed(err);
			} else {
				callback.call(this, collection);
			}
		});
	},

	_onResult: function (err, data) {
		if (err) {
			this.failed();
		} else {
			this.completed({
				success: true,
				err: data && data.errmsg,
				data: data,
				total: data ? data.length : 0
			});

			if (!data || 0 == data.length) {
				this.empty();
			}
		}
	},

	aggregate: function () {
		this._openColOrFail(function (collection) {
			collection.aggregate(this.params, this._onResult.bind(this));
		});
	},

	GET: function () {
		this.run();
	},

	POST: function () {
		this._openColOrFail(function (collection) {
			collection.update(
				this.criteria || {},
				this.data     || {},
				this.options  || {},
				this._onResult.bind(this)
			);
		});
	},

	PUT: function () {
		this._openColOrFail(function (collection) {
			collection.insert(
				this.data    || {},
				this.options || {},
				this._onResult.bind(this)
			);
		});
	}
});
