var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

var task = require('./base'),
	util = require ('util');

// this task emits

var emitTask = module.exports = function(config) {

	this.init (config);

};

util.inherits (emitTask, task);

util.extend (emitTask.prototype, {

	run: function () {
		var self = this;

		if (!self.$bind || !self.$bind.on || !(self.$bind.emit instanceof Function)) {
			self.failed ('please provide $bind key in task configuration');
		}

		// completed must be called from message recipient
		// TODO: add ability to detect is there any subscribers for such event
		self.$bind.emit (self.scope, self);

	}
});

return emitTask;

});
