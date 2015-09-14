var task        = require ('../../task/base'),
	util        = require ('util');

var okTask = module.exports = function (config) {

	this.request = config.request;
	this.init (config);

};

util.inherits (okTask, task);

// not suitable for real work
var times = 0;
var timerId = null;

util.extend (okTask.prototype, {

	start: function (args) {
		var timeout = this.$args.timeout || 100;
		if (times < this.$args.times) {
			times ++;
		} else {
			timeout = 0;
		}

		timerId = setTimeout (function () {
			this.completed (true);
		}.bind (this), timeout);

	},

	cancel: function (args) {
		clearTimeout (timerId);
	},

	reset: function () {
		times = 0;
		this.completed (true);
	}
});
