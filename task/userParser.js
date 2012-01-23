var task = require('task/base'),
	util = require('util');

// - - - -

var userParser = module.exports = function(config) {

	this.init (config);		

};

util.inherits (userParser, task);

util.extend (userParser.prototype, {

	run: function () {
		
		var self = this;
		var request = self.request;
		var user = request.user;
		
		var authUser = {
			user: self.userData,
		};
		
		util.extend (authUser, user);
		
		self.completed(authUser);
		
	}
});