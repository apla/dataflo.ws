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
		
		self.completed({
			userID: self.userData.email,
			user: self.userData,
			sessionUIDs: [self.session.sessionUID]
		});
		
	}
});