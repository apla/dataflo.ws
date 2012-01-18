var task         = require ('task/base'),
	util         = require ('util');

var sessionGenerator = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (sessionGenerator, task);

util.extend (sessionGenerator.prototype, {
	
	run: function () {
		
		var self = this;
		
		var stoken;
		
		var cookies = self.cookies;
		delete cookies.length;
		
		if (cookies.stoken) { // if stoken exist
			
			stoken = cookies.stoken;
		
		} else { // generate
		
			var secret = self.secret;
			
			var ip = self.request.connection.remoteAddress;
			var port = self.request.connection.remotePort;
			
			var date = self.request.connection._idleStart;
			var rnd = ~~(10e+6*Math.random());
			
			var stokenStr = secret + ':' + ip + ':' + port + '.' + date.getTime() + '.' + rnd.toString(2);
			
			stoken = new Buffer(stokenStr).toString('base64').replace(/=+$/, '');
			
			console.log ('Stoken (' + stokenStr + ') = ' + stoken);
		}
		
		// add to request session object
		self.request.session = {stoken: stoken};
		
		self.completed (stoken);
	}
});