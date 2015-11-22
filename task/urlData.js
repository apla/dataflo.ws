var crypto   = require ('crypto'),
	util     = require ('util'),
	urlUtil  = require ('url'),
	path     = require ('path'),
	os       = require ('os'),
	task     = require ('./base'),
	urlModel = require ('../model/from-url'),
	io       = require ('fsobject');


var cacheTask = module.exports = function (config) {

	try {
		if (typeof project === "undefined") {
			// var hash = crypto.createHash('md5').update(sketchFolder).digest('hex');
			//	console.log(hash); // 9b74c9897bac770ffc029102a200c5de

			this.cachePath = new io (os.tmpdir()) // path.join (os.tmpdir(), hash.substr (0, 8));
		} else {
			if (!project.config.cachePath) {
				console.log ('cachePath not defined in project config!');
			}
			this.cachePath = project.root.file_io (project.config.cachePath);
		}

		if (!cacheTask.caching) {
			cacheTask.caching = {};
		}
	} catch (e) {
		console.log (e);
	}


	this.url = config.url;

	this.init (config);

	if (!this.timeout)
		this.timeout = 10000;

};

util.inherits (cacheTask, task);

util.extend (cacheTask.prototype, {
	/**
	 * Generates file name as a hash sum
	 * based on the cached file original URL.
	 */
	generateCacheFileName: function () {

		if (this.cacheFilePath)
			return this.cacheFilePath;

		var shasum = crypto.createHash('sha1');
		shasum.update (this.url.href);
		if (this.bodyData) shasum.update (JSON.stringify (this.bodyData));

		// TODO: any request excluding GET must contain random number

		this.cacheFile = this.cachePath.file_io (shasum.digest('hex'));
		this.cacheFilePath = this.cacheFile.path;
		this.cacheFileName = path.basename(this.cacheFile.path);

		return this.cacheFilePath;
	}
});

cacheTask.prototype.initModel = function () {
	var self = this;

	if (Object.is('String', this.url)) {
		try {
			this.url = urlUtil.parse(this.url, true);
		} catch (e) {
			this.emitError(e);
			return;
		}
	}

	if (!this.url.href) {
		this.url.href = urlUtil.format (this.url);
	}

	this.url.headers = this.headers || {};

	this.model = new urlModel (this.url, this);
	this.url = this.model.url;

	this.model.proxy = this.proxy;

	// TODO: check for data amount periodically, say, in 1 second
//	this.model.on ('data', function (chunks) {
//		this.activityCheck ('model.fetch data');
//	}.bind (this));

	this.model.on ('progress', function (current, total) {
		this.activityCheck ('model.fetch data');
		this.emit ('progress', current, total);
	}.bind (this));

		// self.model.on ('error', function (e, data) {
		// 	// console.log("%%%%%%%%%%cache failed");
		// 	self.emitError(e, data);
		// });
	this.model.on ('error', function (error) {
//			console.log (error);
		this.clearOperationTimeout();
		this.finishWith (error, 'failed');
	}.bind (this));

}

cacheTask.prototype.isSameUrlLoading = function () {
	var self = this;
	// TODO: another task can download url contents to buffer/file and vice versa
	// other task is caching requested url
	var anotherTask = cacheTask.caching[self.cacheFilePath];

		if (anotherTask && anotherTask != self) {

			this.emit ('log', 'another process already downloading ' + this.url.href + ' to ' + this.cacheFilePath);
			// we simply wait for another task
			anotherTask.on ('complete', function (data) {
				// TODO: add headers/contents
				// TODO: check for file state. it is actually closed?
				self.completed (data);
			});
			anotherTask.on ('error', function (e, data) {
				self.emitError(e, data);
			});
			return true;
		} else {
			cacheTask.caching[self.cacheFilePath] = self;
		}
		return false;
	};

cacheTask.prototype.activityCheck = function (place) {
	var self = this;

	self.clearOperationTimeout();

	self.timeoutId = setTimeout(function () {
		self.state = 5;
		self.emit (
			'log', 'timeout is over for ' + place + ' operation'
		);
		self.model.stop ('timeout');
//		self._cancel();

	}, self.timeout);

}

/**
 * @method toBuffer
 * Downloads a given URL into a memory buffer.
 *
 * @cfg {String} url (required) A URL to download from.
 * @cfg {Number} [retries=0] The number of times to retry to run the task.
 * @cfg {Number} [timeout=10000] Timeout for downloading of each file
 * (in milliseconds)
 * @cfg {String} [successCodes="200"] (HTTP only) Success status codes (example: "2xx,4xx")
 * otherwise task will fail
 * @cfg {String|Object} bodyData (HTTP only) POST body, can be string (raw POST data)
 * or object (urlencoded query)
 * @cfg {String} headers (HTTP only) HTTP headers for request
 * @cfg {String} auth (HTTP only) basic auth
 */
cacheTask.prototype.toBuffer = function () {
		var self = this;

		self.download = {};

		self.activityCheck ('task run');

		// create model and listen
		// model is a class for working with particular network protocol
		// WHY? why model can be defined?
		if (!self.model) {

			// console.log("self.model.url -> ", self.url.fetch.uri);
			self.initModel ();
			self.model.on ('end', function () {
				/*var srcName = self.model.dataSource.res.headers['content-disposition'].match(/filename=\"([^"]+)/)[1];
				self.res = {};
				self.res.srcName = srcName ? srcName : "";
				console.log("self.res -> ", self.res);*/
				self.clearOperationTimeout();
				// self.res.cacheFilePath = self.cacheFilePath
				// self.completed (self.res);
				self.finishWith ({
					data: self.download.data
				});
			});

			// model error handling at @method initModel
		}

		self.emit ('log', 'start loading from ' + self.url.href + ' to memory buffer');

		self.activityCheck ('model.fetch start');
		self.model.fetch ({to: self.download});
	};

cacheTask.prototype.finishWith = function (result, method, metaJSON) {
		var self = this;
		var model = self.model,
			ds;

	var meta;
	if (metaJSON) {
		meta = JSON.parse (metaJSON);
	}

		if (model)
			ds = self.model.dataSource;
		if (ds && ds.addResultFields) {
			ds.addResultFields (result, meta);
		}

//		method = method || 'completed';
	if (!method)
		if (ds && ds.isSuccessResponse && ds.isSuccessResponse ()) {
			method = 'completed';
		} else {
			method = 'failed';
		}

		self[method] (result);
	};
/**
 * @method toFile
 * Downloads a given URL into a uniquely named file.
 *
 * @cfg {String} url (required) A URL to download from.
 * @cfg {Number} [retries=0] The number of times to retry to run the task.
 * @cfg {Number} [timeout=10000] Timeout for downloading of each file
 * (in milliseconds)
 * @cfg {String} [successCodes="200"] Success HTTP status codes (example: "2xx,4xx")
 * otherwise task will fail
 * @cfg {String|Object} bodyData (HTTP only) POST body, can be string (raw POST data)
 * or object (urlencoded query)
 * @cfg {String} headers (HTTP only) HTTP headers for request
 * @cfg {String} auth (HTTP only) basic auth
 */
cacheTask.prototype.toFile = function () {
		var self = this;

		self.activityCheck ('task run');

		// create model and listen
		// model is a class for working with particular network protocol
		// WHY? why model can be defined?
		if (!self.model) {

			// console.log("self.model.url -> ", self.url.fetch.uri);
			self.initModel ();
			self.model.on ('end', function () {
				/*var srcName = self.model.dataSource.res.headers['content-disposition'].match(/filename=\"([^"]+)/)[1];
				self.res = {};
				self.res.srcName = srcName ? srcName : "";
				console.log("self.res -> ", self.res);*/
				self.clearOperationTimeout();
				self.cacheFile.chmod (0640, function (err) {
					// TODO: check for exception (and what's next?)
					delete cacheTask.caching[self.cacheFilePath];
					// self.res.cacheFilePath = self.cacheFilePath
					// self.completed (self.res);
					self.finishWith ({
						fileName: self.cacheFileName,
						filePath: self.cacheFilePath
					});
				});
				var metaFile = new io (self.cacheFilePath+'.meta');
				metaFile.writeFile (JSON.stringify ({
					code: self.model.dataSource.res.statusCode,
					headers: self.model.dataSource.res.headers,
					url: self.model.url.href,
					urlFileName: path.basename (self.model.url.href)
				}, null, "\t"));
			});
		}

		this.generateCacheFileName ();

		if (self.isSameUrlLoading ())
			return;

		self.cacheFile.stat (function (err, stats) {

			if (err || ! (stats.mode & 0644 ^ 0600)) {
				return self.cacheMiss ();
			}

			var metaFile = new io (self.cacheFilePath+'.meta');
			metaFile.readFile (function (err, contents) {

				if (err) {
					return self.cacheMiss ();
				}

				try {
					var js = JSON.parse (contents);
				} catch (e) {
					return self.cacheMiss ();
				}

				self.clearOperationTimeout();

				self.emit ('log', 'file already downloaded from ' + self.url.href + ' to ' + self.cacheFilePath);
				delete cacheTask.caching[self.cacheFilePath];

				self.finishWith ({
					fileName: self.cacheFileName,
					filePath: self.cacheFilePath,
				}, 'completed', contents);
			});
		});
	};

cacheTask.prototype.cacheMiss = function () {
	try {
		var writeStream = this.cacheFile.writeStream ({
			flags: 'w', // constants.O_CREAT | constants.O_WRONLY
			mode: 0600
		});
		writeStream.on ('error', function (err) {
			this.emit ('log', 'write error: ' + err);
			writeStream.end();
		});
	} catch (e) {
		this.emit ('log', 'cannot open for write: ' + this.cacheFilePath);
		this.emitError(e);
		return;
	}

	this.emit ('log', 'start caching from ' + this.url.href + ' to ' + this.cacheFilePath);

	this.activityCheck ('model.fetch start');
	this.model.fetch ({to: writeStream});
}

cacheTask.prototype.run = cacheTask.prototype.toFile;

cacheTask.prototype.emitError = function (e, data) {
		if (e) {
			this.finishWith (data || e, 'failed');
			return true;
		} else {
			return false;
		}
	}
