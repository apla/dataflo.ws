var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	flow         = require ('../flow');

var tokenInitiator = module.exports = function (config) {
	var self = this;

	this.flows = config.workflows || config.dataflows || config.flows;
}

util.inherits (tokenInitiator, EventEmitter);

util.extend (tokenInitiator.prototype, {
	prepare: function () {
		this.emit ('ready');

	},

	process: function (token, dfRequire) {

		var self = this;

		var dfConf;

		if (self.flows.constructor === Array) {
			self.flows.map (function (item) {

				var match = (token == item.token);

				if (match) { //exact match
					dfConf = item;
				}
			});
		} else { // assume object
			dfConf = self.flows[token];
		}

		if (!dfConf) {
			self.emit ("unknown", dfRequire);
			return;
		}

		var df = new flow (
			util.extend (true, {}, dfConf),
			dfRequire
		);

		self.emit ("detected", dfRequire, df);
		if (dfConf.autoRun || dfConf.autoRun == void 0 || dfRequire.autoRun || dfRequire.autoRun == void 0)
			df.run ();

		if (!df) {
			self.emit ("unknown", dfRequire);
			return;
		}

		return df;
	}
});

});
