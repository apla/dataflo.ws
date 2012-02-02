var task = require('task/base'),
	util = require('util');

// - - - -

var userRender = module.exports = function(config) {

	this.init (config);		

};

util.inherits (userRender, task);

util.extend (userRender.prototype, {

	run: function () {
		
		var self = this;
		
		var found = self.found;
		var data = found.data;
		
		if (data && data.length > 0) {
			
			var user = data[0];
			
			self.request.user = user;
			
			self.completed(user);
		} else {
			self.completed({});
		}
	}
});