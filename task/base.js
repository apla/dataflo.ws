var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	common       = require ('../common');

var taskStateList = [
	'scarce', 'ready', 'running', 'idle',
	'complete', 'failed', 'skipped'
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
 * @class task.task
 * @extends events.EventEmitter
 *
 * Tasks are atomic synchronous/asynchronous entities that configure
 * what must be done, what prerequisitives must be satisfied before doing it,
 * and, optionally, where to store the task's result.
 *
 * `task` is an abstract base class that specific task types
 * should inherite from.
 *
 * The base `task` class provides methods to control the task execution
 * externally. These methods are called by the workflow.
 * They cycle through a number of states ({@link #stateNames})
 * and emit events.
 *
 * ### Example
 *
 * A sequence of task configs
 * within the *RIA.Workflow* concept. `task` objects are instantiated
 * by `workflow` internally.
 *
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
 * @cfg {String} produce The name of the workflow data field to receive
 * the result of the task.
 *
 * @cfg {Function|String|String[]} require Lists requirements to check.
 *
 * Implementations might provide either a function that checks whether
 * the requirements are satisfied or an identifier or a list of identifiers,
 * representing required objects.
 *
 * @returns {Boolean} If `require` is callable, it must return a boolean value.
 *
 * @cfg {Boolean} important If the task is marked important,
 * it may declare itself {@link #failed}.
 * Used in custom {@link #method} methods.
 */

var task = module.exports = function (config) {

}

util.inherits (task, EventEmitter);

util.extend (task.prototype, taskStateMethods, {

	init: function (config) {

		this.require      = config.require || null;
		this.mustProduce  = config.mustProduce;
		this.cb           = config.cb;
		this.cbScope      = config.cbScope;
		this.className    = config.className;
		this.functionName = config.functionName;
		this.originalConfig = config.originalConfig;
		this.flowId       = config.flowId;
		this.getDict      = config.getDict;

		this.method       = config.method;
		if (this.className && !this.method)
			this.method   = 'run';

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
		self.timeout = config.timeout || 1;
		self.retries = config.retries || 0;

		self.attempts = 0;

		self.important = config.important || void 0;

		// `DEFAULT_CONFIG' is a formal config specification + default values
		if (self.DEFAULT_CONFIG) {
			util.shallowMerge(self, self.DEFAULT_CONFIG);
		}

		var state = this.checkState ();
//		console.log (this.url, 'state is', stateList[state], ' (' + state + ')', (state == 0 ? (this.require instanceof Array ? this.require.join (', ') : this.require) : ''));

		var oldRun = this[this.method || 'run'];

		this.run = function () {

			//this.emit ('log', 'RUN RETRIES : ' + this.retries);

			if (this.state != 1) return;

			this.state = 2;

			if (oldRun) oldRun.call (this);
		}

		var oldCancel = this.cancel;

		/**
		 * @method cancel
		 * Cancels the running task. The task is registered as attempted
		 * to run.
		 *
		 * Switches the task's state from `running` to `idle`.
		 *
		 * If the {@link #retries} limit allows, attempt to run the task
		 * after a delay ({@link #timeout}).
		 *
		 * Publishes {@link #event-cancel}.
		 */
		this.cancel = function () {

			this.attempts ++;

//			if (this.state == 2) return;

			this.state = 5;

			if (oldCancel) oldCancel.call (this);

			self.clearOperationTimeout();

			//this.emit ('log', 'CANCEL RETRIES : ' + this.retries);

			if (this.attempts - this.retries - 1 < 0) {

				this.state = 1;

				setTimeout(function () {
					self.run();
				}, this.timeout.seconds());
			}

			/**
			 * @event cancel
			 * Published on task cancel.
			 */
			this.emit ('cancel');

		}

	},

	/**
	 * @method completed
	 * Publishes {@link #event-complete} with the result object
	 * that will go into the {@link #produce} field of the workflow.
	 *
	 * @param {Object} result The product of the task.
	 */
	completed: function (result) {
		this.state = 4;

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
        if( common.isEmpty( result ) ) {
            this.empty();
        }

		/**
		 * @event complete
		 * Published upon task completion.
		 *
		 * @param {task.task} task
		 * @param {Object} result
		 */
		this.emit ("complete", this, result);
	},

	/**
	 * @method skipped
	 * Skips the task with a given result.
	 *
	 * Publishes {@link #event-skip}.
	 *
	 * @param {Object} result Substitutes the tasks's complete result.

	 */
	skipped: function (result) {
		this.state = 6;

		/**
		 * @event skip
		 * Triggered when the task is {@link #skipped}.

		 * @param {task.task} task
		 * @param {Object} result
		 */
		this.emit ("skip", this, result);
	},

	/**
	 * @method empty
	 * Run when the task has been completed correctly,
	 * but the result is a non-value (null or empty).
	 *
	 * Publishes {@link #event-empty}.
	 *
	 */
	empty: function () {
		this.state = 6; // completed
		this.emit('empty', this);
	},

	/**
	 * @method mapFields
	 * Translates task configuration from custom field-naming cheme.
	 *
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
	 * @method checkState
	 * Checks requirements and updates the task state.
	 *
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
			this.timeoutId = 0;
		}

	},

	/**
	 * @private
	 */
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
				self.cancel();

			}, self.timeout.seconds());
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
	 * @method failed
	 * Emits an {@link #event-error}.
	 *
	 * Cancels (calls {@link #method-cancel}) the task if it was ready
	 * or running; or just emits {@link #event-cancel} if not.
	 *
	 * Sets the status to `failed`.
	 *
	 * Sidenote: when a task fails the whole workflow, that it belongs to, fails.
	 *
	 * @return {Boolean} Always true.
	 * @param {Error} Error object.

	 */
	failed: function (e) {
		var prevState = this.state;
		this.state = 5;

		/**
		 * @event error
		 * Emitted on task fail and on internal errors.
		 * @param {Error} e Error object.
		 */
		this.emit('error', e);
		// if task failed at scarce state
		if (prevState)
			this.cancel()
		else
			this.emit ('cancel');
		return true;
	}


});

/**
 * @method EmitError
 * Implementation-specific.
 * When an unexpected error occurs, the task is automatically {@link #failed}.
 */
task.prototype.EmitError = task.prototype.failed;

return task;

});
