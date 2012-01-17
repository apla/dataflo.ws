var task         = require ('task/base'),
	util         = require ('util');

try {
	var jade         = require ('jade');
} catch (e) {
	// console.log ('jade not available');
}

var presenterTask = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (presenterTask, task);

var cache = {};

util.extend (presenterTask.prototype, {
	readTemplate: function (templateIO, cb) {
		templateIO.readFile (function (err, data) {
			cb.call (this, err, data);
		});
	
	},
	run: function () {

		var self = this;
		
		if (!this.type) {
			// guess on file name
			this.type = this.file.match(".*\\.(.*)$")[1];
			console.log ('guessed ' + this.type + ' presenter type from filename: ' + this.file);
		}

		if (this.type == 'jade') {
			self.response.setHeader("Content-Type", (this.contentType || 'text/html') + '; charset=utf-8');
			var templateIO = project.root.fileIO (this.file);
			// TODO
			//if (cache {this.template}) {
			//	templateIO.stat
			//}
			self.readTemplate (templateIO, function (err, data) {
				if (err) {
					console.error ("can't access " + self.file + " file. create one and define project id");
					process.kill ();
					return;
				};
				var fn = jade.compile(data, {});
				self.response.end (fn (self.vars));
				self.completed ();

			});

		} else if (this.type == 'json') {
			self.response.setHeader("Content-Type", 'application/json; charset=utf-8');
			self.response.end (JSON.stringify (self.vars));
			self.completed ();
		} else  if (this.type == 'asis') {
			self.response.setHeader ("Content-Type", self.contentType);
			self.response.end (self.vars);
			self.completed ();
		}		
	}
});
