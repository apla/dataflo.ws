var EventEmitter = require ('events').EventEmitter,
	http         = require ('http'),
	util         = require ('util'),
	workflow     = require ('../workflow'),
	url          = require ('url'),
	os			 = require ('os');

try {
	var mime     = require ('mime');
} catch (e) {
	console.error ('cannot find mime module');
};

/**
 * @class initiator.httpdi
 * @extends events.EventEmitter
 *
 * Initiates HTTP server-related workflows.
 */
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
	
	// - change static root by path
	if (this.static.root && this.static.root.substring) {
		this.static.root = project.root.fileIO (this.static.root);
	}
	
	// - - - prepare configs
	this.prepare = config.prepare;
	
	//
	
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
	
	runPrepare: function (wf, request, response) {
		
		var self = this;
		
		var prepareCfg = wf.prepare,
			prepare    = this.prepare;
		
		if (prepare) {
			
			var wfChain = [];
			
			// create chain of wfs
		
			prepareCfg.forEach(function(p, index, arr) {
				
				var innerWfConfig = prepare[p];
				
				var innerWf = new workflow(innerWfConfig, {
					request: request,
					response: response,
					stage: 'prepare'}
				);
				
				wfChain.push(innerWf);
				
			});
			
			// push main wf to chain
			
			wfChain.push(wf)
			
			// subscribe they
			
			for (var i = 0; i < wfChain.length-1; i++) {
			
				var currentWf = wfChain[i];
				currentWf.nextWf = wfChain[i+1];
				
				currentWf.on('completed', function(cWF) {
					
					setTimeout(cWF.nextWf.run.bind (cWF.nextWf), 0);
				
				});
				
				currentWf.on('failed', function(cWF) {
				
					self.runPresenter(cWF, 'failed');
				
				})
			
			}
			
			wfChain[0].run();
		
		} else {
			
			throw "Config doesn't contain such prepare type: " + wf.prepare;
			
		}
	},

	runPresenter: function (wf, request, response, state) {
		var self = this;
		// presenter can be:
		// {completed: ..., failed: ..., failedRequire: ...} — succeeded or failed tasks in workflow or failed require step
		// "template.name" — template file for presenter
		// {"type": "json"} — presenter config
		// TODO: [{...}, {...}] — presentation workflow

		if (!wf.presenter) return;
		// TODO: emit SOMETHING

		var presenter = wf.presenter;
		
		//console.log ('running presenter on state: ', state, presenter[state]);

		// {completed: ..., failed: ..., failedRequire: ...}
		if (presenter[state])
			presenter = presenter[state];
		
		var tasks = [];

		if (presenter.substring) {
			// "template.name"
			tasks.push ({
				file:      presenter,
				vars:      "{$vars}",
				response:  "{$response}",
				className: "task/presenter"
			});
		} else if (presenter.constructor == Array) {
			// TODO: [{...}, {...}]
			presenter.map (function (item) {
				var task = {};
				util.extend (true, task, item);
				task.response  = "{$response}";
				task.vars      = task.vars || "{$vars}";
				if (!task.functionName)
					task.className = task.className || "task/presenter";
				tasks.push (task);
			});
		} else {
			// {"type": "json"}
			presenter.response  = "{$response}";
			presenter.vars      = presenter.vars || "{$vars}";
			if (!presenter.functionName)
				presenter.className = presenter.className || "task/presenter";
			tasks.push (presenter);
		}

		var presenterWf = new workflow ({
			id:    wf.id,
			tasks: tasks,
			stage: 'presentation'
		}, {
			data:  wf.data,
			error: wf.error,
			request: request,
			response: response
		});

		presenterWf.on ('completed', function () {
			//self.log ('presenter done');
		});

		presenterWf.run ();
	},
	initWorkflow: function (wfConfig, req) {
		
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
					
					console.log ('httpdi match: ' + req.method + ' to ' + req.url.pathname);
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

				wf = self.createWorkflow(item, req, res);
				
				return;
			});
		}
		
		return wf;
	},

	// hierarchical router
	// TODO: igzakt match + pathInfo
	// TODO: dirInfo, fileName, fileExtension, fullFileName
	hierarchical: function (req, res) {
		var self = this;

		var pathes = req.url.pathname.split(/\/+/),
			maxLevel = pathes.length - 1,
			wf = null;

		if (maxLevel > 0 && '' === pathes[maxLevel]) {
			maxLevel -= 1;
		}

		var findPath = function (tree, level) {
			level = level || 1;
			var path = pathes[level];

//			console.log ('matching \"' + (tree.path === void 0 ? tree.pattern : tree.path) + '\" at level ' + level + ' for \"' + path + '\"');
			
			/* Exact match. */
			var match = path === tree.path;

			/* Pattern match. */
			if (!match && 'pattern' in tree) {
				var match = path.match (tree.pattern);
			}

			if (match) {
				if (match.constructor === Array && match.length > 1) {
					if (!req.capture)
						req.capture = [];
					var capture = match;
					match = capture.shift();
					req.capture = req.capture.concat (capture);
				}

				if (level >= maxLevel) {
					var theWf = self.createWorkflow(tree, req, res);
					if (theWf) {
						wf = theWf
					} else {
						match = false;
					}
				} else if (tree.workflows) {
					var foundPath = tree.workflows.filter (function (node) {
						if (node.path !== void 0)
							return findPath(node, level + 1);
					});
					if (!foundPath || !foundPath[0]) {
						tree.workflows.filter (function (node) {
							if (node.pattern)
								return findPath(node, level + 1);
						});
					}
				}
			}

			return match;
		};

		var foundPath = this.workflows.filter (function (tree) {
			if (tree.path !== void 0)
				return findPath(tree);
		});

		if (!foundPath || !foundPath[0]) {
			this.workflows.filter (function (tree) {
				if (tree.pattern)
					return findPath(tree);
			});
		}
		return wf;
	},

	createWorkflow: function (cfg, req, res) {
		var self = this;

		// task MUST contain tasks or presenter
		if (!cfg.tasks && !cfg.presenter)
			return;
		
		console.log('httpdi match: ' + req.method + ' to ' + req.url.pathname);

		var wf = new workflow(
			util.extend (true, {}, cfg),
			{ request: req, response: res }
		);
		
		wf.on('completed', function (wf) {
			self.runPresenter(wf, req, res, 'completed');
		});

		wf.on('failed', function (wf) {
			self.runPresenter(wf, req, res, 'failed');
		});

		self.emit('detected', req, res, wf);

		if (cfg.prepare) {
			self.runPrepare(wf, req, res);
		} else {
			wf.run();
		}

		return wf;
	},

	listen: function () {
		
		var self = this;
	
		this.server = http.createServer (function (req, res) {
			
			// console.log ('serving: ' + req.method + ' ' + req.url + ' for ', req.connection.remoteAddress + ':' + req.connection.remotePort);
			
			// here we need to find matching workflows
			// for received request
			
			req.url = url.parse (req.url, true);
			// use for workflow match
			req[req.method] = true;

			var wf = self.router (req, res);
			
			if (wf && !wf.ready) {
				console.error ("workflow not ready and cannot be started");
			}
			
			if (!wf) {
				if (self.static) {
					
					var pathName = req.url.pathname;
					
					if (self.win) {
						pathName = pathName.split('/').join('\\');						
					}
					
					if (pathName.match (/\/$/)) {
						pathName += self.static.index;
					}
					
					var contentType, charset;
					if (pathName.match (/\.html$/)) {
						contentType = 'text/html';
						charset = 'utf-8';
					}
					
					if (mime && mime.lookup) {
						contentType = mime.lookup (pathName);
						charset = mime.charsets.lookup(contentType);
						if (charset) contentType += '; charset='+charset;
					} else if (!contentType) {
						console.error ('sorry, there is no content type for ' + pathName);
					}

					self.static.root.fileIO (pathName).readStream (function (readStream, stats) {
						
						if (stats) {
							
							if (stats.isDirectory() && !readStream) {
								
								res.statusCode = 303;
								res.setHeader('Location', pathName +'/');
								res.end('Redirecting to ' + pathName +'/');
								return;
						
							} else if (stats.isFile() && readStream) {

								res.writeHead (200, {
									'Content-Type': contentType
								});
								readStream.pipe (res);
								readStream.resume ();
								return;
							}
						}
						
						res.statusCode = 404;
						res.end();
						
						console.log ('httpdi not detected: ' + req.method + ' to ' + req.url.pathname);
						self.emit ("unknown", req, res);
					});
				}
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
	
