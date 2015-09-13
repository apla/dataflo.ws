var task        = require ('../../task/base'),
	util        = require ('util');

var skipTask = module.exports = function (config) {

	this.request = config.request;
	this.init (config);

};

util.inherits (skipTask, task);

util.extend (skipTask.prototype, {

	run: function () {
		if (this.important)
			this.failed (true);
		this.skipped (true);
	}
});
