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

		var user;

		if (data && data.length > 0) {

			user = data[0];

			if(!user.authorized){
				user.authorized = 0;
			}
			user.authenticated = true;
			user.cid = user._id.toString();

			console.log("User:",user._id, user.cid);

		} else {
			user = {
				anonymous: true
			};
		}

			self.request.user = user;
			self.completed(user);

	}
});