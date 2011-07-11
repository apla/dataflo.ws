var util = require('util');

var UnitTest = function (config) {
}

UnitTest.prototype = {
	succeds: 0,
	count: 0,
	ok: function (expr, message) {
		this.count ++;
		if (expr) {
			this.succeds ++;
			console.info  ("ok   " + this.count + (
				message ? " " + message : ""
			));
		} else {
			console.error ("fail " + this.count + (
				message ? " " + message : ""
			));
		}
	},
	done: function () {
		if (config.cleanup)
			config.cleanup ();
	}
};

module.exports = UnitTest;

// util.inherits(UnitTest, EventEmitter);