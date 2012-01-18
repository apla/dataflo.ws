var task        = require ('task/base'),
	util        = require ('util'),
	formidable  = require ('formidable');


var postTask = module.exports = function (config) {
	
	this.request = config.request;
	this.init (config);
	
};

util.inherits (postTask, task);

util.extend (postTask.prototype, {
	
	run: function () {
		
		// TODO: add data limit
		
		var self = this;
		
		// TODO: emit skipped state
		if (self.request.method != 'POST' && self.request.method != 'PUT')
			return self.completed ({});

		var form = new formidable.IncomingForm();
		form.parse(self.request, function(err, fields, files) {
			if (err) {
				self.failed (err);
				return;
			}
			self.completed ({fields: fields, files: files});
		});
	}
});
