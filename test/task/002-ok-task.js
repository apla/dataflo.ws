var task        = require ('task/base'),
	util        = require ('util');

var okTask = module.exports = function (config) {
	
	this.request = config.request;
	this.init (config);
	
};

util.inherits (okTask, task);

util.extend (okTask.prototype, {
	
	run: function () {
		this.completed (true);
	}
});
