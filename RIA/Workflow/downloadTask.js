var EventEmitter = require ('events').EventEmitter,
	task         = require ('RIA/Workflow/Task'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	urlModel     = require ('RIA/Model/FromURL');

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
				self.clearOperationTimeout();
				self.completed (self.download.data);				
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