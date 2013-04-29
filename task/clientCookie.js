var task         = require ('./base'),
	util         = require ('util');

var clientCookie = module.exports = function (config) {

	this.init (config);

};

util.inherits (clientCookie, task);

util.extend (clientCookie.prototype, {

	run: function() {

		var self = this;
		self.failed('use method [parse|render]');

	},
	
	// - - - client-side
	
	parse: function() {
		
		var self = this,
			headers = self.headers || (self.response && self.response.headers) || null,
			cookie = self.cookie || (headers && headers['set-cookie']) || '';
			
		if (cookie.constructor != Array)  cookie = [cookie];
		
		if (self.hashMap) {
		
			var cookieObj = {};
			
			cookie.forEach (function(item) {
				
				item = self.deserializeCookie(item);
				cookieObj[item.name] = item;

			});

			self.completed (cookieObj);
		
		} else {
		
			var cookieArr = cookie.map (function(item) {

				return self.deserializeCookie(item);

			});

			self.completed (cookieArr);
			
		}
		
	},
	
	deserializeCookie: function(coockieStr) {

		var self = this,
			pairs = coockieStr.split('; '),
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
		
		if (!cookie.domain) cookie.domain = self.defaultDomain;

		return cookie;
	},

	render: function () {

		var self = this;

		var cookie = [];

		self.cookie.map(function(item) {

			cookie.push(item.name + '=' + encodeURIComponent(item.value));

		});

		self.completed (cookie);
	}

});
