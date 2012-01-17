var task         = require ('task/base'),
	util         = require ('util');

var cookieParser = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (cookieParser, task);

util.extend (cookieParser.prototype, {
	
	run: function () {

		var self = this;
		
		var cookies = self.cookies;
		var cookiesObj = {};
		
		cookies.split('; ').map (function(item) {
			
			var s = item.split('=');
			cookiesObj[s[0]] = s[1];
		
		});
		
		self.completed (cookiesObj);
	}
});