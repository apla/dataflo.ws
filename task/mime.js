var mmm = require('mmmagic'),
	mime = require('mime'),
	path = require('path'),
	util = require('util'),
	common = require('../common'),
	task = require('./base');

var DEFAULT_TYPE = 'application/octet-stream';
var $global = common.$global;

var MimeTask = function (cfg) {
	this.magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
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

	_onResult: function (err, mimeType) {
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
		var filePath = path.resolve ($global.project ? $global.project.root.path : '.', this.filePath);
		this.magic.detectFile (filePath, this._onResult.bind(this));
	},

	detectBuffer: function () {
		this.magic.detect(this.buffer, this._onResult.bind(this));
	}
});

module.exports = MimeTask;
