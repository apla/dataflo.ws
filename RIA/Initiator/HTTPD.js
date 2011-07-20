var EventEmitter = require ('events').EventEmitter,
	http         = require ('http'),
	util         = require ('util'),
	mime         = require ('mime'),
	Workflow     = require ('RIA/Workflow');

var httpdi = module.exports = function (config) {
	// we need to launch httpd
	
	var self = this;
	
	this.host = config.host;
	if (!config.port)
		throw "you must define 'port' key for http initiator";
	else 
		this.port  = config.port;
	
	this.workflows = config.workflows;
	this.static    = config.static;
	
	if (this.host  == "auto") {
		this.detectIP (this.listen);
	} else {
		this.listen ();
	}
}

util.inherits (httpdi, EventEmitter);

util.extend (httpdi.prototype, {
	ready: function () {
		// called from server listen
		console.log('Server running at http://'+(this.host ? this.host : '127.0.0.1')+(this.port == 80 ? '' : ':'+this.port)+'/');
		
		this.emit ('ready', this.server);
		
	},
	
	listen: function () {
		
		var self = this;
	
		this.server = http.createServer (function (req, res) {
			
			console.log ('serving: ' + req.url);
			
			// here we need to find matching workflows
			// for received request
			
			req.url = require('url').parse(req.url, true);
			
			var workflow;
			
			self.workflows.map (function (item) {
				// TODO: make real work
				if (item.url == req.url.pathname) {
					console.log ('match');
					self.emit ("detected", req, res, item);

					workflow = new Workflow (
						util.extend (true, {}, item),
						{request: req, response: res}
					);
					workflow.run();
					
					return;

				} else if (req.url.pathname.indexOf(item.urlBeginsWith) == 0) {
					console.log ('begins match');
					req.pathInfo = req.url.pathname.substr (item.urlBeginsWith.length);
					self.emit ("detected", req, res, item);
					
					workflow = new Workflow (
						util.extend (true, {}, item),
						{request: req, response: res}
					);
					workflow.run();
					
					return;

				}
			});
			
			if (!workflow) {
				if (self.static) {
					var pathName = req.url.pathname;
					if (pathName.match (/\/$/)) {
						pathName += self.static.index;
					}
					var contentType = mime.lookup (pathName);

					// charset for video? cool!
					res.writeHead (200, {
						'Content-Type': contentType + '; charset=utf-8'
					});
					
					self.static.root.fileIO (pathName).readStream (function (readStream, stats) {
						readStream.pipe (res);
						readStream.resume ();
					});
					
					return;
				}
				
				console.log ('not detected');
				self.emit ("undefined", req, res);
			}
			
		});
		
		if (this.host)
			this.server.listen (this.port, this.host, function () {
				self.ready ()
			});
		else
			this.server.listen (this.port, function () {
				self.ready ()
			})
	}

});
