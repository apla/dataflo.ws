define(function(require, exports, module) {

var EventEmitter = require ('events').EventEmitter,
	workflow     = require ('workflow');

var callbacki = module.exports = function (config) {
	var self = this;
	
	this.workflows = config.workflows;
}

util.inherits (callbacki, EventEmitter);

util.extend (callbacki.prototype, {
	prepare: function () {
		this.emit ('ready');
		
	},
	
	process: function (token, request) {
		
		var self = this;
		
		var wf;
		
		self.workflows.map (function (item) {
			
			var match = (token == item.token);
			
			if (match) { //exact match
				
				wf = new workflow (
					util.extend (true, {}, item),
					{request: request}
				);

				self.emit ("detected", request, wf);
				if (item.autoRun || item.autoRun == void 0)
					wf.run();
				
				return;
			}
		});
		
		if (!wf)
			self.emit ("unknown", request, wf);
		
		return wf;
	}
});

return callbacki;

});