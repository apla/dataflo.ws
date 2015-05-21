var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	flow         = require ('../flow');

var timeri = module.exports = function (config) {
	var self = this;

	// here we must define what timer events we must watch:
	// 1. at precise time - unix time (precise: 1223312333221312) ???
	// 2. once after timeout, in milliseconds (timeout: 2000)
	// 3. using interval, in milliseconds (every: 1000)

	this.flows = config.workflows || config.dataflows || config.flows;

	this.ready ();
}

util.inherits (timeri, EventEmitter);

timeri.prototype.ready = function () {

	var self = this;

	self.flows.map(function (flowParams) {

		var dfCycle = {};

		dfCycle.run = function (rerun) {

			var wf = new flow (
				util.extend (true, {}, flowParams),
				{
					timestamp: Date.now()
				}
			);

			if (rerun) {

				wf.on ('completed', function () {
						dfCycle.end();
				});

				wf.on ('failed', function () {
						dfCycle.end();
				});

			}

			wf.runDelayed ();

		};

		dfCycle.end = function() {

			setTimeout(function() {
				dfCycle.run(true);
			}, flowParams.interval);

		};

		if (flowParams.interval) {

			if (flowParams.startRun) {

				if (flowParams.delay) {

					setTimeout (function() {
						dfCycle.run(true);
					}, flowParams.delay);

				} else {

					dfCycle.run(true);

				}

			} else {
				dfCycle.end();
			}

		} else if (flowParams.timeout) {

			setTimeout (function() {

				dfCycle.run(false);

			}, flowParams.timeout);

		}
	});

	self.emit ('ready', this);
}
