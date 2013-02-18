var util     = require('util');
var common   = require('../common');
var workflow = require('../workflow');
var task     = require('./base');

var $global = common.$global;

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
		this.results.push(wf[this.$collect]);
		this.onWorkflowResult();
	},

	_onFailed: function (wf) {
		this.onWorkflowResult();
	},

	interpolate: function (tree, mapping, exclude) {
		var recur = (function (branch, key) {
			tree[key] = this.interpolate(branch, mapping, exclude);
		}).bind(this);

		if (Object.is('String', tree)) {
			if (tree in mapping) tree = mapping[tree];
		} else if (Object.is('Array', tree)) {
			tree.forEach(recur);
		} else if (Object.is('Object', tree)) {
			Object.keys(tree).forEach(function (key) {
				if (!exclude || !(key in exclude)) {
					recur(tree[key], key);
				}
			});
		}

		return tree;
	},

	run: function () {
		var self = this;

		var tasksJSON = JSON.stringify(this.originalConfig.$tasks);

		this.$every.forEach(function (item, index, array) {
			var tasks = JSON.parse(tasksJSON);
			self.interpolate(tasks, {
				'#item': item,
				'#index': index,
				'#array': array
			}, {
				// don't recur into
				'$tasks': false
			});

			var wf = new workflow({ tasks: tasks });

			wf.on('completed', self._onCompleted.bind(self));
			wf.on('failed', self._onFailed.bind(self));

			wf.run();
		});
	}
});

module.exports = EveryTask;
