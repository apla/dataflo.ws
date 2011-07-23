var EventEmitter = require ('events').EventEmitter,
	crypto       = require ('crypto'),
	task         = require ('RIA/Workflow/Task'),
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
		
		if (project.connections[this.connector][this.collection]) {
			cb.call (self, false, project.connections[this.connector][this.collection]);
			return;
		}
		
		client.open (function (err, p_client) {
			client.collection(self.collection, function (err, collection) {
				if (!err)
					project.connections[self.connector][self.collection] = collection;
				cb.call (self, err, collection);
			});
		});
//	});

	},
	// actually, it's a fetch function
	run: function () {
		var self = this;
		
		this.emit ('log', 'run called');
		
		// primary usable by Ext.data.Store
		// we need to return {data: []}
		this._openCollection (function (err, collection) {
			console.log (this.collection);
			collection.find ().toArray (function (err, results) {
				self.completed ({data: results});
			});
		});
	},
	insert: function () {
		var self = this;
		
		this.emit ('log', 'insert called' + self.data);
		
		this._openCollection (function (err, collection) {
			if (self.data.constructor != Array) {
				self.data = [self.data];
			}
			
			collection.insert (self.data, {safe: true}, function (err, docs) {
				
				console.log (docs);
				
				self.completed ({data: docs, success: true, error: null, errors: []});
				// {"data": {"username":"xyz","email":"z@x.com","password":"abcd","id":"1"},"success":true,"error":null,"errors":[]}
			});
		});
	},
	mongoResponse: function(tagColl, text) {

		var result = [];
		var self = this;
		
		tagColl.count(function(err, count) 
		{
			tagColl.find(function(err, cursor) 
			{

				cursor.each(function(err, item) {
					if (item != null) {
						if(item[self.matchField]) {
							var _name = item[self.matchField].toString();

							if(text == _name.substr(0, text.length)) 
							{
								result.push(item);
							}
						}
					} else {

						searchResult = JSON.stringify({records: result});
						self.completed ({records: result, position: self.position, text: self.searchString, type: self.dataType});
					}
				});
			});
			
		});
		
//		return result;
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
