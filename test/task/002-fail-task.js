var task        = require ('task/base'),
	util        = require ('util');

var failTask = module.exports = function (config) {
	
	this.request = config.request;
	this.init (config);
	
};

util.inherits (failTask, task);

util.extend (failTask.prototype, {
	
	run: function () {
		this.failed ();
	}
});
