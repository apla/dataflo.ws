var task         = require ('task/base'),
	util         = require ('util'),
	mime		 = require ('mime');

var cookieRender = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (cookieRender, task);

util.extend (cookieRender.prototype, {
	
	run: function () {

		var self = this;
		
		var cookies = [];
		
		console.log ('>>>>>>>>>', self.cookies);
		
		self.cookies.map(function(cookie) {
		
			cookies.push(self.serializeCookie(cookie));
		
		});
		
		self.output.setHeader ("Set-Cookie", cookies);
		
		self.completed (cookies);
	},
	
	serializeCookie: function(cookie) {
		
		var pairs = [cookie.name + '=' + encodeURIComponent(cookie.value)];
		
		if (cookie.domain) pairs.push('domain=' + cookie.domain);
		if (cookie.path) pairs.push('path=' + cookie.path);
		if (cookie.expirePeriod) {
			
			var expires = new Date();
			var expirePeriod;
			
			var firstChar = cookie.expirePeriod[0];
			expirePeriod = parseInt(cookie.expirePeriod);
			
			if (firstChar == "+" || firstChar == "-") {
				expires.setTime(expires.getTime() + expirePeriod);
			} else {
				expires.setTime(expirePeriod);			
			}
			
			
			pairs.push('expires=' + expires.toUTCString());
		}
		if (cookie.httpOnly) pairs.push('httpOnly');
		if (cookie.secure) pairs.push('secure');

		return pairs.join('; ');
	}
	
});