var fs = require('fs'),
	path = require('path'),
	util = require('util'),
	common = require('../common'),
	task = require ('./base');

var $global = common.$global;

var FileTask = function (cfg) {
	this.init(cfg);
};

util.inherits (FileTask, task);

util.extend(FileTask.prototype, {
	run: function () {
		this.read();
	},

	read: function () {
		var self = this;
		var filePath = path.resolve($global.project.root.path, this.filePath);

		fs.readFile(filePath, function (err, data) {
			if (err) {
				self.failed(err);
			} else {
				self.completed(data);
			}
		});
	},

	write: function () {
		var self = this;
		var filePath = path.resolve($global.project.root.path, this.filePath);

		fs.writeFile(filePath, this.fileData, function (err) {
			if (err) {
				self.failed(err);
			} else {
				self.completed(filePath);
			}
		});
	},
	copy: function () {
	},
	remove: function () {
	},

	rename: function () {
		var self = this;
		var src = path.resolve($global.project.root.path, this.filePath);
		var dst = path.resolve($global.project.root.path, this.to);

		fs.rename (src, dst, function (err) {
			if (err.code !== 'EXDEV') {
				self.failed(err);
			} else {
				// TODO: move to copy task
				// rename file between fs boundsries
				var readStream = fs.createReadStream (src);
				readStream.on ('open', function (rdid) {
					// TODO: check for null id
					readStream.pause();
					var writeStream = fs.createWriteStream (dst);
					writeStream.on ('open', function (wrid) {
						// TODO: check for null id
						readStream.pipe (writeStream);
						readStream.resume ();
					});
					// TODO: add handlers for 
				});
				// TODO: here we need to set timeout
			}
			if (err) {
				self.failed(err);
			} else {
				self.completed(filePath);
			}
		});
	}

});

module.exports = FileTask;
