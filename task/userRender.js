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
		
		//self.failed(error);
		
		var found = self.found;
		var data = found.data;
		
		if (data && data.length > 0) {
			
			var sessionData = data[0];
			
			self.request.userID = sessionData.userID;
			self.request.user = sessionData.user;
			self.request.session = sessionData["session_"+self.request.sessionUID];
			
			self.completed(true);
			
		} else {
			self.completed(true);
		}
	}
});