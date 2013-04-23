var task         = require ('./base'),
	util         = require ('util');

var cleintCookie = module.exports = function (config) {

	this.init (config);

};

util.inherits (cleintCookie, task);

util.extend (cleintCookie.prototype, {

	run: function() {

		var self = this;
		self.failed('use method [parse|render]');

	},
	
	// - - - client-side
	
	parse: function() {
		
		var self = this;
		
		var cookies = self.headers['set-cookie'] ? self.headers['set-cookie'] : [];
		
		var cookiesArr = cookies.map (function(item) {

			return self.deserializeCookie(item);

		});

		self.completed (cookiesArr);
		
	},
	
	deserializeCookie: function(coockieStr) {

		var pairs = coockieStr.split('; '),
			cookie = {};
		
		var nameValue = pairs.shift().split('=');
		
		cookie.name = nameValue[0];
		cookie.value = decodeURIComponent(nameValue[1]);
		
		if (pairs.length) pairs.forEach(function(pair) {
		
			pair = pair.split('=');
			
			var key = pair.shift(),
				value = pair.join('');
				
			cookie[key] = value || true;
			
		});
		
		if (cookie.expires) cookie.expires = ~~(new Date(cookie.expires).getTime()/1000);

		return cookie;
	},

	render: function () {

		var self = this;

		var cookies = [];

		self.cookies.map(function(cookie) {

			cookies.push(cookie.name + '=' + encodeURIComponent(cookie.value));

		});

		self.completed (cookies);
	}

});
