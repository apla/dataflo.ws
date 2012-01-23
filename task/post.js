var task        = require ('task/base'),
	util        = require ('util'),
	qs			= require ('querystring'),
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
		
		if (self.request.method != 'POST' && self.request.method != 'PUT')
			return self.skipped ();

		var form = new formidable.IncomingForm();
		form.parse(self.request, function(err, fields, files) {
			
			if (err) {
				self.failed (err);
				return;
			}
			
			var body = {fields: fields, files: files};
			self.request.body = body;
			
			console.log ('<---------', body);
			
			self.completed (body);
		});
	}
});
