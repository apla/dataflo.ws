var task = require ('dataflo.ws/task/base'),
	util = require ('util');

var varsTask = module.exports = function (config) {
		this.init (config);
};

util.inherits (varsTask, task);
util.extend (varsTask.prototype, {
	run: function () {
		var self = this;
		var args = self.args || self.$args;

		var item = args.shift();
		var funcName = args.shift();
		var func = item[funcName];

		if (typeof func == "function") {
			self.completed( func.apply(item, args) );
		} else {
			self.failed(funcName + " is not a function");
		}

	},

	concat: function() {
		var self = this;
		var args = self.args || self.$args;

		self.completed(args.join(''));
	},

	join: function() {
		var self = this;
		var args = self.args || self.$args;
		var clue = self.clue || self.delimiter;

		self.completed(args.join(clue));
	},

	set: function() {
		var self = this;
		var args = self.args || self.$args;
		var value = self.value || self.args[0];

		self.completed(value);
	}
});

