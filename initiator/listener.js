
var spawn = require('child_process').spawn;

RIA.Initiator.Listener = function (config) {

	var self = this;

	// we need detectIP because by default httpd listen on 127.0.0.1
	this.detectIP = function (cb) {

		var child = spawn('ifconfig');

		var stderr = '';
		var stdout = '';

		child.stdout.on('data', function (data) {
			stdout += data;
		});

		child.stderr.on('data', function (data) {
			stderr += data;
		});

		child.on('exit', function (code) {

			try {
				stdout.match (/^\s+inet\s+\d+\.\d+\.\d+\.\d+/mg).map (function (item) {
					var ip = item.match (/\d+\.\d+\.\d+\.\d+/)[0];
					if (ip != '127.0.0.1') {
						throw ip;
					}
				});
			} catch (e) {
				self.host = e
			}

			cb.call (self);
		});
	}

};