var fs     = require('fs'),
	path   = require('path'),
	util   = require('util'),
	os     = require('os'),
	exists = fs.exists || path.exists,
	_c     = require('constants'),
	common = require('../common'),
	task = require ('./base'),
	dataflows = require ('../');


var $global = common.$global;

var FileTask = function (cfg) {
	this.init(cfg);
};

function resolvePath (pathToResolve) {
	var resolveArgs = [pathToResolve];
	if (typeof project !== "undefined") {
		resolveArgs.unshift (dataflows.root.path);
	}
	return path.resolve.apply (path, resolveArgs);
}

util.inherits (FileTask, task);

function mkdirParent (dirPath, mode, callback) {
	//Call the standard fs.mkdir
	if (!callback) {
		callback = mode;
		mode = undefined;
	}
	fs.mkdir(dirPath, mode, function(error) {
		//When it fail in this way, do the custom steps
		if (error && error.code === 'ENOENT') {
			//Create all the parents recursively
			mkdirParent (path.dirname (dirPath), mode, function (err) {
				//And then the directory
				mkdirParent (dirPath, mode, callback);
			});
			return;
		}
		//Manually run the callback since we used our own callback to do all these
		callback && callback(error);
	});
}

util.extend(FileTask.prototype, {
	mkdir: function () {
		var filePath = resolvePath (this.filePath);
		var mode = this.mode;

		mkdirParent (filePath, mode, function (err) {
			if (err && err.code !== "EEXIST") {
				this.failed (err);
			} else {
				this.completed (filePath);
			}
		}.bind (this));
	},
	run: function () {
		this.read();
	},

	read: function () {
		var self = this;
		var filePath = resolvePath (this.filePath);

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
		var filePath = resolvePath (this.filePath);

		fs.writeFile(filePath, this.fileData, function (err) {
			if (err) {
				self.failed(err);
			} else {
				self.completed(filePath);
			}
		});
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
		var filePath = resolvePath (this.filePath);

		fs.unlink(filePath, function (err) {
			if (err) {
				self.failed(err);
			} else {
				self.completed(filePath);
			}
		});
	},
	copy: function () {
		var self = this;
		var src = resolvePath (this.filePath);
		var dst = resolvePath (this.to);

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

			writeStream.on ('close', self.completed.bind (self, dst));
			writeStream.on ('error', self.failed.bind (self));
			// TODO: add handlers for
		});

		readStream.on ('error', self.failed.bind (self));
		// TODO: here we need to set timeout
	},
	rename: function () {
		var src = resolvePath (this.filePath);
		var dst = resolvePath (this.to);

		if (this.verbose) {
			console.log ("rename", src, "to", dst);
		}

		fs.rename (src, dst, function (err) {
			if (err) {
				if (err.code === "EXDEV") {

					if (this.verbose) {
						console.log ("fs boundaries rename error, using copy");
					}

					// rename file between fs boundsries
					this.copy ();

					return;
				}

				this.failed(err);
				return;
			}

			this.completed (dst);
		}.bind (this));
	}

});

module.exports = FileTask;
