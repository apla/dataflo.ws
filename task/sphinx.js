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
		
		var self        = this,
			select_expr = self.select_expr || '*',
			index       = self.index || sphinxConfig.index,
			pager		= self.pager, // pager.limit pager.start
			match       = self.match || pager.match, // search phrase
			options		= self.options || 'ranker=sph04';

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
				"WHERE MATCH(" + sphinxQL.escape(match) + ")",
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
		    	if (self.verbose) console.log('Query error', err);
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
	}
});