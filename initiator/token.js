var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	flow         = require ('../flow');

/**
 * @class initiator.token
 * @extends events.EventEmitter
 *
 * This is a basic initiator. Actually, this initiator launch dataflow when
 * control code is calling this initiator directly.
 */

var tokenInitiator = module.exports = function (config) {
	var self = this;

	this.flows = config.workflows || config.dataflows || config.flows;
}

util.inherits (tokenInitiator, EventEmitter);

tokenInitiator.prototype.prepare = function () {
	this.emit ('ready');
}

tokenInitiator.prototype.process = function (token, dfRequire) {

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
	if (dfConf.autoRun || dfConf.autoRun === undefined || dfRequire.autoRun || dfRequire.autoRun === undefined)
		df.runDelayed ();

	if (!df) {
		self.emit ("unknown", dfRequire);
		return;
	}

	return df;
}

});
