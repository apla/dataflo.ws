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
	}
});

module.exports = FileTask;
