var define;
if (typeof define === "undefined") {
	define = function (classInstance) {
		classInstance (require, exports, module);
	}
}

define (function (require, exports, module) {

var util   = require('util');
var common = require('../common');
var flow   = require('../flow');
var task   = require('./base');

var EveryTask = function (cfg) {
	this.init(cfg);
	this.count = 0;
	this.results = [];

	if ((this.$collect || this.$collectArray) && this.$collectObject) {
		console.error ('options $collectArray and $collectObject are mutually exclusive');
		this.failed ('Configuration error');
	}

	if (this.$collectObject) {
		this.results = {};
	}

};

util.inherits(EveryTask, task);

util.extend(EveryTask.prototype, {
	constructor: EveryTask,

	DEFAULT_CONFIG: {
		$tasks: [],
		$every: [],
		$collect: '',
		$set: ''
	}
});

EveryTask.prototype.getProperty = function (obj, path) {
	var val = obj;
	var hasProp = path.split('.').every(function (prop) {
		val = val[prop];
		return null != val;
	});
	return hasProp ? val : undefined;
};

EveryTask.prototype.onFlowResult = function () {
	this.count += 1;

	// TODO: failed dataflows and completed ones must be separated
	// so, every task must fail only when one or more dataflows is failed
	// otherwise, we need to emit empty
	if (this.subtaskFail) {
		this.failed ('Task failed');
		return;
	}

	if (this.count >= Object.keys (this.$every).length) {
		if (this.$collect || this.$collectArray) {
			if (this.results.length) {
				this.completed(this.results);
			} else {
				this.failed('No results');
			}
		} else if (this.$collectObject) {
			if (Object.keys(this.results).length) {
				this.completed(this.results);
			} else {
				this.failed('No results');
			}
		} else {
			this.completed({ ok: true });
		}
	}
};

EveryTask.prototype._onCompleted = function (df) {
	if (this.$collect || this.$collectArray) {
		var propertyName = this.$collect || this.$collectArray;
		var result = this.getProperty(df.data, propertyName);
		if (undefined !== result) {
			this.results.push(result);
		}
	} else if (this.$collectObject) {
		var result = this.getProperty(df.data, this.$collectObject);
		if (undefined !== result) {
			for (var objectField in result) {
				this.results[objectField] = result[objectField];
			}
		}
	}

	this.onFlowResult();

	this.runNextFlow();

};

EveryTask.prototype._onFailed = function (df) {
	this.subtaskFail = true;
	this.onFlowResult();

	this.runNextFlow();

};

EveryTask.prototype.runNextFlow = function () {
	var runNext = function () {
		if (this.executionList.length) {
			var df = this.executionList.shift ();
			df.run ();
		}
	}.bind (this);
	if (typeof process === 'undefined') {
		setTimeout (runNext, 0);
	} else {
		process.nextTick (runNext);
	}
}

function unquote (source, dest, origKey) {
	var pattern = /\[([$*][^\]]+)\]/g;
	var replacement = '{$1}';

	var recur = function (tree, collect, key) {
		var branch = tree[key];
		var type = Object.typeOf(branch);

		if ('String' == type) {
			var interpol = branch.replace(pattern, replacement);
			if (interpol != branch) {
				collect[key] = interpol;
			}
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
};

EveryTask.prototype.run = function () {
	var self = this;

	/**
	 * Walk the original config tree and replace [$...] with {$...},
	 * modifying the interpolated config tree (i.e. `this').
	 * Don't touch [$...] refs inside nested $every loops.
	 */
	// katspaugh is so stupid
	// if we run already interpolated values second time,
	// we face a problem with double interpolated values
	// and missing functions
	var everyTasks = util.extend (true, {}, this.originalConfig);
	unquote (everyTasks, everyTasks, '$tasks');

	// works for arrays and objects
	var keys = Object.keys (this.$every);

	this.executionList = [];
	try {
		keys.map (this.prepareDF.bind (this, everyTasks));
	} catch (e) {
		this.failed ();
		return;
	}

	var concurrencyMax = this.concurrency || 10;
	var concurrency =  Math.min (this.executionList.length, concurrencyMax);

	for (var toRun = 0; toRun < concurrency; toRun++) {
		var df = this.executionList.shift ();
		df.run ();
	}
};

EveryTask.prototype.prepareDF = function (everyTasks, item, idx, keys) {
	var every = {
		item:  this.$every[item],
		index: item,
		data:  this.$every,
		length: keys.length
	};

	// console.log (every);

	// dict the same between every, so we need to host a local copy
	var dict = util.extend (true, {}, this.getDict());
	dict.every = every;

	var flowConfig = util.extend (true, {}, this.flowConfig);
	flowConfig.tasks = everyTasks.$tasks;
	flowConfig.idPrefix = this.flowLogId + '>';

	var df = new flow (flowConfig, dict);

	if (!df.ready) {
		throw "subflow not ready";
	}

	df.on ('completed', this._onCompleted.bind (this));
	df.on ('failed', this._onFailed.bind (this));

	this.executionList.push (df);
	return df;
};

module.exports = EveryTask;

return EveryTask;

});
