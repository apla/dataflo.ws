var task         = require ('./base'),
	util         = require ('util');

// - static

var defaultDomain = project.config.consumerConfig.domain || "127.0.0.1";
var cookieConfig = project.config.consumerConfig.session;
var defaultCookieTpl = { // default tpl
	name: "stoken",
	domain: defaultDomain,
	path: "/",
	expirePeriod: "0"
};

// - - -

var cookieParser = module.exports = function (config) {

	this.init (config);

};

util.inherits (cookieParser, task);

util.extend (cookieParser.prototype, {

	run: function() {

		var self = this;
		self.failed('use method [parse|render|session]');

	},

	parse: function () {

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
	},

	render: function () {

		var self = this;

		var cookies = [];

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
	},

	session: function () {

		var self = this;

		var reqCookies = self.reqCookies;
		delete reqCookies.length;

		//cookie template
		var cookieTpl = self.cookieTpl || cookieConfig.cookieTpl || defaultCookieTpl || {},
			secret = self.secret || cookieConfig.secret || '';

		if (!cookieTpl.domain) cookieTpl.domain = defaultDomain;


		// name of session cookie
		var name = cookieTpl.name;
		var value = (reqCookies[name]) ? reqCookies[name] : self.generate(secret);

		// - - -

		self.request.sessionUID = value;

		// - - -

		var newCookie = {};

		for (var key in cookieTpl) {
			newCookie[key] = cookieTpl[key];
		}

		newCookie.value = value;

		console.log('SESSION', value);

		self.completed (newCookie);
	},

	generate: function(secret) {

		var self = this;
		var ip = self.request.connection.remoteAddress;
		var port = self.request.connection.remotePort;

		var date = self.request.connection._idleStart.getTime();
		var timestamp = date.toString(16);
		var rnd = (~~(10e+6*Math.random())).toString(16);

		var str =  ip + ':' + port + '.' + timestamp + '.' + rnd;
		str =  (port % 2 == 0) ? (str + '.' + secret) : (secret + '.' + str);

		var result = new Buffer(str).toString('base64').replace(/=+$/, '');

		self.emit('log', 'Generated SessionID\n\t source = ' + str + '\n\t base64 = ' + result);

		return result;
	}

});
