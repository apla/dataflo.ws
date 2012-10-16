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
		if (this.connection)
			return this.connection;

		this.connection = sphinxQLClient.createConnection(sphinxConfig);
		this.connection.on('error', function (err) {
			if (!err.fatal) {
			  this.failed('Fatal error while connecting to server');
		      return;
		    }
		    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
		      throw err;
		    }
		    console.log('Re-connecting lost connection'/* + err.stack*/);
		    this.connection = sphinxQLClient.createConnection(sphinxConfig);
		});

		console.log('Sphinx connection created');
		return this.connection;		
	},
	_openConnection: function (cb) {
		var self = this;
		var sphinxQL = self._getConnection();

		sphinxQL.connect(function (err) {
			if (err) {
				self.failed({
					'err.code'  : err.code,
					'err.fatal' : err.fatal
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
			match       = self.match || 'agr*', // search phrase
			pager		= self.pager, // pager.limit pager.start
			options		= self.options || 'ranker=sph04';

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
				console.log('row',row._id);
				data.push(row._id);
			})
			.on('error', function(err) {
		    	console.log('Query error', err);
		    })
			.on('end', function() {
				console.log('Done with all results');
				self.completed({
					ids: data
				});
			});
		});
	}
});