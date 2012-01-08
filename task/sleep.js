define (function (require, exports, module) {

var task = require ('task/base');

var sleepTask = module.exports = function (config) {
	this.init (config);
};

util.inherits (sleepTask, task);

util.extend (sleepTask.prototype, {
	
	run: function () {

		var self = this;
		
		setTimeout (function () {
			self.completed (1);
		}, self.amount);
	}
});

return sleepTask;

});