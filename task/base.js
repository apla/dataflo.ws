var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

var EventEmitter = require ('events').EventEmitter,
	util         = require ('util');

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
 * @author
 * @docauthor
 * @class task.task
 * @extends Object
 *
 * Tasks are atomic synchronous/asynchronous entities that configure
 * what must be done, what prerequisitives must be satisfied before doing it,
 * and what to produce upon task completion.
 *
 * Tasks may only be either *succesful* or *failed*.
 *
 * `task` is an abstract base class that specific task types
 * should inherite from.
 *
 * The base `task` class provides methods to control task execution
 * (`run`, `cancel` &c) and cycles through a number of states
 * (`ready`, `running`, `idle` &c), publishes events (`complete`,
 * `skipped` &c).
 *
 * Example
 * =======
 *
 * A sequence of task configs
 * within the *RIA.Workflow* concept. `task` objects are instantiated
 * by `workflow` internally.
 *
	{
		workflows: [{
			url: "/entity/suggest",

			tasks: [{
				functionName: "parseFilter",
				url:          "{$request.url}",
				produce:      "data.suggest"
			}, {
				className:    "mongoRequestTask",
				connector:    "mongo",
				collection:   "messages",
				filter:       "{$data.suggest.tag}",
				produce:      "data.records"
			}, {
				className:    "renderTask",
				type:         "json",
				data:         "{$data.records}",
				output:       "{$response}"
			}]
		}]
	}
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
 * @cfg {String} produce (required) The name of the property to receive
 * the result of the task.
 *
 * **Note**: The parameter is optional for {@link task#renderTask},
 * because the latter sends its result in {@link renderTask#output}.
 *
 * @cfg {Function|String|String[]} require Specifies task
 * requirements.
 *
 * Implementations might provide either a function that checks whether
 * the requirements are satisfied or an identifier or a list of identifiers,
 * representing required module objects.
 *
 * The task won't be launched until these modules are loaded.
 *
 * @cfg {Boolean} mustProduce Whether the task must produce
 * any result. Used in {@link #completed}.
 *
 * @cfg {Boolean} important If the task is marked important,
 * it may declare itself {@link #failed}.
 * Used in custom {@link #method} methods.
 *
 * @cfg {Function} cb The callback function. Is run before
 * the {@link #event-complete} event in {@link #completed}.
 *
 * @cfg {Object} cbScope The context in which to do
 * the {@link #cb} callback (value fo `this`).
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

			if (this.state == 2) return;

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
	 * Checks if the task must produce any result
	 * (as per {@link #mustProduce} param), calls the {@link #cb} function
	 * and publishes {@link #event-complete}.
	 *
	 * Completed tasks are considered *successful*.
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

		/**
		 * @event complete
		 * Published upon successful task completion.
		 *
		 * @param {task} task
		 * @param {Object} result
		 */
		this.emit ("complete", this, result);
	},

	/**
	 * @method skipped
	 * Skips the task with a given result.
	 *
	 * **Note**: skipped tasks are still considered *successful*.
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

		 * @param {task} task
		 * @param {Object} result
		 */
		this.emit ("skip", this, result);
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
	 * An implementation-specific map of the task state codes
	 * to human-readable state descriptions.
	 *
	 * The base states are: `scarce`, `ready`, `running`, `idle`,
	 * `complete`, `failed` and `skipped`.
	 *
	 * Any modification of this list will probably break base `task` methods.
	 */
	stateNames: taskStateNames,

	/**
	 * @method failed
	 * Emits an {@link #event-error}.
	 *
	 * Cancels (calls {@link #cancel}) the task if it was ready or running
	 * or just emits {@link #event-cancel} if not.
	 *
	 * Sets the status to `failed`.
	 *
	 * When the task fails the whole workflow sequence fails.
	 *
	 * @return {Boolean} Always true.
	 * @param {Error} Error object.

	 */
	failed: function (e) {
		var prevState = this.state;
		this.state = 5;

		/**
		 * @event error
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
