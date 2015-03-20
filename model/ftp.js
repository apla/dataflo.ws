var FTPClient         = require ('node-ftp/ftp'),
	util            = require ('util'),
	fs                = require ('fs'),
	ftpManager        = require ('./ftp/model-manager');

var pipeProgress = function (config) {
	this.bytesToRead = 0;
	this.bytesRead  = 0;
	this.bytesWritten = 0;
	this.lastLogged = 0;
	util.extend (this, config);
}

pipeProgress.prototype.watch = function () {
	var self = this;
	if (this.reader && this.readerWatch) {
		this.reader.on (this.readerWatch, function (chunk) {
			self.bytesRead += chunk.length;
		});
	} else if (this.writer && this.writerWatch) {
		this.writer.on (this.writerWatch, function (chunk) {
			self.bytesWritten += chunk.length;
		});
	}
}

var ftpModel = module.exports = function (modelBase) {

	this.modelBase = modelBase;
	this.url = modelBase.url;

}

util.extend(ftpModel.prototype, {

	store: function (source) {

		var self = this;

		var isStream = source.from instanceof fs.ReadStream;

		if (!isStream) {
			self.emitError('Source is not ReadStream');
			return;
		}

		var progress = new pipeProgress ({
			reader: source.from,
			readerWatch: 'data',
			totalBytes: source.size
		});

		self.ftp = new FTPClient({ host: self.url.hostname});

		self.ftp.on ('error', function (e) {
			if (self.emitError(e)) {
				self.ftp.end();
			}
		});

		self.ftp.on ('timeout', function () {
			if (self.emitError('connTimeout is over')) {
				self.ftp.end();
			}
		});

		self.readStream = source.from;

		self.readStream.on ('data', function (chunk) {
			self.modelBase.emit('data', chunk);
		});

		self.readStream.on ('error', function (err) {
			console.log ('readStream error');
			if (self.emitError(e)) {
				self.ftp.end();
			}
		});

		self.ftp.on('connect', function() {

			var auth = self.url.auth.split (':');
			//console.log("!#!#!#!#!#!#!#!#!#!#!#!#!#!!#ftp before auth -> ");
			self.ftp.auth(auth[0], auth[1], function(e) {
				// console.log("!#!#!#!#!#!#!#!#!#!#!#!#!#!!# ftp after auth -> ");

				if (self.emitError(e)) {
					self.ftp.end();
					return;
				}

				var cwdTarget = self.url.pathname.substring(1);

				self.ftp.cwd (cwdTarget, function (e) {

					if (e) { //self.emitError(e)) {
						self.ftp.end();
						return;
					}

					if (self.progress) {
							self.progress.watch ();
					}

					self.readStream.resume ();

					var putResult = self.ftp.put(self.readStream, source.originalFileName, function(e) {

						if (self.emitError(e)) {
							self.ftp.end();
							return;
						}

						self.ftp.end();

						self.modelBase.emit('end');

					});

				});

			});

		});

		// add self for watching into ftpModelManager
		project.ftpModelManager.add(self, source);

		return progress;
	},

	run: function () {
		this.ftp.connect();
	},

	stop: function () {
		this.ftp.end();
	},

	emitError: function (e) {
		if (e) {
			this.modelBase.emit('error', e);
			return true;
		} else {
			return false;
		}
	}

});
