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

	DEFAULT_CONFIG: {
		$tasks: [],
		$every: [],
		$collect: '',
		$set: ''
	},

	getProperty: function (obj, path) {
		var val = obj;
		var hasProp = path.split('.').every(function (prop) {
			val = val[prop];
			return null != val;
		});
		return hasProp ? val : undefined;
	},

	onWorkflowResult: function () {
		this.count += 1;

		if (this.count >= this.$every.length) {
			if (this.$collect) {
				if (this.results.length) {
					this.completed(this.results);
				} else {
					this.failed('No results');
				}
			} else {
				this.completed({ ok: true });
			}
		}
	},

	_onCompleted: function (wf) {
		if (this.$collect) {
			var result = this.getProperty(wf.data, this.$collect);
			if (undefined !== result && !workflow.isEmpty(result)) {
				this.results.push(result);
			}
		}
		this.onWorkflowResult();
	},

	_onFailed: function (wf) {
		this.onWorkflowResult();
	},

	unquote: function unquote(source, dest, origKey) {
		var pattern = /{#(.+?)}/g;
		var replacement = '{$$$1}'; // get rich or die trying

		var recur = function (tree, collect, key) {
			var branch = tree[key];
			var type = Object.typeOf(branch);

			if ('String' == type) {
				collect[key] = branch.replace(pattern, replacement);
			} else if ('Array' == type) {
				branch.forEach(function (_, k) {
					recur(branch, collect[key], k);
				});
			} else if ('Object' == type) {
				Object.keys(branch).forEach(function (k) {
					if (origKey != k) {
						recur(branch, collect[key], k);
					}
				});
			}
		};

		recur(source, dest, origKey);
	},

	run: function () {
		var self = this;

        /**
         * Walk the original config tree and replace {#...} with {$...},
         * modifying the interpolated config tree (i.e. `this').
         * Don't touch {#...} refs in nested $every tasks.
         */
		this.unquote(this.originalConfig, this, '$tasks');

		// keys that will be exposed in `every' object
		var keys = Object.keys(self).filter(function (key) {
			return !(key in self.DEFAULT_CONFIG);
		});

		this.$every.forEach(function (item, index, array) {
			var every = {
				item: item,
				index: new Value.Number(index),
				array: array
			};

			// expose keys from the config
			keys.forEach(function (key) {
				every[key] = self[key];
			});

			var wf = new workflow({
				tasks: self.$tasks
			}, {
				every: every
			});

			wf.on('completed', self._onCompleted.bind(self));
			wf.on('failed', self._onFailed.bind(self));

			wf.run();
		});
	}
});

module.exports = EveryTask;
