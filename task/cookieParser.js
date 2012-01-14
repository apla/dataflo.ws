var task         = require ('task/base'),
	util         = require ('util');

var cookieParser = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (cookieParser, task);

util.extend (cookieParser.prototype, {
	
	run: function () {

		var self = this;
		
		var cookie = self.cookie;
		var cookieObj = {};
		
		console.log ('cookiecookiecookiecookie',cookie);
		
		cookie.split('; ').map (function(item) {
			
			var s = item.split('=');
			cookieObj[s[0]] = s[1];
		
		});
		
		self.completed (cookieObj);
	}
});