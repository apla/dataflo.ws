var EventEmitter = require ('events').EventEmitter,
	task         = require ('task/base'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	urlModel     = require ('model/from-url'),
	mime		 = require ('mime');

var downloadTask = module.exports = function (config) {
	
	this.url = config.url;
	this.init (config);
};

util.inherits (downloadTask, task);

util.extend (downloadTask.prototype, {
	
	run: function () {

		var self = this;
		
		self.download = {};
		self.activityCheck ('task run');
		
		// attach post body to parsed url
		
		self.url = urlUtil.parse(self.url);
		
		if (self.post) {
			self.url.body = self.post;
		}
		
		if (self.headers) {
			self.url.headers = self.headers;
		}
				
		// create model and listen
		
		if (!self.model) {
			
			try {
				self.model = new urlModel (self.url);
				self.url = self.model.url;
				self.model.url.protocol.length;
			} catch (e) {
				self.emitError(e);
				return;
			}
			
			self.model.on ('data', function (chunks) {
				self.activityCheck ('model.fetch data');
			});
			
			self.model.on ('error', function (e) {
				self.emitError(e);
			});
			
			self.model.on ('end', function () {
				
				var originalHeaders = (self.model &&
					self.model.dataSource &&
					self.model.dataSource.res &&
					self.model.dataSource.res.headers) ?
					self.model.dataSource.res.headers : {};
					
				self.download.headers = originalHeaders;
				
				var extentionMatch = self.url.pathname.match(/\.(\w+)$/) || ['','json'];				
				self.download.contentType = originalHeaders['content-type'] || mime.lookup(extentionMatch[1]);
				
				self.clearOperationTimeout();
				
				self.completed (self.download);
			});
			
		}
		
		self.emit ('log', 'start downloading from ' + self.url.href);
		self.activityCheck ('model.fetch start');
		self.model.fetch ({to: self.download});
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