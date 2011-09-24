var EventEmitter = require ('events').EventEmitter,
	crypto       = require ('crypto'),
	task         = require ('task/base'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	spawn        = require ('child_process').spawn,
	mongo        = require ('mongodb');



var mongoRequestTask = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (mongoRequestTask, task);

util.extend (mongoRequestTask.prototype, {
	_getConnector: function () {
	
		if (project.connectors[this.connector]) {
			return project.connectors[this.connector];
		}
		
		var connectorConfig = project.config.db[this.connector];
		
		console.log (connectorConfig);
		
		var connector = new mongo.Db (
			connectorConfig.database,
			new mongo.Server (connectorConfig.host, connectorConfig.port),
			{native_parser: true}
		);
		
		project.connectors[this.connector] = connector;
		project.connections[this.connector] = {};
		
		return connector;
	},
	_openCollection: function (cb) {
		var self = this;
		
		var client = this._getConnector ();
		
		console.log ('cheking project.connections', self.connector, self.collection);
		
		if (project.connections[self.connector][self.collection]) {
			cb.call (self, false, project.connections[self.connector][self.collection]);
			console.log ('%%%%%%%%%% cached');
			return;
		}
		
		client.open (function (err, p_client) {
			client.collection(self.collection, function (err, collection) {
				if (err) {
					console.log (err);
				} else {
					console.log ('storing project.connections', self.connector, self.collection);
					project.connections[self.connector][self.collection] = collection;
				}
				console.log ('%%%%%%%%%% not cached');
				cb.call (self, err, collection);
			});
		});
//	});

	},
	_objectId: function (hexString) {
		var ObjectID = project.connectors[this.connector].bson_serializer.ObjectID;
		return new ObjectID (hexString);
	},
	// actually, it's a fetch function
	run: function () {
		var self = this;
		
		this.emit ('log', 'run called');
		
		// primary usable by Ext.data.Store
		// we need to return {data: []}
		this._openCollection (function (err, collection) {
			console.log (this.collection);
			collection.find (this.filter || {}).toArray (function (err, results) {
				if (results) {
					results.map (function (item) {
						if (self.mapping) {
							self.mapFields (item);
						}
					});
				}
				self.completed ({data: results, filter: this.filter || {}});
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
