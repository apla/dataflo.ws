var EventEmitter = require ('events').EventEmitter,
	http         = require ('http'),
	util         = require ('util'),
	flow         = require ('dataflo.ws/flow'),
	common       = require ('dataflo.ws/common'),
	url          = require ('url'),
	path         = require ('path'),
	os           = require ('os');
	log          = require ('dataflo.ws/log');

try {
	var mime     = require ('mime');
} catch (e) {
	console.error (log.c.red('cannot find mime module'));
};

/**
 * @class initiator.httpdi
 * @extends events.EventEmitter
 *
 * Initiates HTTP server-related dataflows.
 */
var httpdi = module.exports = function httpdIConstructor (config) {
	// we need to launch httpd

	var self = this;

	this.host = config.host;
	if (!config.port)
		throw "you must define 'port' key for http initiator";
	else
		this.port  = config.port;

	this.flows  = config.workflows || config.dataflows || config.flows;

	// I don't want to serve static files by default
	if (config.static) {
		this.static = config.static == true ? {} : config.static;
		// - change static root by path
		this.static.root = project.root.fileIO(this.static.root || 'www');
		this.static.headers = this.static.headers || {};
	}

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
		'HTTP initiator running at',
		log.path (
			'http://'
			+(this.host ? this.host : '127.0.0.1')
			+(this.port == 80 ? '' : ':'+this.port)+'/'
		)
	);

	this.emit ('ready', this.server);
}

httpdi.prototype.runPrepare = function (df, request, response) {

	var self = this;

	var prepareCfg = df.prepare,
		prepare    = this.prepare;

	if (prepare) {

		var dfChain = [];

		// create chain of wfs

		var prepareFailure = false;

		prepareCfg.forEach(function(p, index, arr) {

			var innerDfConfig = prepare[p];

			if (!innerDfConfig || !innerDfConfig.tasks) {
				console.error (log.c.red('request canceled:'), 'no prepare task named "'+p+'"');
				prepareFailure = true;
				var presenter = self.createPresenter({}, request, response, 'failed');
				if (presenter)
					presenter.run ();
				return;
			}

			var innerDf = new flow(innerDfConfig, {
				request: request,
				response: response,
				stage: 'prepare'}
			);

			dfChain.push(innerDf);

		});

		if (prepareFailure) {
			return;
		}

		// push main df to chain

		dfChain.push(df)

		// subscribe they

		for (var i = 0; i < dfChain.length-1; i++) {

			var currentDf = dfChain[i];
			currentDf.nextDf = dfChain[i+1];

			currentDf.on('completed', function(cDF) {
				setTimeout(cDF.nextDf.run.bind (cDF.nextDf), 0);
			});

			currentDf.on('failed', function(cDF) {
				var presenter = self.createPresenter(cDF, request, response, 'failed');
				if (presenter)
					presenter.run ();
			})

		}

		dfChain[0].run();

	} else {

		throw "Config doesn't contain such prepare type: " + df.prepare;

	}
}


httpdi.prototype.createPresenter = function (df, request, response, state) {
	var self = this;
	// presenter can be:
	// {completed: ..., failed: ..., failedRequire: ...} — succeeded or failed tasks in dataflow or failed require step
	// "template.name" — template file for presenter
	// {"type": "json"} — presenter config
	// TODO: [{...}, {...}] — presentation dataflow

	if (!df.presenter) {
		this.finishRequest (response);
		return
	};
	// TODO: emit SOMETHING

	var presenter = df.presenter;

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
			$class: "presenter",
			$important: true
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
					"presenter";
				task.$important = true;
			}
			tasks.push (task);
		});
	} else {
		// {"type": "json"}
		presenter.response  = "{$response}";
		presenter.vars      = presenter.vars || {};
		if (!presenter.functionName || !presenter.$function) {
			presenter.className = presenter.$class || presenter.className ||
				"presenter";
			presenter.$important = true;
		}
		tasks.push (presenter);
	}

	var reqParams = util.extend(true, {
		error: df.error,
		request: request,
		response: response
	}, df.data);

	var presenterDf = new flow ({
		id:    df.id,
		tasks: tasks,
		stage: 'presentation'
	}, reqParams);

	presenterDf.on ('completed', function () {
		//self.log ('presenter done');
		self.finishRequest (response);
	});

	presenterDf.on ('failed', function () {
		presenterDf.log ('Presenter failed: ' + request.method + ' to ' + request.url.pathname);
		var df500 = self.createFlowByCode(500, request, response);
		if (df500) {
			df500.on ('completed', self.finishRequest.bind (self, response));
			df500.on ('failed',    self.finishRequest.bind (self, response));
		} else {
			self.finishRequest (response);
		}
	});

	return presenterDf;
}

httpdi.prototype.finishRequest = function (res) {
	if (!res.finished)
		res.end ();
}

httpdi.prototype.createFlow = function (cfg, req, res) {
	var self = this;

	if (cfg.static) {
		return false;
	}

	// task MUST contain tasks or presenter
	if (!cfg.tasks && !cfg.presenter)
		return;

	console.log ('dataflow', req.method, req.url.pathname);

	var df = new flow(
		util.extend (true, {}, cfg),
		{ request: req, response: res }
	);

	df.on('completed', function (df) {
		var presenter = self.createPresenter(df, req, res, 'completed');
		if (presenter) {
			presenter.run ();
		}
	});

	df.on('failed', function (df) {

		var presenter = self.createPresenter(df, req, res, 'failed');
		if (presenter) {
			presenter.run ();
		}

	});

	self.emit('detected', req, res, df);

	if (cfg.prepare) {
		self.runPrepare(df, req, res);
	} else {
		df.run();
	}

	return df;
}

httpdi.prototype.createFlowByCode = function (code, req, res) {
	res.statusCode = code;
	// find a flow w/ presenter by HTTP response code
	if (!this.flows._codeFlows) {
		this.flows._codeFlows = {};
	}
	if (!(res.statusCode in this.flows._codeFlows)) {
		this.flows._codeFlows[
			res.statusCode
		] = this.flows.filter(function (df) {
			return df.code == res.statusCode;
		})[0];
	}
	var codeDfConfig = this.flows._codeFlows[res.statusCode];
	if (codeDfConfig) {
		if (!codeDfConfig.tasks) { codeDfConfig.tasks = []; }
		var df = this.createFlow(codeDfConfig, req, res);
		if (df) {
			df.on ('completed', this.finishRequest.bind (this, res));
			df.on ('failed',    this.finishRequest.bind (this, res));
			return true;
		}
	}

	this.finishRequest (res);
	return false;
};

httpdi.prototype.initFlow = function (wfConfig, req) {
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
		return this.createFlow(config, req, res);
	}
	return null;
};

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
	var list = tree.workflows || tree.dataflows || tree.flows;
	var checkedLevel = level;
	var branch = null;

	// exact match
	this.walkList(
		list, pathParts, level,
		function (tree, pathFragment, index) {
			// console.print('PATH', tree.path, 'FRAGMENT', pathFragment);
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
			// console.print('PATTERN', tree.pattern, 'FRAGMENT', pathFragment);
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

	if ((branch && branch.static && checkedLevel >= 0) || checkedLevel >= pathParts.length - 1) {
		return branch;
	} else {
		return branch && this.findByPath(
			branch, pathParts, checkedLevel + 1, capture
		);
	}
};

httpdi.prototype.defaultRouter = httpdi.prototype.hierarchical;

httpdi.prototype.httpDate = function (date) {
	date = date || new Date ();
	var fstr = "%a, %d %b %Y %H:%M:%S UTC";
	var utc  = 'getUTC';
	//utc = utc ? 'getUTC' : 'get';
	var shortDayNames = 'Sun Mon Tue Wed Thu Fri Sat'.split (' ');
	var shortMonNames = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split (' ');
	return fstr.replace (/%[YmdHMSab]/g, function (m) {
		switch (m) {
			case '%Y': return date[utc + 'FullYear'] (); // no leading zeros required
			case '%m': m = 1 + date[utc + 'Month'] (); break;
			case '%d': m = date[utc + 'Date'] (); break;
			case '%H': m = date[utc + 'Hours'] (); break;
			case '%M': m = date[utc + 'Minutes'] (); break;
			case '%S': m = date[utc + 'Seconds'] (); break;
			case '%a': return shortDayNames[date[utc + 'Day'] ()]; // no leading zeros required
			case '%b': return shortMonNames[date[utc + 'Month'] ()]; // no leading zeros required
			default: return m.slice (1); // unknown code, remove %
		}
		// add leading zero if required
		return ('0' + m).slice (-2);
	});
}

httpdi.prototype.findHandler = function (req, res) {
	var df = this.router (req, res);

	if (df && !df.ready) {
		console.error ("flow not ready and cannot be started");
	}

	if (!df) {
		// console.log ('httpdi not detected: ' + req.method + ' to ' + req.url.pathname);
		this.emit ("unknown", req, res);

		// NOTE: we don't want to serve static files using nodejs.
		// NOTE: but for rapid development this is acceptable.
		// NOTE: you MUST write static: false for production
		if (this.static) {
			this.handleStatic (req, res);
		} else {
			this.createFlowByCode (404, req, res) || res.end();
		}

	}

}

httpdi.prototype.handleStatic = function (req, res) {
	var self = this;
	var pathName = path.join (
		self.static.root.path,
		path.join('.', req.url.pathname),
		/\/$/.test(req.url.pathname) ? self.static.index : ''
	);

	console.log ('filesys ', req.method, req.url.pathname);

	var contentType, charset;
	// make sure html return fast as possible
	// if ('.html' == path.extname(pathName)) {
	// 	contentType = 'text/html';
	// 	charset = 'utf-8';
	// } else
	if (mime && mime.lookup) {
		contentType = mime.lookup (pathName);
		// The logic for charset lookups is pretty rudimentary.
		if (contentType.match (/^text\//))
			charset = mime.charsets.lookup(contentType, 'utf-8');
		if (charset) contentType += '; charset='+charset;
	} else if (!contentType) {
		console.error(
			'sorry, there is no content type for %s', pathName
		);
	}

	var file = project.root.fileIO(pathName);
	var fileOptions = {flags: "r"};

	var statusCode = 200;
	var start = 0;
	var end   = 0;
	var rangeHeader = req.headers['range'];
	if (rangeHeader != null) {
		// console.log (rangeHeader);
		var range = rangeHeader.split ('bytes=')[1].split ('-');
		start = parseInt(range[0]);
		end   = parseInt(range[1]);
		if (!isNaN(start)) {
			if (!isNaN(end) && start > end) {
				// error, return 200
			} else {
				statusCode = 206;
				fileOptions.start = start;
				if (!isNaN(end))
					fileOptions.end = end;
				// console.log (
				// 	'Browser requested bytes from %d to %d of file %s',
				// 	start, end, file.name
				// );


			}
		}
	}

	file.readStream (fileOptions, function (readStream, stats) {

		if (!stats) {
			self.createFlowByCode (404, req, res);
			return;
		}

		// if (isNaN(end) || end == 0) end = stat.size-1;
		if (stats.isDirectory() && !readStream) {

			res.statusCode = 303;
			res.setHeader('Location', req.url.pathname +'/');
			res.end('Redirecting to ' + req.url.pathname +'/');
			return;

		} else if (stats.isFile() && readStream) {
			var headers = {};

			var uri = req.url.pathname;
			while (uri.length > 1) {
				var h = self.static.headers[uri];
				headers = util.extend(headers, h || {});
				uri = path.dirname(uri);
			}

			var headersExtend = {
				'Content-Type': contentType,
				'Content-Length': stats.size,
				'Date': self.httpDate (stats.mtime),
			};

			if (project.config.debug) {
				headersExtend['Cache-Control'] = 'no-store, no-cache';
			}

			if (statusCode == 206) {
				end = fileOptions.end ? fileOptions.end : stats.size-1;
				headersExtend['Content-Range'] = 'bytes '
					+fileOptions.start+'-'
					+(end)+'/'+stats.size;
				headersExtend["Accept-Ranges"]  = "bytes";
				headersExtend["Content-Length"] = end - fileOptions.start + 1;

				// console.log (headersExtend);
			}

			headers = util.extend (headers, headersExtend);

			req.on('close', function() {
				readStream.destroy();
			});

			res.writeHead (statusCode, headers);
			readStream.pipe (res);
			readStream.resume ();
			return;
		}

		self.handleFileStream (stats, readStream, req, res);
	});

}

httpdi.prototype.listen = function () {

	var self = this;

	this.server = http.createServer (function (req, res) {
		req.pause ();
		// console.log ('serving: ' + req.method + ' ' + req.url + ' for ', req.connection.remoteAddress + ':' + req.connection.remotePort);

		// here we need to find matching flows
		// for received request

		req.url = url.parse (req.url, true);
		// use for flow match
		req[req.method] = true;

		self.findHandler (req, res);
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
