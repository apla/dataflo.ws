var task         = require ('task/base'),
	util         = require ('util'),
	mime		 = require ('mime');

var renderTask = module.exports = function (config) {

	this.init (config);

};

util.inherits (renderTask, task);

util.extend (renderTask.prototype, {

	run: function () {

		var self = this;

		if (this.type == 'json') {
			self.output.setHeader("Content-Type", mime.lookup(this.type) + '; charset=utf-8');
			self.output.end (JSON.stringify(self.data));
			self.completed ();
		} else  if (this.type == 'asis') {
			self.output.setHeader ("Content-Type", self.contentType);
			self.output.end (self.data);
			self.completed ();
		}
	}
});