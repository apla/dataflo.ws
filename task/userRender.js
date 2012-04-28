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

			
			if(user.groupIds && user.groupIds.indexOf(project.config.consumerConfig.facebook.defaultSharingGroupId)>-1){
				user.authorized=true;
			}
//			user.authorized=true; //remove
			
			console.info(user);
			
		} else {
			user={
				anonymous: true
			}
		}

			self.request.user = user;
			self.completed(user);

	}
});