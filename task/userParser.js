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
		var groups = request.groups;
		
		var authUser = self.userData;
		
		util.extend (authUser, user);
		
		if (self.groupsData) authUser.groupIds = self.groupsData;
		
		self.completed(authUser);
		
	}
});