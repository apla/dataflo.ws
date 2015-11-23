var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	dataflows    = require ('./'),
	common       = dataflows.common,
	lowResTimer  = common.lowResTimer,
	taskClass    = require ('./task/base'),
	paint        = dataflows.color,
	confFu       = require ('conf-fu'),
	tokenInitiator;

var taskStateNames = taskClass.prototype.stateNames;

function isVoid(val) {
	return void 0 == val;
}

function taskRequirements (requirements, dict) {

	var result = [];

	for (var k in requirements) {
		var requirement = requirements[k];
		for (var i = 0; i < requirement.length; i++) {
			try {
				if (isVoid (common.pathToVal (dict, requirement[i])))
					result.push (k);
			} catch (e) {
				result.push (k);
			}
		}
	}

	return result;
}

function checkTaskParams (params, dict, prefix, marks) {
	// parse task params
	// TODO: modify this function because recursive changes of parameters works dirty (indexOf for value)

	var AllowedValueTypes = {
		Boolean: true,
		Number: true,
		Function: true,
		Date: true
	};

	if (prefix == void 0) prefix = '';
	if (prefix) prefix += '.';

	var modifiedParams;
	var failedParams = [];

	if (params === null || params === undefined) {
		// nothing
	} else if (Object.is('Array', params)) { // params is array

		modifiedParams = [];

		params.forEach(function (val, index, arr) {
			if (Object.is('String', val)) { // string

				try {
					var tmp = val.interpolate(dict, marks);
					if (tmp === undefined) {
						failedParams.push (prefix+'['+index+']');
					} else {
						modifiedParams.push(tmp);
					}
				} catch (e) {
					failedParams.push (prefix+'['+index+']');
				}

			} else if (Object.typeOf(val) in AllowedValueTypes) {
				modifiedParams.push(val);
			} else {
				var result = checkTaskParams(
					val, dict, prefix+'['+index+']', marks
				);

				modifiedParams.push(result.modified);
				failedParams = failedParams.concat (result.failed);
			}
		});

	} else { // params is Object
		modifiedParams = {};

		Object.keys(params).forEach(function (key) {
			var val = params[key];
			var valCheck = val;

			if (Object.is('String', val)) {
				try {
					var tmp = val.interpolate(dict, marks);
					if (tmp === undefined) {
						failedParams.push (prefix+key);
					} else {
						modifiedParams[key] = tmp;
					}
				} catch (e) {
					//console.error('ERR!');
					failedParams.push (prefix+key);
				}
			} else if (Object.typeOf(val) in AllowedValueTypes) {
				modifiedParams[key] = val;
			} else { // val is hash || array
				var result = checkTaskParams(val, dict, prefix+key, marks);

				modifiedParams[key] = result.modified;
				failedParams = failedParams.concat (result.failed);
			}
		});
	}

	return {
		modified: modifiedParams,
		failed: failedParams || []
	};
}

var pid = (typeof process !== "undefined") ? ((process.pid & 0x7fff) << 16) : 0;

/**
 * @class flow
 * @extends events.EventEmitter
 *
 * The heart of the framework. Parses task configurations, loads dependencies,
 * launches tasks, stores their result. When all tasks are completed,
 * notifies subscribers (inititators).
 *
 * @cfg {Object} config (required) dataflow configuration.
 * @cfg {String} config.tasks (required) tasks in that dataflow.
 * @cfg {String} config.templates task templates
 * @cfg {String} config.data data for tasks.
 * @cfg {String} config.stage default is dataflow.
 * @cfg {Object} reqParam (required) dataflow parameters.
 */
var dataflow = module.exports = function (config, reqParam) {

	var self = this;

	// TODO: copy only required things
	// util.extend (true, this, config); // this is immutable config skeleton
	// util.extend (true, this, reqParam); // this is config fixup

	this.created = this.getDate ();

	// here we make sure dataflow uid generated

	var idLength = 8;
	// idPrefix is used for dataflows running winthing other dataflows, like `every` task
	if ("idPrefix" in config) this.idPrefix = config.idPrefix;
	if (this.idPrefix) {
		this.id = this.id || dataflow.nextId ();
		idLength = 4;
	} else {
		this.idPrefix = '';
		this.id = this.id || (pid | dataflow.nextId ());
	}

	if ("stage" in config) this.stage = config.stage;
	if (!this.stage) this.stage = 'dataflow';

	if (config.logger) {
		this.logger = this._log = config.logger;
	}

	//if (!this.stageMarkers[this.stage])
	//	console.error ('there is no such stage marker: ' + this.stage);

	var idString = this.id.toString(16);

	while (idString.length < idLength) {idString = '0' + idString};
	var idChunks = [
		"" + idString[0] + idString[1],
		"" + idString[2] + idString[3],
	];
	if (idLength === 8) {
		idChunks.push (
			"" + idString[4] + idString[5],
			"" + idString[6] + idString[7]
		);
	}
	this.coloredId = idChunks.map (function (item) {
		if (dataflows.nodePlatform) {
			return "\x1B[0;3" + (parseInt(item, 16) % 8)  + "m" + item + "\x1B[0m";
		} else {

		}
		return item;
	}).join ('');

	// TODO: legacy, it is better to remove data.data
	this.data = this.data || { data: {} };

	this.templates = config.templates || {};

//	console.log ('!!!!!!!!!!!!!!!!!!!' + this.data.keys.length);

//	console.log ('config, reqParam', config, reqParam);

	self.ready = true;

	var tasks = config.tasks;

	// TODO: optimize usage - find placeholders and check only placeholders
	if (config.tasksFrom) {
		if (!tokenInitiator) tokenInitiator = require ('initiator/token');

		var flowByToken;

		if (
			!project.config.initiator
			|| !project.config.initiator.token
			|| !project.config.initiator.token.flows
			|| !(flowByToken = project.config.initiator.token.flows[config.tasksFrom])
			|| !flowByToken.tasks
		) {
			this.log ('"tasksFrom" parameter requires to have "initiator/token/flows'+config.tasksFrom+'" configuration in project');
			this.ready = false;
		}

		tasks = flowByToken.tasks;
	} else if (!tasks || !tasks.length) {
		tasks = [];
	}

	function createDict () {
		// TODO: very bad idea: reqParam overwrites flow.data
		var dict = util.extend (true, self.data, reqParam);
		dict.appMain = dataflows.main ();

		if (dataflows.nodePlatform) {
			try { dict.project = project; } catch (e) {}
		}

		return dict;
	}

	var taskGen = function (type, actualTaskParams) {
		if (type === 'createDict') return createDict;
		if (type === 'checkRequirements') return function () {
			var dict = createDict ();

			var result = checkTaskParams (actualTaskParams, dict, self.marks);

			if (result.failed && result.failed.length > 0) {
				this.unsatisfiedRequirements = result.failed;
				return false;
			} else if (result.modified) {
				// TODO: bad
				util.extend (this, result.modified);
				return true;
			}
		}
	}


	this.tasks = tasks.map (taskClass.prepare.bind (taskClass, self, dataflows, taskGen));

	this.tasks.forEach (function (task) {
		if (!task) {
			self.failed = true;
			self.ready  = false;
			// self.emit ('failed', self);
			self.logError (self.stage + ' task is undefined');
		}
	});
};

util.inherits (dataflow, EventEmitter);

var seq = 0;

dataflow.nextId = function () {
	seq++;
	if (seq > 65535) {
		seq = 0;
	}
	return seq;
}

dataflow.lastId = 0;

util.extend (dataflow.prototype, {
	checkTaskParams: checkTaskParams,
	taskRequirements: taskRequirements,
	failed: false,
	isIdle: true,
	haveCompletedTasks: false,
	timerStarted: false,

	getDateString: function () {
		if (!this.timerStarted) {
			lowResTimer();
		}
		this.timerStarted = true;
		return lowResTimer.getDateString ();
	},
	getDate: function () {
		if (!this.timerStarted) {
			lowResTimer();
		}
		this.timerStarted = true;
		return lowResTimer.getDate ();
	},
	getDateAndStopTimer: function () {
		var date = lowResTimer.getDate ();
		lowResTimer.free();
		return date;
	},
	/**
	 * @method run Initiators call this method to launch the dataflow.
	 */
	runDelayed: function () {
		var self = this;
		if (dataflows.browserPlatform) {
			setTimeout (this.run.bind (this), 0);
		} else if (dataflows.nodePlatform) {
			process.nextTick (this.run.bind (this));
		}
	},

	run: function () {
		if (!this.started)
			this.started = this.getDate().getTime();

		var flow = this;

		if (flow.stopped)
			return;
		/* @behrad following was overriding already set failed status by failed tasks */
//		flow.failed = false;
		flow.isIdle = false;
		flow.haveCompletedTasks = false;

//		flow.log ('dataflow run');

		var taskStateNames = taskClass.prototype.stateNames;
		this.taskStates = [0, 0, 0, 0, 0, 0, 0, 0];

		// check task states

		if (!this.tasks || !this.tasks.length) {
			flow.emit ('failed', flow);
			flow.logError (this.stage + ' failed immediately due empty task list');
			flow.isIdle = true;
			return;
		}

		if (!this.ready) {
			flow.emit ('failed', flow);
			flow.logError (this.stage + ' failed immediately due unready state');
			flow.isIdle = true;
			return;
		}

		this.tasks.forEach (function (task, idx) {

			// task must be defined here

			if (task.subscribed === void(0)) {
				flow.addEventListenersToTask (task);
			}

			task.checkState ();

			flow.taskStates[task.state]++;

//			console.log ('task.className, task.state\n', task, task.state, task.isReady ());

			if (task.isReady () && !flow.failed) {
				flow.logTask (task, 'started');
				// TODO: add zones/domains
				// dataflows.zone.run (function () {/* here is task code */}, function () {/* here is error handler */});
				try {
					task._launch ();
				} catch (e) {
					// TODO: set task state to exception
					// on exception we should fail instantly
					task.failed (e);
					// flow.logTaskError (task, 'failed to run', e);
				}

				// sync task support
				if (!task.isReady()) {
					flow.taskStates[task.stateNames.ready]--;
					flow.taskStates[task.state]++;
				}
			}
		});


		if (!flow.failed) {

		if (this.taskStates[taskStateNames.ready] || this.taskStates[taskStateNames.running]) {
			// it is save to continue, wait for running/ready task
			// console.log ('have running tasks');

			flow.isIdle = true;

			return;
		} else if (flow.haveCompletedTasks) {
			// console.log ('have completed tasks');
			// stack will be happy
			flow.runDelayed();

			flow.isIdle = true;

			return;
		}
		}

		flow.stopped = this.getDateAndStopTimer().getTime();

		var scarceTaskMessage = 'unsatisfied requirements: ';

		// TODO: display scarce tasks unsatisfied requirements
		if (this.taskStates[taskStateNames.scarce]) {
			flow.tasks.map (function (task, idx) {
				if (task.state != taskStateNames.scarce && task.state != taskStateNames.skipped)
					return;
				if (task.important) {
					task.failed (idx + " important task didn't start");
					flow.taskStates[taskStateNames.scarce]--;
					flow.taskStates[task.state]++;
					flow.failed = true;
				}

				if (task.state == taskStateNames.scarce || task.state == taskStateNames.failed) {
					var appendMessage = "\ntask #" + idx + ' ' + (task.logTitle) + (task.important ? ', important' : '') + ' (' + (task.unsatisfiedRequirements ? task.unsatisfiedRequirements.join (', ') : task.unsatisfiedRequirements) + '); ';
					scarceTaskMessage += appendMessage;
				}
			});
			flow.log (scarceTaskMessage);
		}

		if (this.failed) {
			// dataflow stopped and failed

			flow.emit ('failed', flow);
			var failedtasksCount = this.taskStates[taskStateNames.failed]
			flow.logError (this.stage + ' failed in ' + (flow.stopped - flow.started) + 'ms; failed ' + failedtasksCount + ' ' + (failedtasksCount == 1 ? 'task': 'tasks') +' out of ' + flow.tasks.length);

		} else {
			// dataflow stopped and not failed

			flow.emit ('completed', flow);
			flow.log (this.stage + ' completed in ' + (flow.stopped - flow.started) + 'ms');
		}

		flow.isIdle = true;

	},
	stageMarker: {prepare: "[]", dataflow: "()", presentation: "{}"},
	buildLogString: function (msg) {

		var toLog = [].slice.call (arguments);

		toLog.unshift (
			this.stageMarker[this.stage][0] + this.idPrefix + this.coloredId + this.stageMarker[this.stage][1]
		);

		// TODO: also check for bad clients (like ie9)
		if (dataflows.cordovaPlatform) {
			toLog = [toLog.join (' ')];
		} else {
			toLog.unshift (
				this.getDateString ()
			);
		}
		return toLog;
	},
	_log: function (level, msg) {
//		if (this.quiet || process.quiet) return;

		var toLog = [].slice.call (arguments);
		var level = toLog.shift() || 'log';

		toLog = this.buildLogString.apply (this, toLog);

		(console[level] || console.log).apply (console, toLog);
	},
	log: function () {
		var args = [].slice.call (arguments);
		args.unshift ('log');
		this._log.apply (this, args);
	},
	logTask: function (task, msg) {
		this._log ('log', task.dfTaskLogNum, task.logTitle,  "("+task.state+")",  msg);
	},
	logTaskError: function (task, msg, options) {
		var lastFrame = '';
		if (options && options.stack) {
			var frames = options.stack.split('\n');
			var len = frames.length;
			if (frames.length > 1) {
				lastFrame = frames[1].trim();
			}
		}

		this._log (
			'error',
			task.dfTaskLogNum,
			task.logTitle,
			'(' + task.state + ')',
			paint.error (
				util.inspect (msg).replace (/(^'|'$)/g, "").replace (/\\'/g, "'"),
				util.inspect (options || '').replace (/(^'|'$)/g, "").replace (/\\'/g, "'")
			),
			lastFrame
		);
	},
	logError: function (msg, options) {
		// TODO: fix by using console.error
		this._log ('error', paint.error (
			util.inspect (msg).replace (/(^'|'$)/g, "").replace (/\\'/g, "'").replace (/\\n/g, "\n"),
			util.inspect (options || '').replace (/(^'|'$)/g, "").replace (/\\'/, "'")
		));
	},
	addEventListenersToTask: function (task) {
		var self = this;

		task.subscribed = 1;

		// loggers
		task.on ('log', function (message) {
			self.logTask (task, message);
		});

		task.on ('warn', function (message) {
			self.logTaskError (task, message);
		});

		task.on ('error', function (e) {
			self.error = e;
			self.logTaskError (task, 'error: ', e);
		});

		// states
		task.on ('skip', function () {
//			if (task.important) {
//				self.failed = true;
//				return self.logTaskError (task, 'error ' + arguments[0]);
//			}
			self.logTask (task, 'task skipped');

			if (self.isIdle)
				self.runDelayed ();

		});

		task.on ('cancel', function (failedValue) {

			if (task.retries !== null)
				self.logTaskError (task, 'canceled, retries = ' + task.retries);

			if (!task.retries && task.$setOnFail) {
				common.pathToVal(self.data, task.$setOnFail, failedValue || true);
				self.haveCompletedTasks = true;
			} else {
				self.failed = "" + task.dfTaskNo;
			}

			if (self.isIdle)
				self.runDelayed ();
		});

		task.on ('complete', function (t, result) {

			if (!dataflow.isEmpty (result)) {
				if (t.produce || t.$set) {
					common.pathToVal (self.data, t.produce || t.$set, result);
				} else if (t.$mergeWith) {
					common.pathToVal (self.data, t.$mergeWith, result, common.mergeObjects);
				}
			} else {
				if (t.$empty || t.$setOnEmpty || t.setOnEmpty) {
					common.pathToVal(self.data, t.$empty || t.$setOnEmpty || t.setOnEmpty, true);
				}
			}

			self.logTask (task, 'task completed');

			if (self.isIdle) {
				self.runDelayed ();
			} else
				self.haveCompletedTasks = true;
		});

		task.on ('empty', function (t) {
			if (t.$empty || t.$setOnEmpty || t.setOnEmpty) {
				common.pathToVal(self.data, t.$empty || t.$setOnEmpty || t.setOnEmpty, true);
			}
		});

	}
});

// legacy
dataflow.isEmpty = confFu.isEmpty;
