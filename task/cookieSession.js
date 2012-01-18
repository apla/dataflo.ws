var task         = require ('task/base'),
	util         = require ('util');

var sessionGenerator = module.exports = function (config) {
	
	this.cookieTpl = { // default tpl
		name: "connect.sid",
		domain: "127.0.0.1",
		path: "/",
		expirePeriod: "0"
	};
	
	this.init (config);
	
};

util.inherits (sessionGenerator, task);

util.extend (sessionGenerator.prototype, {
	
	run: function () {
		
		var self = this;
		
		var value;
		
		var reqCookies = self.reqCookies;
		delete reqCookies.length;
		
		//cookie template
		var cookieTpl = self.cookieTpl;
		
		// name of session cookie
		var name = cookieTpl.name;
		
		if (reqCookies[name]) { // if stoken exist
			
			value = reqCookies[name];
		
		} else { // generate
		
			var secret = self.secret;
			
			var ip = self.request.connection.remoteAddress;
			var port = self.request.connection.remotePort;
			
			var date = self.request.connection._idleStart.getTime();
			var timestamp = date.toString(16);
			var rnd = (~~(10e+6*Math.random())).toString(16);
			
			var str =  ip + ':' + port + '.' + timestamp + '.' + rnd;
			str =  (port % 2 == 0) ? (str + '.' + secret) : (secret + '.' + str);
			
			value = new Buffer(str).toString('base64').replace(/=+$/, '');
			
			self.emit('log', 'Generated SessionID\n\t source = ' + str + '\n\t base64 = ' + value);
		}
		
		// add to request session object
		self.request.session = {
			sessionUID: value
		};
		
		var newCookie = {value: value}
		
		for (var key in cookieTpl) {
			newCookie[key] = cookieTpl[key];
		}
		
		self.completed (newCookie);
	}
});