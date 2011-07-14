var common       = require ('common'),
	task         = require ('RIA/Workflow/Task'),
	util         = require ('util');

var renderTask = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (renderTask, task);

common.extend (renderTask.prototype, {
	
	run: function () {

		var self = this;
		
		if (this.type == 'json') {
			self.output.setHeader("Content-Type", "text/json; charset=utf-8");
//			self.emit ('log', 'data: ' + JSON.stringify(self.data));
//			self.emit ('log', 'out: ' + JSON.stringify(self.output));
			self.output.end (JSON.stringify(self.data));
			self.completed ();
		}
		
	}
});