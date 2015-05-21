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
var SocketInitiator = module.exports = function (config, initiators) {
	// we need to launch socket.io

	// initiators start in random order. socket.io
	// can launch in dependent mode from httpdi,
	// so we need to start socket.io after httpdi gets initialized
	process.nextTick (this.init.bind (this, config, initiators));
}

SocketInitiator.connections = {};

util.inherits (SocketInitiator, EventEmitter);

SocketInitiator.prototype.init = function (config, initiators) {

	if (config.useHttpServer) {
		this.httpServer = initiators.http.server;
	} else if (config.port) {
		this.port  = config.port;
	} else {
		throw "you must define 'port' key or use existing http initiator ('useHttpServer' key) for socket.io";
	}

	this.opts = config.opts || {};

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
	this.timer  = config.timer;
	this.router = config.router;

	// router is function in main module or initiator method

	if (config.router === undefined) {
		this.router = this.defaultRouter;
	} else if (process.mainModule.exports[config.router]) {
		this.router = process.mainModule.exports[config.router];
	} else if (self[config.router]) {
		this.router = this[config.router];
	} else {
		throw "we cannot find " + config.router + " router method within initiator or function in main module";
	}

	// - - - start

	this.listen();

}

SocketInitiator.prototype.listen = function () {

	var self = this;

	var socketIo = self.socketIo = SocketIo (this.httpServer || this.port, this.opts);

		if (!this.verbose) {
			// have no effect on new socket.io
			if (socketIo.disable) socketIo.disable('log');
		}

		Object.keys (this.flows).forEach (function (flowName) {
			var flowUrl = flowName[0] === '/' ? flowName : '/' + flowName;
			var flowConnection = socketIo.of (flowUrl).on ('connection', function (socket) {
				if (this.verbose) console.log ('new socket.io connection ' + socket.id + ', scope: ' + socket.nsp.name);

				//SocketInitiator.connections[socket.nsp.name] = socket;

				if (this.flows[flowName].events) {
					Object.keys (this.flows[flowName].events).forEach (function (eventName) {
						socket.on (eventName, this.processMessage.bind (this, eventName, this.flows[flowName].events[eventName], socket));
					}.bind (this));
				} else {
					socket.on ('message', this.processMessage.bind (this, 'message', this.flows[flowName], socket));
				}

				socket.on ('disconnect', function () {
					if (this.verbose) console.log ('socket.io client disconnected ' + socket.id);
					//delete SocketInitiator.connections[socket.nsp.name];
				}.bind (this));
			}.bind (this));
			SocketInitiator.connections[flowUrl] = flowConnection;
		}.bind (this));


	if (this.httpServer) {
		console.log ('socket.io server is attached to http initiator');
	} else {
		console.log ('socket.io server is running on ' + this.port + ' port');
	}

	this.emit ('ready', this);
}

SocketInitiator.prototype.processMessage = function (eventName, flowData, socket, message) {

		var self = this;

		if (this.verbose) console.log ('processMessage', eventName, socket.nsp.name, socket.id, message);

		this.router (eventName, flowData, socket, message);
	}

SocketInitiator.prototype.defaultRouter = function (eventName, flowData, socket, message) {

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

		if (df.ready) df.runDelayed ();

		return df;
	}

SocketInitiator.prototype.runPresenter = function (df, state, socket) {

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

