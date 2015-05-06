var fs     = require('fs'),
	path   = require('path'),
	util   = require('util'),
	os     = require('os'),
	exists = fs.exists || path.exists,
	_c     = require('constants'),
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
	_randomName: function () {
		var fileName = [
			('tmp-' || this.prefix),
			process.pid,
			(Math.random() * 0x1000000000).toString(36),
			this.postfix
		].join ('');

		return fileName;
	},
	_createFile: function (name) {
		var self = this;
		fs.open(name, _c.O_CREAT | _c.O_EXCL | _c.O_RDWR, 0600, function _fileCreated(err, fd) {
			if (err) return self.failed ();
			self.completed(name);
		});
	},
	tmpFileName: function () {
		var self = this;
		var tmpDir = os.tmpDir();
		var tmpFileName = this._randomName ();
		var tmpPath = path.join (tmpDir, tmpFileName);
		exists (tmpPath, function (pathExists) {
			if (!pathExists) {
				self._createFile (tmpPath);
				return;
			}
			self.failed ();
		});

	},
	unlink: function () {
		var self = this;
		var filePath = path.resolve($global.project.root.path, this.filePath);

		fs.unlink(filePath, function (err) {
			if (err) {
				self.failed(err);
			} else {
				self.completed(filePath);
			}
		});
	},

	rename: function () {
		var self = this;
		var src = path.resolve($global.project.root.path, this.filePath);
		var dst = path.resolve($global.project.root.path, this.to);

		if (this.verbose) {
			console.log ("copying data from", src, "to", dst);
		}

		fs.rename (src, dst, function (err) {
			if (err.code !== 'EXDEV') {
				self.failed(err);
			} else {
				if (this.verbose) {
					console.log ("fs boundaries rename error, using copy");
				}
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

					writeStream.on ('error', self.failed.bind (self));
					// TODO: add handlers for
				});

				readStream.on ('error', self.failed.bind (self));
				// TODO: here we need to set timeout
			}
			if (err) {
				self.failed(err);
			} else {
				self.completed (dst);
			}
		});
	}

});

module.exports = FileTask;
