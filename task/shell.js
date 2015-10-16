var spawn = require ('child_process').spawn,
	fs    = require ('fs'),
	task  = require ('./base'),
	util  = require ('util');

/**
 * Run shell script
 */

var shellTask = module.exports = function (config) {
	this.init (config);
};

util.inherits(shellTask, task);

util.extend(shellTask.prototype, {
	/**
	 * Run shell command
	 *
	 * @param {Object} env - environment, parameters passed as environment to shell
	 * @param {String} commandString - command for shell
	 * @param {Boolean} [strictEnv=false] - don't copy env from process.env
	 * @param {Boolean} [splitStrings=false] - split strings at output
	 * @param {String} [result=output] - what result you need? you can choose between `output`, `exitCode` and `success`
	 * @api public
	 */
	run: function () {
		var self = this;
		var env = {};
		if (!this.strictEnv) {
			for (var k in process.env) {
				env[k] = process.env[k];
			}
		}
		for (k in self.env) {
			env[k] = self.env[k];
		}

		var shellOutput = '';
		var shell = spawn('/bin/sh', ['-c', this.commandString], {
			env: env, stdio: ['pipe', 'pipe', 2]
		});

		shell.stdout.on('data', function (data) {
			shellOutput += data;
		});

		shell.on('close', function (code) {
			if (self.result == "exitCode") {
				self.completed (code);
				return;
			}
			if (code !== 0) {
				console.log('shell process exited with code ' + code);
				self.failed (); // this is for both results: success and output
				return;
			} else if (self.result == "success") {
				self.completed(true);
				return;
			}
			if (self.splitStrings) {
				var dataForHandler = shellOutput.replace("\r", "").split("\n")
				//dataForHandler.pop();
				self.completed (dataForHandler);
			} else {
				self.completed (shellOutput);
			};
		});
		//child.stdout.on('data', function(data) { process.stdout.write(data); });
	}
});

module.exports = shellTask;
