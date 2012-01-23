var task = require('task/base'),
	util = require('util'),
	workflow = require('workflow');

// - - - -

var innerWF = module.exports = function(config) {

	this.init (config);		

};

util.inherits (innerWF, task);

util.extend (innerWF.prototype, {

	run: function () {
		
		var self = this;
		
		console.log (self.workflowConfig);
		
		var wf = new workflow(self.workflowConfig, {request: self.request, response: self.response});
		
		wf.on('completed', function() {
			
			self.completed(true);
			
		});
		
		wf.on('failed', function() {
			
			self.failed('workflow(' + wf.id + ') failed');
			
		});
		
		wf.run();
		
	}
});