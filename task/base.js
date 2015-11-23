var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

"use strict";

var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	dataflows    = require ('../'),
	common       = dataflows.common;

var taskStateList = [
	'scarce', 'ready', 'running', 'idle',
	'complete', 'failed', 'skipped', 'exception'
];

var taskStateNames = {};

var taskStateMethods = {};

for (var stateNum = 0; stateNum < taskStateList.length; stateNum++) {
	taskStateNames[taskStateList[stateNum]] = stateNum;

	var fName = 'is' + taskStateList[stateNum].toLowerCase().replace(
		/\b([a-z])/i, function(c) {return c.toUpperCase()}
	);
	taskStateMethods[fName] = function (x) {
		return function () {return this.state == x};
	} (stateNum);
}

/**
 * Tasks are code containers atomic synchronous/asynchronous entities that configure
 * what must be done, what prerequisitives must be satisfied before doing it,
 * and, optionally, where to store the task's result.
 *
 * `task` is an abstract base class that specific task types
 * should inherite from.
 *
 * The base `task` class provides methods to control the task execution
 * externally. These methods are called by the dataflow.
 * They cycle through a number of states ({@link #stateNames})
 * and emit events.
 *
 * ### Example
 *
 * A sequence of task configs
 * within the *dataflo.ws* concept. `task` objects are instantiated
 * by `dataflow` internally.
 * @module {Task} Task
 */

/**
 * @class
 * @extends events.EventEmitter
 * @cfg {String} className (required) The name of a module-exported class
 * to be instantiated as an asynchronous task.
 *
 * **Warning**: Params {@link #className} and {@link #functionName}
 * are mutually exclusive.
 *
 * @cfg {String} functionName (required) The name of a module-exported function
 * to be called as a synchronous task.
 *
 * **Warning**: Params {@link #className} and {@link #functionName}
 * are mutually exclusive.
 *
 * @cfg {String} [method="run"] The entry point method name.
 * This method will be called after the requirements are satisfied (if any).
 *
 * @cfg {Number} [retries=0] The number of times to retry to run the task.
 *
 * @cfg {Number} [timeout=1] The number of seconds between retries
 * to run the task.
 *
 * @cfg {String} produce The name of the dataflow data field to receive
 * the result of the task.
 *
 * @cfg {Function|String|String[]} require Lists requirements to check.
 *
 * @cfg {Boolean} important If the task is marked important,
 * it may declare itself {@link #failed}.
 * Used in custom {@link #method} methods.
 *
 * Implementations might provide either a function that checks whether
 * the requirements are satisfied or an identifier or a list of identifiers,
 * representing required objects.
 *
 * @returns {Boolean} If `require` is callable, it must return a boolean value.
 *
 */
function task (config) {

}

module.exports = task;

util.inherits (task, EventEmitter);

util.extend (task.prototype, taskStateMethods, {

	_launch: function () {
		//this.emit ('log', 'RUN RETRIES : ' + this.retries);

		if (this.state != 1) return;

		this.state = 2;

		var method = this[this.method || 'run'];
		if (!method) {
			this.state = 5;
			this.emit ('error', 'no method named "' + (this.method || 'run') + "\" in current task's class");

			return;
		}

		method.call (this);

		if (this.timeout) {
			this.timeoutId = setTimeout (function () {
				this.state = 5;
				this.emit ('log', 'timeout is over for task');
				this._cancel();
			}.bind (this), this.timeout);
		}
	},

	run: function () {
		var failed = false;

		/**
		 * Apply $function to $args in $scope.
		 */
		var origin = dataflows.global ();
		// WTF???
		var taskFnName = this.functionName;
		var fnPath = taskFnName.split('#', 2);

		if (fnPath.length == 2 && $global.project) {
			origin = $global.project.require(fnPath[0]);
			taskFnName = fnPath[1];
		} else if (this.$origin) {
			origin = this.$origin;
		} else {
			origin = dataflows.main ();
		}

		var method;
		method = common.getByPath (taskFnName, origin);

		/**
		 * Try to look up $function in the global scope.
		 */
		if (!method || 'function' !== typeof method.value) {
			method = common.getByPath (taskFnName, dataflows.global ());
		}

		if (!method || 'function' !== typeof method.value) {
			method = dataflows.task (taskFnName);
		}

		if (!method || ('function' !== typeof method && 'function' !== typeof method.value)) {
			failed = taskFnName + ' is not a function';
			this.failed(failed);
		}

		var fn = 'function' === typeof method ? method : method.value;
		var ctx  = this.$scope || method.scope;

		var args = this.$args;
		var argsType = Object.typeOf(args);

		if (null == args) {
			args = []; // args = [ this ]; // NO WAY!!!
		} else if (
			this.originalConfig.$args &&
			Object.typeOf (this.originalConfig.$args) != 'Array' &&
			Object.typeOf (this.originalConfig.$args) != 'Arguments'
		) {
			args = [args];
		}

		// console.log ('task:', taskClassName, 'function:', taskFnName, 'promise:', taskPromise, 'errback:', taskErrBack);

		if (this.type === "errback") {
			args.push ((function (err) {
				var cbArgs = [].slice.call (arguments, 1);
				if (err) {
					this.failed.apply (this, arguments);
					return;
				};
				this.completed.apply (this, cbArgs);
			}).bind(this));
		}

		try {
			var returnVal = fn.apply(ctx, args);
		} catch (e) {
			failed = e;
			this.failed(failed);
		}

		if (this.type === "promise") {
			returnVal.then (
				this.completed.bind (this),
				this.failed.bind (this)
			);
		} else if (this.type === "errback") {

		} else if (failed) {
			throw failed;
		} else {
			this.completed(returnVal);

			//	if (isVoid(returnVal)) {
			//		if (common.isEmpty(returnVal)) {
			//			this.empty();
			//		}
		}
	},

	/**
	 * Cancels the running task. The task is registered as attempted
	 * to run.
	 *
	 * Switches the task's state from `running` to `idle`.
	 *
	 * If the {@link #retries} limit allows, attempt to run the task
	 * after a delay ({@link #timeout}).
	 *
	 * Emits {@link #event_cancel}.
	 * @method _cancel
	 */
	_cancel: function (value) {

		this.attempts ++;

		if (this.state == 2) return;

		this.state = 5;

		if (this.cancel) this.cancel.apply (this, arguments);

		this.clearOperationTimeout();

		//this.emit ('log', 'CANCEL RETRIES : ' + this.retries);

		if (this.attempts - this.retries - 1 < 0) {

			this.state = 1;

			setTimeout (this._launch.bind (this), this.delay || 0);

			return;
		}

		/**
		 * Published on task cancel.
		 * @event cancel
		 */
		this.emit ('cancel', value);

	},

	init: function (config) {

		this.require      = config.require || null;
		this.mustProduce  = config.mustProduce;
		this.cb           = config.cb;
		this.cbScope      = config.cbScope;
		this.className    = config.className;
		this.functionName = config.functionName;
		this.originalConfig = config.originalConfig;
		this.flowId       = config.flowId;
		this.flowLogId    = config.flowLogId;
		this.getDict      = config.getDict;
		this.type         = config.type;

		this.method       = config.method;
		if (this.className && !this.method)
			this.method   = 'run';

		this.id = "" + this.flowId + ":" + config.idx;

		var idxLog = (config.idx < 10 ? " " : "") + config.idx;
		if (dataflows.nodePlatform) {
			idxLog = "\x1B[0;3" + (parseInt(config.idx) % 8)  + "m" + idxLog + "\x1B[0m";
		}

		// idx is a task index within flow config
		this.dfTaskNo     = config.idx;
		this.dfTaskLogNum = idxLog;

		if (!this.logTitle) {
			if (this.className) {
				this.logTitle = this.className + '.' + this.method;
			} else {
				this.logTitle = this.functionName;
			}
		}

		var stateList = taskStateList;

		var self = this;

		this.state = 0;

		// default values

		// TODO: this is provided only on run
		self.timeout = config.timeout; // || 10000;
		self.retries = config.retries || null;

		self.attempts = 0;

		self.important = config.important || void 0;

		// `DEFAULT_CONFIG' is a formal config specification + default values
		if (self.DEFAULT_CONFIG) {
			util.shallowMerge(self, self.DEFAULT_CONFIG);
		}

		var state = this.checkState ();
//		console.log (this.url, 'state is', stateList[state], ' (' + state + ')', (state == 0 ? (this.require instanceof Array ? this.require.join (', ') : this.require) : ''));

	},

	/**
	 *
	 * Emits {@link #event_complete} with the result object
	 * that will go into the {@link #produce} field of the dataflow.
	 *
	 * @method completed
	 *
	 * @param {Object} result The product of the task.
	 */
	completed: function (result) {
		this.state = taskStateNames.complete;

		var mustProduce = this.mustProduce;

		if (mustProduce) {
			var checkString = (mustProduce instanceof Array ? mustProduce.join (' && ') : mustProduce);
			var satisfy = 0;
			try {satisfy = eval ("if ("+ checkString +") 1") } catch (e) {};
			if (!satisfy) {
				// TODO: WebApp.Loader.instance.taskError (this);
				console.error ("task " + this.url + " must produce " + checkString + " but it doesn't");
				// TODO: return;
			}
		}

		// coroutine call
		if (typeof this.cb == 'function') {
//			console.log ('cb defined', this.cb, this.cbScope);

			if (this.cbScope) {
				this.cb.call (this.cbScope, this);
			} else {
				this.cb (this);
			}
		}

		//@behrad set $empty on completion of all task types
		if (common.isEmpty (result)) {
			this.empty();
			// TODO: return here, we don't need to emit complete
			// or emit flowData event
		}

		/**
		 * Published upon task completion.
		 *
		 * @event complete
		 * @param {task.task} task
		 * @param {Object} result
		 */
		this.emit ("complete", this, result);
	},

	/**
	 *
	 * Skips the task with a given result.
	 *
	 * Emits {@link #event_skip}.
	 *
	 * @method skipped
	 * @param {Object} result Substitutes the tasks's complete result.
	 *
	 */
	skipped: function (result) {
		this.state = taskStateNames.skipped;

		/**
		 * Triggered when the task is {@link #skipped}.

		 * @event skip
		 * @param {task.task} task
		 * @param {Object} result
		 */
		this.emit ("skip", this, result);
	},

	/**
	 * Run when the task has been completed correctly,
	 * but the result is a non-value (null or empty).
	 *
	 * Emits {@link #event_empty}.
	 *
	 * @method empty
	 */
	empty: function () {
		this.state = 6; // skipped, not completed? WTF?
		this.emit ('empty', this);
	},

	/**
	 * Translates task configuration from custom field-naming cheme.
	 *
	 * @method mapFields
	 * @param {Object} item
	 */
	mapFields: function (item) {
		var self = this;

		for (var k in self.mapping) {
			if (item[self.mapping[k]])
				item[k] = item[self.mapping[k]];
		}

		return item;
	},

	/**
	 * Checks requirements and updates the task state.
	 *
	 * @method checkState
	 * @return {Number} The new state code.
	 */
	checkState: function () {

		var self = this;

		if (!self.require && this.state == 0) {
			this.state = 1;
		}

		if (this.state >= 1)
			return this.state;

		var satisfy = 0;
		if (typeof self.require == 'function') {
			satisfy = self.require ();
		} else {
			try {
				satisfy = eval ("if ("+ (
					self.require instanceof Array
						? self.require.join (' && ')
						: self.require)+") 1")
			} catch (e) {

			};
		}
		if (satisfy) {
			this.state = 1;
			return this.state;
		}

		return this.state;
	},

	/**
	 * @private
	 */
	clearOperationTimeout: function() {
		if (this.timeoutId) {
			clearTimeout (this.timeoutId);
			this.timeoutId = undefined;
		}

	},

	/**
	 * @private
	 */
	// WTF??? MODEL???
	activityCheck: function (place, breakOnly) {

		if (place!=="model.fetch data") {
			// console.log("%%%%%%%%%%%%%place -> ", place);
		}
		var self = this;

		if (breakOnly === void (0)) {
			breakOnly = false;
		}

		self.clearOperationTimeout();

		if (!breakOnly)
		{
			self.timeoutId = setTimeout(function () {
				self.state = 5;
				self.emit (
					'log', 'timeout is over for ' + place + ' operation'
				);
				self.model.stop();
				self._cancel();

			}, self.timeout);
		}
	},

	/**
	 * @enum stateNames
	 *
	 * A map of the task state codes to human-readable state descriptions.
	 *
	 * The states codes are:
	 *
	 * - `scarce`
	 * - `ready`
	 * - `running`
	 * - `idle`
	 * - `complete`
	 * - `failed`
	 * - `skipped`
	 * - `empty`
	 */
	stateNames: taskStateNames,

	/**
	 * Emits an {@link #event_error}.
	 *
	 * Cancels (calls {@link #method-cancel}) the task if it was ready
	 * or running; or just emits {@link #event_cancel} if not.
	 *
	 * Sets the status to `failed`.
	 *
	 * Sidenote: when a task fails the whole dataflow, that it belongs to, fails.
	 *
	 * @method failed
	 * @return {Boolean} Always true.
	 * @param {Error} Error object.

	 */
	failed: function (e, data) {
		var prevState = this.state;
		this.state = 5;

		/**

		 * Emitted on task fail and on internal errors.
		 * @event error
		 * @param {Error} e Error object.
		 */
		this.emit('error', e);
		// if task failed at scarce state
		if (prevState)
			this._cancel (data || e)
		else
			this.emit ('cancel', data || e);
		return;
	}


});

/**
 * Prepare task class to run, handle errors, workaround for a $every tasks.
 *
 * @method prepare
 * @return {Task}.
 * @param {Flow} flow for task.
 * @param {DataFlows} dataflows object.
 * @param {Function} generator for params dictionary and check requirements.
 * @param {Integer} index in task array for that flow.
 * @param {Array} task array.

 */
task.prepare = function (flow, dataflows, gen, taskParams, idx, array) {
	var theTask;

	var actualTaskParams = {
	};
	var taskTemplateName = taskParams.$template;
	if (taskTemplateName && flow.templates && flow.templates[taskTemplateName]) {
		util.extend (true, actualTaskParams, flow.templates[taskTemplateName]);
		delete actualTaskParams.$template;
	}

	// we expand templates in every place in config
	// for tasks such as every
	util.extend (true, actualTaskParams, taskParams);

	if (actualTaskParams.$every) {
		actualTaskParams.$class = 'every';
		if (!actualTaskParams.$tasks) {
			flow.logError ('missing $tasks property for $every task');
			flow.ready = false;
			return;
		}
		actualTaskParams.$tasks.forEach (function (everyTaskConf, idx) {
			var taskTemplateName = everyTaskConf.$template;
			if (taskTemplateName && flow.templates && flow.templates[taskTemplateName]) {
				var newEveryTaskConf = util.extend (true, {}, flow.templates[taskTemplateName]);
				// WTF???
				util.extend (true, newEveryTaskConf, everyTaskConf);
				util.extend (true, everyTaskConf, newEveryTaskConf);
				delete everyTaskConf.$template;
				// console.log (everyTaskConf, actualTaskParams.$tasks[idx]);//everyTaskConf.$tasks
			}

		});

		actualTaskParams.flowConfig = {
			logger: flow.logger
		};
	}

	//		var originalTaskConfig = JSON.parse(JSON.stringify(actualTaskParams));
	var originalTaskConfig = util.extend (true, {}, actualTaskParams);

	// check for data persistence in flow.templates[taskTemplateName], taskParams

	// console.log (taskParams);

	var taskClassName = actualTaskParams.className || actualTaskParams.$class || actualTaskParams.task;
	var taskFnName = actualTaskParams.functionName || actualTaskParams.$function || actualTaskParams.fn;
	var taskPromise = actualTaskParams.promise || actualTaskParams.$promise;
	var taskErrBack = actualTaskParams.errback || actualTaskParams.$errback;

	//	console.log ('task:', taskClassName, 'function:', taskFnName, 'promise:', taskPromise, 'errback:', taskErrBack);

	if (taskClassName && taskFnName)
		flow.logError ('defined both className and functionName, using className');

	if (taskClassName) {

		try {
			var taskModule = dataflows.task (taskClassName);
			theTask = new taskModule ({
				originalConfig: originalTaskConfig,
				className: taskClassName,
				method:    actualTaskParams.method || actualTaskParams.$method,
				require:   gen ('checkRequirements', actualTaskParams),
				important: actualTaskParams.important || actualTaskParams.$important,
				flowLogId: flow.coloredId,
				flowId:    flow.id,
				getDict:   gen ('createDict'),
				timeout:   actualTaskParams.timeout,
				retries:   actualTaskParams.retries,
				idx:       idx
			});
		} catch (e) {
			flow.logError ('instance of "'+taskClassName+'" creation failed:');
			flow.logError (e.stack);
			// throw ('instance of "'+taskClassName+'" creation failed:');
			flow.ready = false;
		}

	} else if (taskFnName || taskPromise || taskErrBack) {

		var xTaskClass = function (config) {
			this.init (config);
		};

		var taskType;

		if (taskPromise) {
			// functions and promises similar, but function return value, promise promisepromise promise
			taskFnName = taskPromise;
			taskType = "promise";
		}

		if (taskErrBack) {
			// nodestyled callbacks
			taskFnName = taskErrBack;
			taskType = "errback";
		}

		util.inherits (xTaskClass, task);

		theTask = new xTaskClass ({
			originalConfig: originalTaskConfig,
			functionName: taskFnName || taskPromise || taskErrBack,
			type:         taskType,
			logTitle:     actualTaskParams.logTitle || actualTaskParams.$logTitle || actualTaskParams.displayName,
			require:      gen ('checkRequirements', actualTaskParams),
			important:    actualTaskParams.important || actualTaskParams.$important,
			flowLogId:    flow.coloredId,
			flowId:       flow.id,
			timeout:      actualTaskParams.timeout,
			retries:      actualTaskParams.retries,
			idx:          idx
		});

	} else {
		flow.logError ("cannot create task from structure:\n", taskParams);
		flow.logError ('you must define $task, $function or $promise field');
		// TODO: return something
		flow.ready = false;
	}

	return theTask;
}

task.prototype.EmitError = task.prototype.failed;

return task;

});
