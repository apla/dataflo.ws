var task = require ('dataflo.ws/task/base'),
	util = require ('util'),
	exec = require ('child_process').exec;

var execTask = module.exports = function (config) {
		this.init (config);
};

util.inherits (execTask, task);
util.extend (execTask.prototype, {
	run: function () {
		var self = this;
		var args = self.args || self.$args || [];
		var options = self.options || [];

		var cmd = self.command + ' ' + args.join(' ');

		exec(cmd, options, function(error, stdout, stderr) {
			if (error) {
				self.failed(stderr);
			} else {
				self.completed(stdout || self.returnAnything);
			}
		});
	}
});

