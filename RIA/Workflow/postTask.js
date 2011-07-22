var task         = require ('RIA/Workflow/Task'),
	util         = require ('util'),
	qs			 = require ('querystring');


var postTask = module.exports = function (config) {
	
	this.request = config.request;
	this.init (config);
	
};

util.inherits (postTask, task);

util.extend (postTask.prototype, {
	
	run: function () {
		
		// TODO: add data limit
		
		var self = this;
		
		self.data = "";
		
		self.request.on("data", function (chunk) {
			self.data += chunk;
		});
		
		self.request.on("error", function (e) {
			self.emmitError(e);
		});
		
		// TODO: file uploads
		
		self.request.on("end", function () {
			var parsedData;
			if (self.dumpData) {
				self.emit ('log', self.data);
			}
			
			if (self.jsonEncoded) {
				parsedData = JSON.parse (self.data);
			} else {
				parsedData = qs.parse (self.data);
			}
			
			self.completed (parsedData);
		});
	}
});