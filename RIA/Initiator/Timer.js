var EventEmitter   = require ('events').EventEmitter,
	common         = require ('common'),
	Workflow       = require ('RIA/Workflow');

var timeri = module.exports = function (config) {
	var self = this;
	
	// here we must define what timer events we must watch:
	// 1. at precise time - unix time (precise: 1223312333221312) ???
	// 2. once after timeout, in milliseconds (timeout: 2000)
	// 3. using interval, in milliseconds (every: 1000)
	
	if (!config.conf)
		throw "you must define 'config' for timer initiator";
	
	this.workflows = config.workflows;
	
	this.ready ();
}

util.inherits (amqpi, EventEmitter);

common.extend (amqpi.prototype, {
	
	ready: function () {
		
		var self = this;
				
		self.workflows.map(function (workflowParams) {
			
			// TODO: workflow manager for workflows running more time than interval

			var workflow = new Workflow (
				common.extend (true, {}, workflowParams),
				{request: {time: new Date()}}
			);
			
			if (workflowParams.interval) {
				setInterval (function () {
					workflow.run ();
				}, workflowParams.interval);
			} else if (workflowParams.timeout) {
				setTimeout (function () {
					workflow.run ();
				}, workflowParams.timeout);
			}
		});
		
	}
});