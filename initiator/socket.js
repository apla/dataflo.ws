var EventEmitter = require ('events').EventEmitter,
	SocketIo     = require('socket.io'),
	util         = require ('util'),
	workflow     = require ('../workflow');

/**
 * @class initiator.socket
 * @extends events.EventEmitter
 *
 * Initiates WebSocket server-related workflows.
 */
var socket = module.exports = function (config) {
	// we need to launch socket.io
	
	var self = this;
	
	if (!config.port) {
		throw "you must define 'port' key for http initiator";
	} else {
		this.port  = config.port;
	}
		
	self.workflows = config.workflows;
	self.timer = config.timer;
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

util.inherits (socket, EventEmitter);

util.extend (socket.prototype, {

	listen: function () {
		
		var self = this;
		
		var socketIo = self.socketIo = SocketIo.listen(self.port);
		
		socketIo.disable('log');
		
		socketIo.sockets.on('connection', function (socket) {
  
			console.log('Socket server connection ' + socket.id);

			socket.on('message', function(msg) {
				self.processMessage(socket, msg);
			});
 
			socket.on('disconnect', function () {
				console.log('Socket server disconnection ' + socket.id);
			});
		});
		
		console.log('Socket server running on ' + self.port + ' port');		
		
		self.emit ('ready', this.server);
	},
	
	processMessage: function (socket, message) {
	
		console.log('processMessage', socket.id, message);
		
		var re = /^([A-Z0-9a-z\/]+)(:(.+))?$/;
		var match = message.match(re);
		
		if (match && match[1]) {
		
			var route = match[1];
			var rawData = match[3],
				data = {};
			
			if (rawData) {
				try {
					data = JSON.parse(rawData);
				} catch (e) {
					data.raw = rawData;
				}
			}
				
			var query = {
				route: route,
				data: data
			};
			
			this.router(query, socket);
			
		} else {
			console.log('Socket initiator: Strange formatted message');
		}		
	},
		
	defaultRouter: function (query, socket) {
		
		var self = this,
			wf,
			route = query.route;
		
		if (self.workflows.constructor == Array) {
			
			self.workflows.every (function (item) {
				
				var match = route.match(item.route);
				
				if (match && match[0] == route) { //exact match
					
					console.log ('socket match to ' + route);

					wf = new workflow (
						util.extend (true, {}, item),
						{query: query}
					);
					
					wf.on ('completed', function (wf) {
						self.runPresenter (wf, 'completed', socket);
					});

					wf.on ('failed', function (wf) {
						self.runPresenter (wf, 'failed', socket);
					});

					self.emit ("detected", query, socket);
					
					if (wf.ready) wf.run();
					
					return false;
				}
				
				return true;

			});
			
			if (!wf) {
				self.emit ("unknown", query, socket);
			}
		}
		
		return wf;
	},
	
	runPresenter: function (wf, state, socket) {

//		{
//			"presenter": {
//				"broadcast": true,
//				"header": "/entity/states/get"
//				"vars": "{$query.data}"
//			}
//		}

		var self = this;

		if (!wf.presenter) return;
		
		var presenter = wf.presenter,
			header = (presenter.header.interpolate(wf, true) == void 0) ? 
				presenter.header : presenter.header.interpolate(wf),
			vars = presenter.vars.interpolate(wf);
		
		if (state == 'completed') {
			
			var msg = header + ':' + JSON.stringify(vars);
			
			if (presenter.broadcast) {
				self.socketIo.sockets.send(msg);
			} else {
				socket.send(msg);
			}
			
		} else {
			
			socket.send('error');
		}
	}
});