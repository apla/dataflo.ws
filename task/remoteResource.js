var crypto       = require ('crypto'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	querystring  = require ('querystring'),
	task         = require ('./base'),
	path         = require('path'),
	urlModel     = require ('../model/from-url');

var cachePath = project.config.cachePath;

if (!project.caching) {
	project.caching = {};
}

var cacheTask = module.exports = function (config) {

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
		this.cacheFile = project.root.file_io (cachePath, shasum.digest('hex'));
		this.cacheFilePath = this.cacheFile.path;
		this.cacheFileName = path.basename(this.cacheFile.path);

		return this.cacheFilePath;
	}
});

util.extend (cacheTask.prototype, {
	initModel: function () {
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
		
		var contentType = self.url.headers['content-type'],
			postType = Object.typeOf(self.post);
		
		// default object encoding form-urlencoded
		if (!contentType && postType == 'Object') {
			contentType = self.url.headers['content-type']   = 'application/x-www-form-urlencoded';
		} else if (!contentType) {
			contentType = 'undefined';
		}
		
		switch (contentType) {
			
			case 'application/x-www-form-urlencoded':
				self.url.body = querystring.stringify (self.post);
				self.url.headers['content-length'] = self.url.body.length;
				break;
			case 'application/json':
				self.url.body = JSON.stringify (self.jsonData);
				self.url.headers['content-length'] = self.url.body.length;
				break;
			case 'multipart/mixed':
			case 'multipart/alternate':
				self.emitError ('multipart not yet implemented');
				return;
				break;
			case 'undefined':
				self.emitError ('you must define content type when submitting plain string as post data parameter');
				return;
				break;
			case default:
				if (!self.url.headers['content-length']) {
					if (postType == 'String' || postType == 'Buffer') {
						self.url.headers['content-length'] = self.post.length;
					} else {
						self.emitError ('you must define content-length when submitting plain string as post data parameter');
						return;
					}
				}
				break;
		
		}

		self.model = new urlModel(self.url, self);
		self.url = self.model.url;

		self.model.on ('data', function (chunks) {
			self.activityCheck ('model.fetch data');
		});

		self.model.on ('error', function (e) {
			// console.log("%%%%%%%%%%cache failed");
			self.emitError(e);
		});
	},
	isSameUrlLoading : function () {
		var self = this;
		// TODO: another task can download url contents to buffer/file and vice versa
		// other task is caching requested url
		var anotherTask = project.caching[self.cacheFilePath];

		if (anotherTask && anotherTask != self) {

			this.emit ('log', 'another process already downloading ' + this.url.href + ' to ' + this.cacheFilePath);
			// we simply wait for another task
			anotherTask.on ('complete', function (data) {
				// TODO: add headers/contents
				// TODO: check for file state. it is actually closed?
				self.completed (data);
			});
			anotherTask.on ('error', function (e) {
				self.emitError(e);
			});
			return true;
		} else {
			project.caching[self.cacheFilePath] = self;
		}
		return false;
	},
	/**
	 * @method toBuffer
	 * Downloads a given URL into a memory buffer.
	 *
	 * @cfg {String} url (required) A URL to download from.
	 * @cfg {Number} [retries=0] The number of times to retry to run the task.
	 * @cfg {Number} [timeout=10000] Timeout for downloading of each file
	 * (in milliseconds)
	 */
	toBuffer: function () {
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
				delete project.caching[self.cacheFilePath];
				// self.res.cacheFilePath = self.cacheFilePath
				// self.completed (self.res);
				self.finishWith ({data: self.download.data});
			});

		}

		if (self.isSameUrlLoading ())
			return;

		self.emit ('log', 'start caching from ' + self.url.href + ' to ' + self.cacheFilePath);

		self.activityCheck ('model.fetch start');
		self.model.fetch ({to: self.download});
	},

	finishWith: function (result, headers) {
		var self = this;
		if (!headers) {
			headers = (self.model &&
			self.model.dataSource &&
			self.model.dataSource.res &&
			self.model.dataSource.res.headers) ?
			self.model.dataSource.res.headers : {};
		}

		result.headers = headers;

		self.completed (result);
	},
	/**
	 * @method run
	 * Downloads a given URL into a uniquely named file.
	 *
	 * @cfg {String} url (required) A URL to download from.
	 * @cfg {Number} [retries=0] The number of times to retry to run the task.
	 * @cfg {Number} [timeout=10000] Timeout for downloading of each file
	 * (in milliseconds)
	 */
	run: function () {
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
					delete project.caching[self.cacheFilePath];
					// self.res.cacheFilePath = self.cacheFilePath
					// self.completed (self.res);
					self.finishWith ({fileName: self.cacheFileName, filePath: self.cacheFilePath});
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
				delete project.caching[self.cacheFilePath];
				self.finishWith({fileName: self.cacheFileName, filePath: self.cacheFilePath});

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
	},

	emitError: function (e) {
		if (e) {
			this.state = 5;
			this.emit('error', e);
			this.cancel();
			return true;
		} else {
			return false;
		}
	}
});
