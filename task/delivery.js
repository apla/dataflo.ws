var EventEmitter = require ('events').EventEmitter,
	fs           = require ('fs'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	task         = require ('./base'),
	io           = require ('../io/easy'),
	urlModel     = require ('../model/from-url');

var deliveryTask = module.exports = function (config) {

	this.init (config);

};

util.inherits (deliveryTask, task);

util.extend (deliveryTask.prototype, {

	run: function () {

		var self = this;

		self.activityCheck ('delivery.task run');

		this.originalFileName = this.originUrl.substr (this.originUrl.lastIndexOf ('/') + 1);
		if (!this.originalFileName) {this.originalFileName = this.srcName;}

		// create model

		if (!self.model) {

			try {
				self.model = new urlModel (self.url);
				self.url = self.model.url;
				self.model.url.protocol.length;
			} catch (e) {
				self.emitError(e);
				return;
			}

			self.model.timestamp = self.timestamp;

			self.model.on ('data', function (chunk) {
				self.activityCheck ('ftp.store data' + chunk.length);
			});

			self.model.on ('error', function (e) {
				self.emitError(e);
			});

			self.model.on ('end', function () {
				self.clearOperationTimeout();
				self.emit ('log', 'timestamp is: '+self.timestamp);
				self.completed ();
			});
		}

		self.cacheFile = new io (self.cacheFileName);

		self.cacheFile.readStream ({}, function (readStream, stats) {

			if (!readStream) {
				self.clearOperationTimeout();
				self.emitError('readStream is undefined');
				return;
			}

			self.activityCheck ('ftp.store start');
			self.model.store ({
				from: readStream,
				originalFileName: self.originalFileName,
				size: stats.size
			});

		});
	},

	emitError: function (e) {
		if (e) {
			this.state = 5;
			if (this.model) {
				this.model.stop ();
			}
			this.emit('error', e);
			this.cancel();
			return true;
		} else {
			return false;
		}
	}
});
