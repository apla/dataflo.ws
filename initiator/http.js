var EventEmitter = require ('events').EventEmitter,
	http         = require ('http'),
	util         = require ('util'),
	mime         = require ('mime'),
	workflow     = require ('workflow'),
	url          = require ('url'),
	os			 = require ('os');

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
	
	// - - - OS detected
	
	this.win = (os.type() == 'Windows_NT');
}

util.inherits (httpdi, EventEmitter);

util.extend (httpdi.prototype, {
	ready: function () {
		// called from server listen
		console.log('Server running at http://'+(this.host ? this.host : '127.0.0.1')+(this.port == 80 ? '' : ':'+this.port)+'/');
		
		this.emit ('ready', this.server);
		
	},
	runPresenter: function (wf, state, res) {
		var self = this;
		// presenter can be:
		// {success: ..., failed: ..., failedRequire: ...} — succeeded or failed tasks in workflow or failed require step
		// "template.name" — template file for presenter
		// {"type": "json"} — presenter config
		// TODO: [{...}, {...}] — presentation workflow

		if (!wf.presenter) return;
		// TODO: emit SOMETHING

		// self.log ('running presenter');
		
		var presenter = wf.presenter;

		// {success: ..., failed: ..., failedRequire: ...}
		if (presenter[state])
			presenter = presenter[state];
		
		var tasks = [];

		if (presenter.substring) {
			// "template.name"
			tasks.push ({
				file:      presenter,
				vars:      "{$vars}",
				response:  "{$response}",
				className: "presenter"
			});
		} else if (presenter.constructor == Array) {
			// TODO: [{...}, {...}]
			presenter.map (function (item) {
				var task = {};
				util.extend (true, task, item);
				task.response  = "{$response}";
				task.vars      = task.vars || "{$vars}";
				task.className = task.className || "presenter";
				tasks.push (task);
			});
		} else {
			// {"type": "json"}
			presenter.response  = "{$response}";
			presenter.vars      = presenter.vars || "{$vars}";
			presenter.className = presenter.className || "presenter";
			tasks.push (presenter);
		}

		var presenterWf = new workflow ({
			id:    wf.id,
			data:  wf.data,
			vars:  wf,
			tasks: tasks,
			stage: 'presentation',
			response: res
		});

		presenterWf.on ('complete', function () {
			//self.log ('presenter done');
		});

		presenterWf.run ();
	},
	listen: function () {
		
		var self = this;
	
		this.server = http.createServer (function (req, res) {
			
			// console.log ('serving: ' + req.method + ' ' + req.url + ' for ', req.connection.remoteAddress + ':' + req.connection.remotePort);
			
			// here we need to find matching workflows
			// for received request
			
			req.url = url.parse(req.url, true);
			
			var wf;
			
			self.workflows.map (function (item) {
				
				if (wf) return;

				// TODO: make real work
				var match = req.url.pathname.match(item.url);
				
				if (match && match[0] == req.url.pathname) { //exact match
					
					console.log ('match');
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
				
				if (!item.auth) wf.run();
				
				return;

			});
			
			if (!wf) {
				if (self.static) {
					
					var pathName = req.url.pathname;
					
					if (self.win) {
						pathName = pathName.split('/').join('\\');						
					}
					
					if (pathName.match (/\/$/)) {
						pathName += self.static.index;
					}
					var contentType = mime.lookup (pathName);

					self.static.root.fileIO (pathName).readStream (function (readStream, stats) {
						
						if (stats) {
							res.writeHead (200, {
								'Content-Type': contentType + '; charset=utf-8'
							});
							readStream.pipe (res);
							readStream.resume ();
						} else {
							res.writeHead (404, {});
							res.end();
						}
					});
					
					return;
				}
				
				console.log ('not detected');
				self.emit ("unknown", req, res);
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
	
