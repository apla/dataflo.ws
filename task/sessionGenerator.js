var task         = require ('task/base'),
	util         = require ('util');

var sessionGenerator = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (sessionGenerator, task);

util.extend (sessionGenerator.prototype, {
	
	run: function () {
		
		var self = this;
		
		var ip = self.request.connection.remoteAddress;
		var port = self.request.connection.remotePort;
		
		var date = new Date();
		var rnd = ~~(10e+9*Math.random());
		
		var sessionSTR = ip + ':' + '.' + date.getTime() + '.' + rnd;
		var sessionID = new Buffer(sessionSTR).toString('base64').replace(/=+$/, '');
		
		self.completed (sessionID)
	}
});