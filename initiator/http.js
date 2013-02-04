var EventEmitter = require ('events').EventEmitter,
	http         = require ('http'),
	util         = require ('util'),
	workflow     = require ('../workflow'),
	common       = require('../common'),
	url          = require ('url'),
	path         = require ('path'),
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
var httpdi = module.exports = function httpdIConstructor (config) {
	// we need to launch httpd

	var self = this;

	this.host = config.host;
	if (!config.port)
		throw "you must define 'port' key for http initiator";
	else
		this.port  = config.port;

	this.workflows = config.workflows;
	this.static    = config.static || {};

	// - change static root by path
	this.static.root = project.root.fileIO(this.static.root || 'htdocs');

	// - - - prepare configs
	this.prepare = config.prepare;

	//

	if (config.router && process.mainModule.exports[config.router]) {
		this.router = process.mainModule.exports[config.router];
	} else {
		this.router = this.defaultRouter;
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

httpdi.prototype.ready = function () {
	// called from server listen
	console.log(
		'Server running at http://'
		+(this.host ? this.host : '127.0.0.1')
		+(this.port == 80 ? '' : ':'+this.port)+'/'
	);

	this.emit ('ready', this.server);
}

httpdi.prototype.runPrepare = function (wf, request, response) {
	
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
				var presenter = self.createPresenter(cWF, 'failed');
				if (presenter)
					presenter.run ();
			})

		}

		wfChain[0].run();

	} else {

		throw "Config doesn't contain such prepare type: " + wf.prepare;

	}
}


httpdi.prototype.createPresenter = function (wf, request, response, state) {
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

	if (Object.is('String', presenter)) {
		// "template.name"
		tasks.push ({
			file:      presenter,
			//vars:      "{$vars}",
			response:  "{$response}",
			$class: "task/presenter"
		});
	} else if (Object.is('Array', presenter)) {
		// TODO: [{...}, {...}]
		presenter.map (function (item) {
			var task = {};
			util.extend (true, task, item);
			task.response  = "{$response}";
			task.vars      = task.vars || {};
			if (!task.functionName || !task.$function) {
				task.className = task.$class || task.className ||
					"task/presenter";
			}
			tasks.push (task);
		});
	} else {
		// {"type": "json"}
		presenter.response  = "{$response}";
		presenter.vars      = presenter.vars || {};
		if (!presenter.functionName || !presenter.$function) {
			presenter.className = presenter.$class || presenter.className ||
				"task/presenter";
		}
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

	return presenterWf;
}

httpdi.prototype.createWorkflow = function (cfg, req, res) {
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
		var presenter = self.createPresenter(wf, req, res, 'completed');
		if (presenter)
			presenter.run ();
	});

	wf.on('failed', function (wf) {
		self.createWorkflowByCode(req, res) || (function () {
			var presenter = self.createPresenter(wf, req, res, 'failed');
			if (presenter)
				presenter.run ();
		}());
	});

	self.emit('detected', req, res, wf);

	if (cfg.prepare) {
		self.runPrepare(wf, req, res);
	} else {
		wf.run();
	}

	return wf;
}

httpdi.prototype.createWorkflowByCode = function (req, res) {
	// find a workflow w/ presenter by HTTP response code
	if (!this.workflows._codeWorkflows) {
		this.workflows._codeWorkflows = {};
	}
	if (!(res.statusCode in this.workflows._codeWorkflows)) {
		this.workflows._codeWorkflows[
			res.statusCode
		] = this.workflows.filter(function (wf) {
			return wf.code == res.statusCode;
		})[0];
	}
	var codeWf = this.workflows._codeWorkflows[res.statusCode];
	if (codeWf) {
		if (!codeWf.tasks) { codeWf.tasks = []; }
		this.createWorkflow(codeWf, req, res);
		return true;
	}
	return false;
};

httpdi.prototype.initWorkflow = function (wfConfig, req) {
};

// hierarchical router
// TODO: igzakt match + pathInfo
// TODO: dirInfo, fileName, fileExtension, fullFileName
httpdi.prototype.hierarchical = function (req, res) {
	var pathName = req.url.pathname;

	// strip trailing slashes
	if (pathName.length > 1) {
		pathName = pathName.replace(/\/+$/, '');
	}

	var pathParts = pathName.split(/\/+/).slice(1);

	var capture = [];
	var config = this.hierarchical.findByPath(
		this, pathParts, 0, capture
	);

	if (config) {
		req.capture = capture;
		return this.createWorkflow(config, req, res);
	}
	return null;
};

httpdi.prototype.defaultRouter = httpdi.prototype.hierarchical;

httpdi.prototype.hierarchical.walkList = function (
	list, pathParts, level, callback
) {
	var pathLen = pathParts.length;
	var listLen = list && list.length;
	outer: for (var i = 0; i < listLen; i += 1) {
		var tree = list[i];

		for (var j = pathLen; j > level; j -= 1) {
			var pathFragment = pathParts.slice(level, j).join('/');

			if (callback(tree, pathFragment, j - 1)) {
				break outer;
			}
		}
	}
};

httpdi.prototype.hierarchical.findByPath = function (
	tree, pathParts, level, capture
) {
	var list = tree.workflows;
	var checkedLevel = level;
	var branch = null;

	// exact match
	this.walkList(
		list, pathParts, level,
		function (tree, pathFragment, index) {
			//console.print('PATH', tree.path, 'FRAGMENT', pathFragment);
			if (tree.path == pathFragment) {
				checkedLevel = index;
				branch = tree;
				return true;
			}
			return false;
		}
	);

	// pattern match
	!branch && this.walkList(
		list, pathParts, level,
		function (tree, pathFragment, index) {
			//console.print('PATTERN', tree.pattern, 'FRAGMENT', pathFragment);
			var match = tree.pattern && pathFragment.match(tree.pattern);
			if (match) {
				checkedLevel = index;
				branch = tree;
				capture.push.apply(capture, match.slice(1));
				return true;
			}
			return false;
		}
	);

	if (checkedLevel >= pathParts.length - 1) {
		return branch;
	} else {
		return branch && this.findByPath(
			branch, pathParts, checkedLevel + 1, capture
		);
	}
};

httpdi.prototype.listen = function () {

	var self = this;

	this.server = http.createServer (function (req, res) {
		req.pause ();
		// console.log ('serving: ' + req.method + ' ' + req.url + ' for ', req.connection.remoteAddress + ':' + req.connection.remotePort);

		// here we need to find matching workflows
		// for received request

		req.url = url.parse (req.url, true);
		// use for workflow match
		req[req.method] = true;
		
		// NOTE: we don't want to serve static files using nodejs.
		// NOTE: but for rapid development this is acceptable.
		// NOTE: you MUST write static: false for production
		if (self.static && req.method == 'GET') {
			// TODO: factor out static file handling
			// - - - - -
			var pathName = path.join(
				self.static.root.path,
				path.join('.', req.url.pathname),
				/\/$/.test(req.url.pathname) ? self.static.index : ''
			);

			var contentType, charset;
			if ('.html' == path.extname(pathName)) {
				contentType = 'text/html';
				charset = 'utf-8';
			}

			if (mime && mime.lookup) {
				contentType = mime.lookup (pathName);
				charset = mime.charsets.lookup(contentType);
				if (charset) contentType += '; charset='+charset;
			} else if (!contentType) {
				console.error(
					'sorry, there is no content type for %s', pathName
				);
			}

			var file = project.root.fileIO(pathName);
			file.readStream (function (readStream, stats) {

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

				// TODO: factor this out
				// - - - - -
				var wf = self.router (req, res);

				if (wf && !wf.ready) {
					console.error ("workflow not ready and cannot be started");
				}

				if (!wf) {
					res.statusCode = 404;

					console.log ('httpdi not detected: ' + req.method + ' to ' + req.url.pathname);
					self.emit ("unknown", req, res);
					self.createWorkflowByCode(req, res) || res.end();
				}
				// - - - - - end of router creation
			});
			// - - - - - end of static file handling
		} else {
			// TODO: factor this out
			// - - - - -
			var wf = self.router (req, res);

			if (wf && !wf.ready) {
				console.error ("workflow not ready and cannot be started");
			}

			if (!wf) {
				res.statusCode = 404;
				res.end();

				console.log ('httpdi not detected: ' + req.method + ' to ' + req.url.pathname);
				self.emit ("unknown", req, res);
				self.createWorkflowByCode(req, res) || res.end();
			}
			// - - - - - end of router creation
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
