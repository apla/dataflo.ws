var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	net          = require ('net'),
	repl         = require ('repl'),
	dataflows    = require ('../index'),
	flow         = require ('../flow'),
	common       = dataflows.common,
	paint        = dataflows.color;

var REPLService = module.exports = function (config) {
	this.config = util.extend(
		Object.create(REPLService.defaultConfig),
		config || {}
	);

	this.listen();
};

util.inherits (REPLService, EventEmitter);

REPLService.defaultConfig = {
	host: 'localhost',
	port: 5001,
	message: 'dataflo.ws$ '
};

REPLService.maxWorkers = 1;

REPLService.prototype.listen = function () {
	var config = this.config;

	console.log('REPL worker %d running, try %s', process.pid, paint.path ('nc', config.host, config.port));

	net.createServer(function (socket) {

		socket.write ("This is a REPL console for dataflows application. `master` will guide you.\n");

		var r = repl.start({
			prompt: config.message,
			input: socket,
			output: socket
		}).on ('exit', function () {
			socket.end();
		});

		Object.defineProperty (r, 'master', {
			configurable: false,
			enumerable: true,
			value: {
				status: "",
				gracefulRestart: ""
			}
		});

		this.ready = true;
		this.emit ('ready');

	}.bind (this)).listen(config.port, config.host);
};

module.exports = REPLService;
