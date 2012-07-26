var task = require('task/base'),
	util = require('util');

// - - - -

var userRender = module.exports = function(config) {

	this.init (config);		

};

util.inherits (userRender, task);

util.extend (userRender.prototype, {

	run: function() {
		
		var self = this;
		self.failed('use method [parse|render]');
		
	},
	
	parse: function () {
		
		var self = this;
		var request = self.request;
		var user = request.user;
		var groups = request.groups;
		
		var authUser = self.userData;
		
		util.extend (authUser, user);
		
		if (self.groupsData) authUser.groupIds = self.groupsData;
		
		self.completed(authUser);
		
	},
	
	render: function () {
		
		var self = this;
		
		var found = self.found,
			data = found.data,
			user;
		
		if (data && data.length > 0) {
			
			user = data[0];
			
		} else {
			user = {role: 'anonymous'};
		}
		
		self.request.user = user;
		self.completed(user);
	}
});