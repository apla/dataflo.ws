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
		
		console.log (connectorConfig);
		
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
		
		console.log ('cheking project.connections', self.connector, self.collection);
		
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
		
		self.emit ('log', 'run called');
		
		// primary usable by Ext.data.Store
		// we need to return {data: []}
		
		// open collection
		self._openCollection (function (err, collection) {
			console.log ("COLLECTION:", self.collection, self.filter);
			// find by filter or all records
			collection.find (self.filter || {}).toArray (function (err, results) {
			
				if (results) {
					results.map (function (item) {
						if (self.mapping) {
							self.mapFields (item);
						}
					});
				}
				self.completed (results);
			});
		});
	},
	insert: function () {
		var self = this;
		
		this.emit ('log', 'insert called ' + self.data);
		
		this._openCollection (function (err, collection) {
			if (self.data.constructor != Array) {
				self.data = [self.data];
			}
			
			self.data.map (function (item) {
				// 
				if (item._id && item._id != "") {
					// probably things goes bad. we don't want to insert items
					// with _id field defined
				}
			});
			
			collection.insert (self.data, {safe: true}, function (err, docs) {
				
//				console.log (docs);
				// TODO: check two parallels tasks: if one from its completed, then workflow must be completed (for exaple mongo & ldap tasks)
				if (docs) docs.map (function (item) {
					if (self.mapping) {
						self.mapFields (item);
					}
				});

				
				self.completed ({data: docs, success: true, error: null, errors: []});
				// {"data": {"username":"xyz","email":"z@x.com","password":"abcd","id":"1"},"success":true,"error":null,"errors":[]}
			});
		});
	},
	update: function () {
		var self = this;
		
		this.emit ('log', 'update called ' + self.data);
		
		this._openCollection (function (err, collection) {
			
			if (self.data.constructor != Array) {
				self.data = [self.data];
			}
			
			console.log ('data for update', self.data);
			
			var idList = self.data.map (function (item) {
				if (item._id && item._id != "") {
					var id = self._objectId (item._id);
					var set = {};
					for (var k in item) {
						if (k != '_id')
							set[k] = item[k];
					}
					collection.update ({_id: id}, {$set: set}); //, {safe: true}, function (err) {
//						console.log (docs);
						
						
						// {"data": {"username":"xyz","email":"z@x.com","password":"abcd","id":"1"},"success":true,"error":null,"errors":[]}
					//});
					return id;
					
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
