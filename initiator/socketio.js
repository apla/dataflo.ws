var EventEmitter = require ('events').EventEmitter,
	SocketIo     = require ('socket.io'),
	util         = require ('util'),
	flow         = require ('../flow'),
	fs 			 = require ('fs');

/**
 * @class initiator.socket
 * @extends events.EventEmitter
 *
 * Initiates WebSocket server-related dataflows.
 */
var SocketInitiator = module.exports = function (config) {
	// we need to launch socket.io

	var self = this;

	if (!config.port) {
		throw "you must define 'port' key for http initiator";
	} else {
		this.port  = config.port;
	}

	this.opts = {};

	if (config.ssl) {
		this.opts.key  = fs.readFileSync(config.ssl.key).toString();
		this.opts.cert = fs.readFileSync(config.ssl.cert).toString()
	}

	if (config.transports) {
		this.opts.transports = config.transports;
	}

	if (config.verbose) {
		this.verbose = true;
	}

	this.flows  = config.workflows || config.dataflows || config.flows;
	self.timer  = config.timer;
	self.router = config.router;

	// router is function in main module or initiator method

	if (config.router === void 0) {
		self.router = self.defaultRouter;
	} else if (process.mainModule.exports[config.router]) {
		self.router = process.mainModule.exports[config.router];
	} else if (self[config.router]) {
		self.router = this[config.router];
	} else {
		throw "we cannot find " + config.router + " router method within initiator or function in main module";
	}

	// - - - start

	self.listen();
}

SocketInitiator.connections = {};

util.inherits (SocketInitiator, EventEmitter);

util.extend (SocketInitiator.prototype, {

	listen: function () {

		var self = this;

		var socketIo = self.socketIo = SocketIo.listen (self.port, self.opts);

		if (!this.verbose) {
			// have no effect on new socket.io
			if (socketIo.disable) socketIo.disable('log');
		}

		Object.keys (this.flows).forEach (function (flowName) {
			var flowUrl = flowName; // [0] === '/' ? flowName : '/' + flowName;
			socketIo.of (flowUrl).on ('connection', function (socket) {
				if (this.verbose) console.log ('Socket server connected ' + socket.id + ', scope: ' + socket.nsp.name);

				SocketInitiator.connections[socket.nsp.name] = socket;

				if (this.flows[flowName].events) {
					Object.keys (this.flows[flowName].events).forEach (function (eventName) {
						socket.on (eventName, this.processMessage.bind (this, eventName, this.flows[flowName].events[eventName], socket));
					}.bind (this));
				} else {
					socket.on ('message', this.processMessage.bind (this, 'message', this.flows[flowName], socket));
				}

				socket.on ('disconnect', function () {
					if (this.verbose) console.log ('Socket server disconnected ' + socket.id);
					delete SocketInitiator.connections[socket.nsp.name];
				}.bind (this));
			}.bind (this));
		}.bind (this));

		console.log ('Socket server running on ' + this.port + ' port');

		this.emit ('ready', this);
	},

	processMessage: function (eventName, flowData, socket, message) {

		var self = this;

		if (this.verbose) console.log ('processMessage', eventName, socket.nsp.name, socket.id, message);

		this.router (eventName, flowData, socket, message);
	},

	defaultRouter: function (eventName, flowData, socket, message) {

		var df = new flow (
			util.extend (true, {}, flowData),
			{
				message: message,
				socket:  socket
			}
		);

		df.on ('completed', this.runPresenter.bind (this, df, 'completed', socket));

		df.on ('failed', this.runPresenter.bind (this, df, 'failed', socket));

		this.emit ("detected", message, socket);

		if (df.ready) df.run();

		return df;
	},

	runPresenter: function (df, state, socket) {

		var self = this;

		if (!df.presenter) return;

		var presenter = df.presenter,
			header,
			vars,
			err;

		try {

			header = (presenter.header.interpolate(df, false, true).length == 0) ?
					presenter.header : presenter.header.interpolate(df);

			vars = presenter.vars.interpolate(df);

		} catch (e) {
			err = {error: 'No message'};
			state = 'failed';
		}

		if (state == 'completed') {

			var msg = header + ':' + JSON.stringify(vars);

			if (presenter.broadcast) {
				self.socketIo.sockets.send(msg);
			} else {
				socket.send(msg);
			}

		} else {

			socket.send('error:'+ JSON.stringify(err));
		}
	}
});
