var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	workflow     = require ('../workflow');

var callbacki = module.exports = function (config) {
	var self = this;

	this.flows = config.workflows || config.flows;
}

util.inherits (callbacki, EventEmitter);

util.extend (callbacki.prototype, {
	prepare: function () {
		this.emit ('ready');

	},

	process: function (token, wfRequire) {

		var self = this;

		var wfConf;

		if (self.flows.constructor === Array) {
			self.flows.map (function (item) {

				var match = (token == item.token);

				if (match) { //exact match
					wfConf = item;
				}
			});
		} else { // assume object
			wfConf = self.flows[token];
		}
		
		if (!wfConf) {
			self.emit ("unknown", wfRequire);
			return;
		}

		var wf = new workflow (
			util.extend (true, {}, wfConf),
			wfRequire
		);

		self.emit ("detected", wfRequire, wf);
		if (wfConf.autoRun || wfConf.autoRun == void 0 || wfRequire.autoRun || wfRequire.autoRun == void 0)
			wf.run ();

		if (!wf) {
			self.emit ("unknown", wfRequire);
			return;
		}

		return wf;
	}
});

});
