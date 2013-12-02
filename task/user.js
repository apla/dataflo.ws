var task = require('./base'),
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

		var self = this,
			request = self.request,
			user = request.user;

		var authUser = self.userData;
		
		authUser.enterCount = 1;

		util.extend (authUser, user);

		if (self.groupsData) authUser.groupIds = self.groupsData;

		authUser.sessionUIDs = request.sessionUID;

		self.completed(authUser);

	},

	render: function () {

		var self = this;

		var found = self.found,
			data = found.data,
			user;

			//console.log('>>>>>', self.found);

		if (data && data.length > 0) {

			user = data[0];

		} else {
			user = {};
		}

		self.completed(user);
	},

	getProfile: function () {
		var result = {};
		var session = this.request.sessionUID;
		var user = this.request.user;

		if (user && user.email && user.name) {
			result.email = user.email;
			result.name = user.name;
			result.avatar = user.avatar || '';
			result.sessionUID = session;
			if (user.externalId) result.externalId = user.externalId;
			result.authType = user.authType;
		} else {
			result.statusCode = 401;
			result.err = 'User not authorized';
		}

		this.completed(result);
	}
});
