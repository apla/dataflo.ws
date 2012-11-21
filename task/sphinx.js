// https://github.com/felixge/node-mysql

var sphinxQLClient = require('mysql'),
	task         = require ('task/base'),
	util         = require ('util');

var sphinxConfig = project.config.db.sphinx;
//var sphinxHost   = sphinxConfig.host;
//var sphinxPort   = sphinxConfig.port;

var sphinx = module.exports = function (config) {
	this.init (config);	
};

util.inherits(sphinx, task);

util.extend(sphinx.prototype, {
	
	_getConnection: function () {
		
		var self = this;
		
		if (this.connection)
			return this.connection;

		self.connection = sphinxQLClient.createConnection(sphinxConfig);
		self.connection.on('error', function (err) {
			if (!err.fatal) {
			  self.failed('Fatal error while connecting to server');
		      return;
		    }
		    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
		      throw err;
		    }
		    if (self.verbose) console.log('Re-connecting lost connection'/* + err.stack*/);
		    self.connection = sphinxQLClient.createConnection(sphinxConfig);
		});

		if (self.verbose) console.log('Sphinx connection created');
		return self.connection;		
	},
	
	_openConnection: function (cb) {
		var self = this;
		var sphinxQL = self._getConnection();

		sphinxQL.connect(function (err) {
			if (err) {
				self.failed({
					'code'  : err.code,
					'err' : err.fatal
				});
			} else {
				cb.call(self, sphinxQL);
			}
		});
	},

	run: function () {
		// http://sphinxsearch.com/docs/current.html#sphinxql-select
		
		var self         = this,
			select_expr  = self.select_expr || '*',
			index        = self.index || sphinxConfig.index,
			pager		 = self.pager, // pager.limit pager.start
			match_fields = self.match_fields, // fields to search by. If empty - use all
			match        = self.match || pager.match, // search phrase
			options		 = self.options || 'ranker=sph04';

		//TODO: skip if match is empty
		
		if (!match) {
			return self.completed({
				ids: null
			});
		}
		
		// add asterisks
		
		match = match.split(' ');
		match = match.map(function (item) {
			return item + '*';
		});
		match = match.join(' ');

		// if match_fields is specified - search by them
		if (match_fields) {
			match_fields = "@(" + match_fields.join(',') + ") ";
		} else {
			match_fields = "";
		}

		if (! pager) {
			pager = {};
			pager.start = 0;
			pager.limit = 10;
		}

		var limit = [pager.start, pager.limit].join(',');

		self._openConnection(function (sphinxQL) { 
			var query = [
				"SELECT " + select_expr, 
				"FROM " + index, 
				"WHERE MATCH(" + sphinxQL.escape(match_fields + match) + ")",
				"LIMIT " + limit,
				"OPTION " + options
			].join(' ');

			var data = [];
			var res = sphinxQL.query(query);
			
			res.on('result', function(row) {
				if (self.verbose) console.log('row',row);
				data.push(row._id);
			})
			.on('error', function(err) {
				console.log('Query to execute', query);
		    	console.log('Query error', err);
				self.failed({
					'code'  : err.code,
					'err' : err.fatal
				});
		    })
			.on('end', function() {
				if (self.verbose) console.log('Done with all results');
				self.completed({
					ids: data
				});
			});
		});
	},

	// get object property by "path"
	getObjProp: function (obj, path) {
		var props = path.split('.');
		props.forEach(function (prop) {
			if (obj.hasOwnProperty(prop)) {
				obj = obj[prop];
			} else {
				return;
			}
		});

		return obj;
	},

	insert: function () {
		var self = this,
			records = self.records,
			mapping = self.mapping,
			index   = self.index || sphinxConfig.index
		
		self._openConnection(function (sphinxQL) {
			// prepare values to insert
			values = [];
			records.forEach(function (record) {
				var id = parseInt(record._id.toString().substring(16,24), 16);
				var tmpValues = [sphinxQL.escape(id)];
				mapping.forEach(function (prop) {
					tmpValues.push(
						sphinxQL.escape(
							self.getObjProp(record, prop).toString()
						)
					);
				});
				values.push("(" + tmpValues.join(',') + ")");
			});

			// prepare insert query
			var query = [
				"INSERT INTO " + index, 
				"VALUES ",
				values.join(',')
			].join(' ');

			if (self.verbose) 
				console.log('Query to execute', query);
			
			// execute query
			var res = sphinxQL.query(query);
			
			res.on('error', function(err) {
				console.log('Query to execute', query);
		    	console.log('Query error', err);
				self.failed({
					'code'  : err.code,
					'err' : err.fatal
				});
		    }).on('end', function() {
				if (self.verbose) console.log('Done with all results');
				self.completed({
					ok: true
				});
			});
			
		});
	}
});