var EventEmitter = require ('events').EventEmitter,
	SocketIo         = require('socket.io'),
	util         = require ('util'),
	workflow     = require ('../workflow'),
	os			 = require ('os');

/**
 * @class initiator.socket
 * @extends events.EventEmitter
 *
 * Initiates WebSocket server-related workflows.
 */
var socket = module.exports = function (config) {
	// we need to launch socket.io
	
	var self = this;
	
	if (!config.port)
		throw "you must define 'port' key for http initiator";
	else 
		this.port  = config.port;
	
	this.workflows = config.workflows;
	
	this.router    = config.router;
	// router is function in main module or initiator method
	if (config.router === void 0) {
		this.router = this.defaultRouter;
	} else if (process.mainModule.exports[config.router]) {
		this.router = process.mainModule.exports[config.router];
	} else if (this[config.router]) {
		this.router = this[config.router];
	} else {
		throw "we cannot find " + config.router + " router method within initiator or function in main module";
	}
	
	// - - - OS detected
	
	this.win = (os.type() == 'Windows_NT');
	
	// - - - start
	
	this.listen();
}

util.inherits (socket, EventEmitter);

util.extend (socket.prototype, {
	
	ready: function () {
		// called from server listen
		console.log('Socket server running on '+(this.port == 80 ? '' : this.port)+' port');		
		this.emit ('ready', this.server);
		
	},
	
	defaultRouter: function (req, res) {
		
		var wf;
		
		var self = this;
		
		if (self.workflows.constructor == Array) {
			
			self.workflows.map (function (item) {
				
				if (wf) return;

				// TODO: make real work
				var match = req.url.pathname.match(item.url);
				
				if (match && match[0] == req.url.pathname) { //exact match
					
					console.log ('socket match: ' + req.method + ' to ' + req.url.pathname);
					wf = true;

				} else if (req.url.pathname.indexOf(item.urlBeginsWith) == 0) {
					console.log ('begins match');
					
					req.pathInfo = req.url.pathname.substr (item.urlBeginsWith.length);
					if (req.pathInfo == '/')
						delete (req.pathInfo);

					if (req.pathInfo && req.pathInfo[0] == '/')
						req.pathInfo = req.pathInfo.substr (1);
					wf = true;
				}
				
				if (!wf) return;

				wf = new workflow (
					util.extend (true, {}, item),
					{request: req, response: res}
				);
				
				wf.on ('completed', function (wf) {
					self.runPresenter (wf, 'completed', res);
				});

				wf.on ('failed', function (wf) {
					self.runPresenter (wf, 'failed', res);
				});

				self.emit ("detected", req, res, wf);
				
				if (!item.prepare && wf.ready) wf.run();
				
				return;

			});
		}
		
		return wf;
	},
	listen: function () {
		
		var self = this;
		
		var socketIo = SocketIo.listen(self.port);
		
		socketIo.disable('log');
		
		socketIo.sockets.on('connection', function (socket) {
  
			console.log('<--------connection', socket.id);

			socket.on('message', function (msg) {
				console.log('<--------message', msg);
			});

			socket.on('disconnect', function () {
				console.log('<--------disconnect', socket.id);
			});
			
			//socket.send('BROADCAST HI', {broadcast: true});
		});
		
		setInterval(function() {
			socketIo.sockets.send('INTERVAL SEND')
		}, 100);

		
/*			// console.log ('serving: ' + req.method + ' ' + req.url + ' for ', req.connection.remoteAddress + ':' + req.connection.remotePort);
//			
//			// here we need to find matching workflows
//			// for received request
//			
//			req.url = url.parse (req.url, true);
//			// use for workflow match
//			req[req.method] = true;
//
//			var wf = self.router (req, res);
//			
//			if (wf && !wf.ready) {
//				console.error ("workflow not ready and cannot be started");
//			}
//			
//			if (!wf) {
//				if (self.static) {
//					
//					var pathName = req.url.pathname;
//					
//					if (self.win) {
//						pathName = pathName.split('/').join('\\');						
//					}
//					
//					if (pathName.match (/\/$/)) {
//						pathName += self.static.index;
//					}
//					
//					var contentType;
//					if (pathName.match (/\.html$/)) {
//						contentType = 'text/html';
//					}
//					
//					if (mime && mime.lookup) {
//						contentType = mime.lookup (pathName);
//					} else if (!contentType) {
//						console.error ('sorry, there is no content type for ' + pathName);
//					}
//
//					self.static.root.fileIO (pathName).readStream (function (readStream, stats) {
//						
//						if (stats) {
//							
//							if (stats.isDirectory() && !readStream) {
//								
//								res.statusCode = 303;
//								res.setHeader('Location', pathName +'/');
//								res.end('Redirecting to ' + pathName +'/');
//								return;
//						
//							} else if (stats.isFile() && readStream) {
//
//								res.writeHead (200, {
//									'Content-Type': contentType + '; charset=utf-8'
//								});
//								readStream.pipe (res);
//								readStream.resume ();
//								return;
//							}
//						}
//						
//						res.statusCode = 404;
//						res.end();
//						
//						console.log ('httpdi not detected: ' + req.method + ' to ' + req.url.pathname);
//						self.emit ("unknown", req, res);
//					});
//				}
//			}
//		});*/
		
		self.ready ();
	}

});
	
