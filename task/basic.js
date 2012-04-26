var task = require('task/base'),
	util = require('util');
	
// - - -

var basic = module.exports = function(config) {

	this.init (config);

};

util.inherits (basic, task);

util.extend (basic.prototype, {

	run: function() {
		
		var self = this;
		self.failed('use method [render|checkExistAndRender|checkNoExistAndRender|logout]');
		
	},
	
	render: function() {
		
		var self = this,
			user = self.user,
			sessionUID = self.sessionUID;
			
		var index = user.sessionUIDs.indexOf(sessionUID);
		
		if (index == -1) {
			user.sessionUIDs.push(sessionUID);
		}
		
		self.completed(user);
	},
	
	checkExistAndRender: function() {
	
		var self = this,
			mongoResponse = self.mongoResponse,
			password = self.password;
			
		if (mongoResponse.data && mongoResponse.data.length) {
			
			self.user = mongoResponse.data[0];
			
			if (password == self.user.tokens.password) {
				self.render();
			} else {
				self.failed({status: 401, err: "Invalid password", errCode: 2});
			}
		} else {
			self.failed({status: 401, err: "User not found", errCode: 1});
		}
	},
	
	checkNoExistAndRender: function() {
		
		var self = this,
			mongoResponse = self.mongoResponse,
			fields = self.fields;
		
		if (mongoResponse.err || mongoResponse.total == 0 || mongoResponse.data.length == 0) {
			
			//if noexist user with username then create and associate user data with sessionUID
			
			self.user = {
				name: fields.username,
				sessionUIDs: [],
				tokens: {
					password: fields.password
				}
			};
			self.render();
			
		} else {
		
			self.failed({status: 401, err: "User already exist", errCode: 3});
		
		}
	},
	
	logout: function () {
		
		var self = this,
			user = self.user,
			sessionUID = self.sessionUID;
		
		if (user.sessionUIDs) {
		
			var index = user.sessionUIDs.indexOf(sessionUID);
			
			if (index != -1) {
				user.sessionUIDs.splice(index, 1);
			}
			
			self.completed(user);
		
		} else {
			self.failed({err: 'User already logged out'});
		}
	}
	
});