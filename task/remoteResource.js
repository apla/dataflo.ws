var crypto   = require ('crypto'),
	util     = require ('util'),
	urlUtil  = require ('url'),
	path     = require ('path'),
	os       = require ('os'),
	task     = require ('./base'),
	urlModel = require ('../model/from-url'),
	io       = require ('../io/easy');


var cacheTask = module.exports = function (config) {

	try {
		if (typeof project === "undefined") {
			// var hash = crypto.createHash('md5').update(sketchFolder).digest('hex');
			//	console.log(hash); // 9b74c9897bac770ffc029102a200c5de

			this.cachePath = new io (os.tmpdir()) // path.join (os.tmpdir(), hash.substr (0, 8));
		} else {
			this.cachePath = project.root.file_io (project.config.cachePath);
		}

		if (!cacheTask.caching) {
			cacheTask.caching = {};
		}
	} catch (e) {
	}


	this.url = config.url;

	this.init (config);

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
		shasum.update(this.url.href);
		this.cacheFile = this.cachePath.file_io (shasum.digest('hex'));
		this.cacheFilePath = this.cacheFile.path;
		this.cacheFileName = path.basename(this.cacheFile.path);

		return this.cacheFilePath;
	}
});

cacheTask.prototype.initModel = function () {
		var self = this;

		if (Object.is('String', self.url)) {
			try {
				self.url = urlUtil.parse(self.url, true);
			} catch (e) {
				self.emitError(e);
				return;
			}
		}

		self.url.headers = self.headers || {};

		self.model = new urlModel (self.url, self);
		self.url = self.model.url;

		self.model.on ('data', function (chunks) {
			self.activityCheck ('model.fetch data');
		});

		// self.model.on ('error', function (e, data) {
		// 	// console.log("%%%%%%%%%%cache failed");
		// 	self.emitError(e, data);
		// });
		self.model.on ('error', function (error) {
//			console.log (error);
			self.clearOperationTimeout();
			self.finishWith (error, 'failed');
		});

	};
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

cacheTask.prototype.finishWith = function (result, method) {
		var self = this;
		var model = self.model,
			ds;

		if (model)
			ds = self.model.dataSource;
		if (ds && ds.addResultFields) {
			ds.addResultFields (result);
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
			});
		}

		this.generateCacheFileName ();

		if (self.isSameUrlLoading ())
			return;

		self.cacheFile.stat (function (err, stats) {

			if (!err && (stats.mode & 0644 ^ 0600)) {

				self.clearOperationTimeout();

				self.emit ('log', 'file already downloaded from ' + self.url.href + ' to ' + self.cacheFilePath);
				delete cacheTask.caching[self.cacheFilePath];
				self.finishWith({
					fileName: self.cacheFileName,
					filePath: self.cacheFilePath
				});

				return;
			}

			try {
				var writeStream = self.cacheFile.writeStream ({
					flags: 'w', // constants.O_CREAT | constants.O_WRONLY
					mode: 0600
				});
			} catch (e) {
				self.emitError(e);
				return;
			}

			self.emit ('log', 'start caching from ' + self.url.href + ' to ' + self.cacheFilePath);

			self.activityCheck ('model.fetch start');
			self.model.fetch ({to: writeStream});
		});
	};

cacheTask.prototype.run = cacheTask.prototype.toFile;

cacheTask.prototype.emitError = function (e, data) {
		if (e) {
			this.finishWith (data || e, 'failed');
			return true;
		} else {
			return false;
		}
	}
