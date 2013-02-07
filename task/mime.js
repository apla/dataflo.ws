var magic = new require('mmmagic').Magic,
	mime = require('mime'),
	path = require('path'),
	util = require('util'),
	common = require('../common'),
	task = require('./base');

var DEFAULT_TYPE = 'application/octet-stream';
var $global = common.$global;

var MimeTask = function (cfg) {
	this.init(cfg);
};

util.inherits(MimeTask, task);

util.extend(MimeTask.prototype, {
	run: function () {
		if (this.filePath) {
			this.detectFile();
		} else if (this.buffer) {
			this.detectBuffer();
		} else {
			this.failed(new Error('No file path or buffer provided'));
		}
	},

	_onRestult: function (err, mimeType) {
		if (err) {
			this.failed(err);
		} else {
			this.completed({
				type: mimeType,
				extension: mime.extensions[mimeType] ||
					mime.extensions[DEFAULT_TYPE]
			});
		}
	},

	detectFile: function () {
		var filePath = path.resolve($global.project.root.path, this.filePath);
		magic.detectFile(filePath, this._onRestult.bind(this));
	},

	detectBuffer: function () {
		magic.detect(this.buffer, this._onRestult.bind(this));
	}
});

module.exports = MimeTask;
