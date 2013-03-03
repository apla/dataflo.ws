var util     = require('util');
var common   = require('../common');
var workflow = require('../workflow');
var task     = require('./base');

var EveryTask = function (cfg) {
	this.init(cfg);
	this.count = 0;
	this.results = [];
};

util.inherits(EveryTask, task);

util.extend(EveryTask.prototype, {
	constructor: EveryTask,

	onWorkflowResult: function () {
		this.count += 1;

		if (this.count >= this.$every.length) {
			if (this.results.length) {
				this.completed(this.results);
			} else {
				this.failed('No results');
			}
		}
	},

	_onCompleted: function (wf) {
		var result = wf[this.$collect];
		if (!workflow.isEmpty(result)) {
			this.results.push(result);
		}
		this.onWorkflowResult();
	},

	_onFailed: function (wf) {
		this.onWorkflowResult();
	},

	unquote: function unquote(tree, origKey) {
		var pattern = /{#(.+?)}/g;
		var replacement = '{$$$1}'; // get rich or die trying

		var recur = function (tree, collect, key) {
			var branch = tree[key];
			var type = Object.typeOf(branch);

			if ('String' == type) {
				collect[key] = branch.replace(pattern, replacement);
			} else if ('Array' == type) {
				collect[key] = [];
				branch.forEach(function (_, k) {
					recur(branch, collect[key], k);
				});
			} else if ('Object' == type) {
				collect[key] = {};
				Object.keys(branch).map(function (k) {
					if (origKey != k) {
						recur(branch, collect[key], k);
					}
				});
			}
		};

		var collect = {};
		recur(tree, collect, origKey);
		return collect[origKey];
	},

	run: function () {
		var self = this;

		var tasks = this.unquote(self.originalConfig, '$tasks');
		console.log(tasks);

		this.$every.forEach(function (item, index, array) {
			var wf = new workflow({
				tasks: tasks
			}, {
				every: {
					item: item,
					index: index + 1, // hello Lua
					array: array
				}
			});

			wf.on('completed', self._onCompleted.bind(self));
			wf.on('failed', self._onFailed.bind(self));

			wf.run();
		});
	}
});

module.exports = EveryTask;
