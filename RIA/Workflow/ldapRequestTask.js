var EventEmitter = require ('events').EventEmitter,
	common       = require ('common'),
	crypto       = require ('crypto'),
	task         = require ('RIA/Workflow/Task'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	spawn        = require('child_process').spawn;

var command = 'ldapsearch';

var host = "ldap://ml1.rian.ru:636";
var bind = "DC=msk,DC=rian";
var user = "cn=SA_LDAP-Reader,ou=Test&ServiceUsers,dc=msk,dc=rian";
var pass = "SaL123456";

var defaults = "-LLL -z 50 -x -H "+host+" -b "+bind+" -D "+user+" -w "+pass

var ldapRequestTask = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (ldapRequestTask, task);

common.extend (ldapRequestTask.prototype, {
	
	run: function () {

		var self = this;
		
//		console.log ('run', self);
		
		self.emit ('log', 'requested '+this.searchString);
		
		// params preparation
		var args = [
			defaults,
			this.searchPattern.replace (/\{\}/g, this.searchString),
			this.fields
		].join (' ').split (' ');
		
//		console.log (args);
		
		var fork  = spawn(command, args);
		
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

			var found = [];
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
					
					account[parts[0]] = parts[1];
					
				});
				
				if (account) {
					found.push (account);
				}
				
			});
		
//			searchResult = JSON.stringify({records: found});
//			console.log("result is",  JSON.stringify(searchResult));
//			self.completed ({records: found});
			var result = {};
			result[self.keyName || 'records'] = found;
			self.completed (result);
//			{records: found, position: self.position, text: self.searchString, type: self.dataType});
		
		});
	
	}
});
