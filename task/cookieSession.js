var task         = require ('task/base'),
	util         = require ('util');

var sessionGenerator = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (sessionGenerator, task);

util.extend (sessionGenerator.prototype, {
	
	run: function () {
		
		var self = this;
		
		var cookies = self.cookies;
		
		if (cookies.stoken) {
			self.completed(cookies.stoken);
			return;
		}
		
		// - - - - - if no stoken - generate it
		
		var secret = self.secret;
		var ip = self.request.connection.remoteAddress;
		var port = self.request.connection.remotePort;
		
		var date = new Date();
		var rnd = ~~(10e+9*Math.random());
		
		var stokenStr = secret + ':' + ip + ':' + '.' + date.getTime() + '.' + rnd;
		var stoken = new Buffer(stokenStr).toString('base64').replace(/=+$/, '');
		
		self.completed (stoken)
	}
});