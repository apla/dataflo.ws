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
	this.wfRequire = config.wfRequire || {time: new Date()};

	this.ready ();
}

util.inherits (timeri, EventEmitter);

util.extend (timeri.prototype, {

	ready: function () {

		var self = this;

		self.workflows.map(function (workflowParams) {

			var closure = function () {

				var workflow = new workflow (
					util.extend (true, {}, workflowParams),
					self.wfRequire
				);

				workflow.run ();

			};

			if (workflowParams.interval) {

				setInterval (closure, workflowParams.interval);
				if (workflowParams.startRun) setTimeout(closure, 0);

			} else if (workflowParams.timeout) {

				setTimeout (closure, workflowParams.timeout);

			}
		});

		self.emit ('ready', this);
	}
});
