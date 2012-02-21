var EventEmitter = require ('events').EventEmitter,
	crypto       = require ('crypto'),
	task         = require ('task/base'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	spawn        = require('child_process').spawn;

var COMMAND = 'ldapsearch';

// TODO: docs

// ldap connector
// need connector property and configuration:
// host, base, user, pass

var ldapRequestTask = module.exports = function (config) {
	this.init (config);
	
};

util.inherits (ldapRequestTask, task);

util.extend (ldapRequestTask.prototype, {
	
	run: function () {

		var self = this;
		
		//console.log ('run', self.pager);
		
		self.emit ('log', 'requested ' + self.pager.filter);
		
		// TODO: error handling
		var connector = project.config.db[this.connector];
		
		var connectorTpl = "-LLL -x -H {$host} -b {$base} -D {$user} -w {$pass}";
		//var windowTpl = "-E vlv=0/0/{$start}/{$limit}";
		var connectorString = connectorTpl.interpolate(connector);
		//var windowString = windowTpl.interpolate(self.pager);
		
		var searchString = self.pager.filter;
		
		// params preparation
		var args = [
			connectorString,
			this.searchPattern.replace (/\{\}/g, searchString),
			this.fields
		].join (' ').split (' ');
		
		//console.log (args.join(' '));
		
		var fork  = spawn(COMMAND, args);
		
		var stderr = '';
		var stdout = '';
		
		fork.stdout.on('data', function (data) {
			stdout += data;
//			console.log (1);
		});

		fork.stderr.on('data', function (data) {
			stderr += data;
//			console.log (2);
		});

		fork.on('exit', function (code) {

			var docs = [];
			var records = stdout.split ("\n\n");
		
			records.map (function (item) {
				
				var account;
				
				item.split (/\n\s+/).join ('').split ("\n").map (function (item) {
					if (!item || item.charAt (0) == '#')
						return
					
					var parts = item.split (': ');
					if (parts[0].charAt(parts[0].length - 1) == ':') {
						parts[0] = parts[0].substr (0, parts[0].length - 1)
						parts[1] = new Buffer(parts[1], 'base64').toString('utf-8')
					}
					
					if (!account)
						account = {};
					
					if (self.toLowerCase)
						parts[0] = parts[0].toLowerCase();
					
					if (account[parts[0]] && account[parts[0]].constructor == Array) {
						account[parts[0]].push (parts[1]);
					} else if (account[parts[0]]) {
						account[parts[0]] = [account[parts[0]], parts[1]];
					} else {
						account[parts[0]] = parts[1];
					}
					
				});
				
				if (account) {
					if (self.mapping) {
						self.mapFields (account);
					}
					
					docs.push (account);
				}
				
			});
			
			var start = parseInt(self.pager.start, 10),
				limit = parseInt(self.pager.limit, 10);
			
			self.completed ({
				success: (docs.length > 0),
				total: docs.length || 0,
				err: null,
				data: docs.slice(start, start + limit) 
			});
		
		});
	
	}
});
