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

util.inherits (replI, EventEmitter);

replI.defaultConfig = {
	host: 'localhost',
	port: 5001,
	message: 'dataflo.ws$ '
};

replI.maxWorkers = 1;

replI.prototype.listen = function () {
	var config = this.config;

	console.log('REPL server running on %s:%s', config.host, config.port);

	net.createServer(function (socket) {
		repl.start(config.message, socket);

		this.ready = true;
		this.emit ('ready');
	}.bind (this)).listen(config.port, config.host);
};
