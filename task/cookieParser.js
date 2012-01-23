var task         = require ('task/base'),
	util         = require ('util');

var cookieParser = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (cookieParser, task);

util.extend (cookieParser.prototype, {
	
	run: function () {

		var self = this;
		
		var cookies = self.headers.cookie ? self.headers.cookie : null;
		var cookiesObj = {length:0};
		
		if (cookies) cookies.split('; ').map (function(item) {
			
			var s = item.split('=');
			if (s[0] && s[1]) {
				cookiesObj[s[0]] = s[1];
				cookiesObj.length++;
			}
		
		});
		
		self.completed (cookiesObj);
	}
});