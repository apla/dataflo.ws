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
	
		self.workflows.map (function (item) {
			
			var match = token.match (item.token);
			
			if (match) { //exact match
				
				console.log ('match');
				self.emit ("detected", request, item);

				var wf = new workflow (
					util.extend (true, {}, item),
					{request: request}
				);
				wf.run();
				
				return;
			}
		});
	}
});