var task        = require ('../../task/base'),
	util        = require ('util');

var okTask = module.exports = function (config) {

	this.request = config.request;
	this.init (config);

};

util.inherits (okTask, task);

var timerHandles = {};

util.extend (okTask.prototype, {

	start: function (args) {
		var timeout = this.$args.timeout || 100;

		if (!timerHandles[this.id]) {
			timerHandles[this.id] = {times: 0};
		}

		var handle = timerHandles[this.id];

		if (handle.times < this.$args.times) {
			handle.times ++;
		} else {
			timeout = 0;
		}

		handle.timerId = setTimeout (function () {
			this.completed (true);
			delete timerHandles[this.id];
		}.bind (this), timeout);

	},

	cancel: function (args) {
		var handle = timerHandles[this.id];
		if (handle)
			clearTimeout (handle.timerId);
	}
});
