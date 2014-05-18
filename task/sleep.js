var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

var task = require ('./base');
var util = require ('util');

var sleepTask = module.exports = function (config) {
	this.init (config);
};

util.inherits (sleepTask, task);

util.extend (sleepTask.prototype, {

	run: function () {

		var self = this;

		setTimeout (function () {
			self.completed (self.amount);
		}, self.amount);
	}
});

return sleepTask;

});
