var util = require('util');
var net  = require('net');
var repl = require('repl');

var replI = module.exports = function (config) {
	this.config = util.extend(
		Object.create(replI.defaultConfig),
		config || {}
	);
	this.listen();
};

replI.defaultConfig = {
	host: 'localhost',
	port: 5001,
	message: 'dataflo.ws$ '
};

replI.prototype.listen = function () {
	var config = this.config;

	console.log('REPL server running on %s:%s', config.host, config.port);

	net.createServer(function (socket) {
		repl.start(config.message, socket);
	}).listen(config.port, config.host);
};
