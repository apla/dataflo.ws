var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	workflow     = require ('../workflow');

var timeri = module.exports = function (config) {
	var self = this;

	// here we must define what timer events we must watch:
	// 1. at precise time - unix time (precise: 1223312333221312) ???
	// 2. once after timeout, in milliseconds (timeout: 2000)
	// 3. using interval, in milliseconds (every: 1000)

	this.workflows = config.workflows;
	
	this.ready ();
}

util.inherits (timeri, EventEmitter);

timeri.prototype.ready = function () {

	var self = this;

	self.workflows.map(function (workflowParams) {
		
		var wfCycle = {};
		
		wfCycle.run = function (rerun) {
			
			var wf = new workflow (
				util.extend (true, {}, workflowParams),
				{
					timestamp: Date.now()
				}
			);
			
			if (rerun) {
			
				wf.on ('completed', function () {
						wfCycle.end();
				});
					
				wf.on ('failed', function () {
						wfCycle.end();
				});
			
			}

			wf.run ();

		};
		
		wfCycle.end = function() {
			
			setTimeout(function() {
				wfCycle.run(true);
			}, workflowParams.interval);
			
		};

		if (workflowParams.interval) {

			if (workflowParams.startRun) {
				
				if (workflowParams.delay) {
					
					setTimeout (function() {
						wfCycle.run(true);
					}, workflowParams.delay);
					
				} else {
				
					wfCycle.run(true);
					
				}
				
			} else {
				wfCycle.end();
			}

		} else if (workflowParams.timeout) {

			setTimeout (function() {
				
				wfCycle.run(false);
				
			}, workflowParams.timeout);

		}
	});

	self.emit ('ready', this);
}