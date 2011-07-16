var common       = require ('common'),
	task         = require ('RIA/Workflow/Task'),
	util         = require ('util'),
	qs			 = require ('querystring');


var postTask = module.exports = function (config) {
	
	this.request = config.request;
	this.init (config);
	
};

util.inherits (postTask, task);

common.extend (postTask.prototype, {
	
	run: function () {

		var self = this;
		
		self.data = "";
		
		self.request.on("data", function (chunk) {
			self.data += chunk;
		});
		
		self.request.on("error", function (e) {
			self.emmitError(e);
		});
		
		self.request.on("end", function () {
			self.completed (qs.parse(self.data));
		});
	}
});