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
			
			var userData = data[0];
			
			self.request.user = userData;
			
			self.completed(userData.user);
		} else {
			self.completed({});
		}
	}
});