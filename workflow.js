var define;
if (typeof define === "undefined")
	define = function (classInstance) {
		classInstance (require, exports, module);
	}

define (function (require, exports, module) {

var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	common       = require ('./common'),
	taskClass    = require ('./task/base');

var taskStateNames = taskClass.prototype.stateNames;

var hasOwnProperty = Object.prototype.hasOwnProperty;

function isEmpty(obj) {
	var type = Object.typeOf(obj);
	return (
		('Undefined' == type || 'Null' == type)            ||
		('Boolean'   == type && false === obj)             ||
		('Number'    == type && (0 === obj || isNaN(obj))) ||
		('String'    == type && 0 == obj.length)           ||
		('Array'     == type && 0 == obj.length)           ||
		('Object'    == type && 0 == Object.keys(obj).length)
	);
}

function taskRequirements (requirements, dict) {

	var result = [];

	for (var k in requirements) {
		var requirement = requirements[k];
		for (var i = 0; i < requirement.length; i++) {
			try {
				if (isEmpty (common.pathToVal (dict, requirement[i])))
					result.push (k);
			} catch (e) {
				result.push (k);
			}
		}
	}

	return result;
}

function checkTaskParams (params, dict, prefix) {
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

	if (Object.is('Array', params)) { // params is array

		modifiedParams = [];

		params.forEach(function (val, index, arr) {
			if (Object.is('String', val)) { // string

				try {
					var tmp = val.interpolate (dict);
					if (tmp === void 0)
						modifiedParams.push(val);
					else
						modifiedParams.push(tmp);

//					console.log (val, ' interpolated to the "', modifiedParams[key], '" and ', isEmpty (modifiedParams[key]) ? ' is empty' : 'is not empty');

					if (isEmpty (modifiedParams[modifiedParams.length-1]))
						throw "EMPTY VALUE";
				} catch (e) {
					failedParams.push (prefix+'['+index+']');
				}

			} else if (Object.typeOf(val) in AllowedValueTypes) {
				modifiedParams.push(val);
			} else {
				var result = checkTaskParams(val, dict, prefix+'['+index+']');

				modifiedParams.push(result.modified);
				failedParams = failedParams.concat (result.failed);
			}
		});

	} else { // params is hash
		modifiedParams = {};

		Object.keys(params).forEach(function (key) {
			var val = params[key];
			var valCheck = val;

			if (Object.is('String', val)) {
				try {
					var tmp = modifiedParams[key] = val.interpolate (dict);


					if (tmp === void 0) {
						modifiedParams[key] = val;
					}

					if (isEmpty(modifiedParams[key])) {
						throw "EMPTY VALUE";
					}

				} catch (e) {

					//console.error('ERR!');
					failedParams.push (prefix+key);

				}

			} else if (Object.typeOf(val) in AllowedValueTypes) {
				modifiedParams[key] = val;
			} else { // val is hash || array
				var result = checkTaskParams(val, dict, prefix+key);

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

/**
 * @class workflow
 * @extends events.EventEmitter
 *
 * The heart of the framework. Parses task configurations, loads dependencies,
 * launches tasks, stores their result. When all tasks are completed,
 * notifies subscribers (inititators).
 *
 * @cfg {Object} config (required) Workflow configuration.
 * @cfg {String} config.$class (required) Class to instantiate
 * (alias of config.className).
 * @cfg {String} config.$function (required) Synchronous function to be run
 * (instead of a class). Alias of functionName.
 * @cfg {String} config.$set Path to the property in which the produced data
 * will be stored.
 * @cfg {String} config.$method Method to be run after the class instantiation.
 * @cfg {Object} reqParam (required) Workflow parameters.
 */
var workflow = module.exports = function (config, reqParam) {

	var self = this;

	util.extend (true, this, config); // this is immutable config skeleton
	util.extend (true, this, reqParam); // this is config fixup

	this.created = new Date().getTime();

	// here we make sure workflow uid generated
	// TODO: check for cpu load
	var salt = (Math.random () * 1e6).toFixed(0);
	this.id      = this.id || (this.started ^ salt) % 1e6;

	if (!this.stage) this.stage = 'workflow';

	//if (!this.stageMarkers[this.stage])
	//	console.error ('there is no such stage marker: ' + this.stage);

	var idString = ""+this.id;
	while (idString.length < 6) {idString = '0' + idString};
	this.coloredId = [
		"" + idString[0] + idString[1],
		"" + idString[2] + idString[3],
		"" + idString[4] + idString[5]
	].map (function (item) {
		try {
			var _p = process;
			return "\x1B[0;3" + (parseInt(item) % 8)  + "m" + item + "\x1B[0m";
		} catch (e) {
			return item;
		}

	}).join ('');

	this.data = this.data || {};

//	console.log ('!!!!!!!!!!!!!!!!!!!' + this.data.keys.length);

//	console.log ('config, reqParam', config, reqParam);

	self.ready = true;

	// TODO: optimize usage - find placeholders and check only placeholders

	this.tasks = config.tasks.map (function (taskParams) {
		var task;

		var actualTaskParams;
		var taskTemplateName = taskParams.$template;
		if (self.templates && self.templates[taskTemplateName]) {

			actualTaskParams = {};
			util.extend (true, actualTaskParams, self.templates[taskTemplateName]);
			util.extend (true, actualTaskParams, taskParams);

			delete actualTaskParams.$template;
		} else {
			actualTaskParams = util.extend(true, {}, taskParams);
		}

		var checkRequirements = function () {

			var dict    = util.extend(true, {}, reqParam);
			dict.data   = self.data;
			dict.global = $global;

			if ($isServerSide) {
				dict.project = project;
			}

			var result = checkTaskParams (actualTaskParams, dict);

			if (result.failed && result.failed.length > 0) {
				this.unsatisfiedRequirements = result.failed;
				return false;
			} else if (result.modified) {
				util.extend (this, result.modified);
				return true;
			}
		}

		// check for data persistence in self.templates[taskTemplateName], taskParams

//		console.log (taskParams);

		var taskClassName = actualTaskParams.className || actualTaskParams.$class;
		var taskFnName = actualTaskParams.functionName || actualTaskParams.$function;

		if (taskClassName && taskFnName)
			self.logError ('defined both className and functionName, using className');

		if (taskClassName) {
//			self.log (taskParams.className + ': initializing task from class');
			var xTaskClass;

			// TODO: need check all task classes, because some compile errors may be there
//			console.log ('task/'+taskParams.className);
			try {
				xTaskClass = require (taskClassName);
			} catch (e) {
				console.log ('requirement "'+taskClassName+'" failed:');
				console.log (e.stack);
				throw ('requirement "'+taskClassName+'" failed:');
				self.ready = false;
			}

			try {
			task = new xTaskClass ({
				className: taskClassName,
				method:    actualTaskParams.method || actualTaskParams.$method,
				require:   checkRequirements,
				important: actualTaskParams.important || actualTaskParams.$important
			});
			} catch (e) {
				console.log ('instance of "'+taskClassName+'" creation failed:');
				console.log (e.stack);
				throw ('instance of "'+taskClassName+'" creation failed:');
				self.ready = false;

			}

		} else if (actualTaskParams.coderef || taskFnName) {

//			self.log ((taskParams.functionName || taskParams.logTitle) + ': initializing task from function');
			if (!taskFnName && !actualTaskParams.logTitle)
				throw "task must have a logTitle when using call parameter";

			var xTaskClass = function (config) {
				this.init (config);
			};

			util.inherits (xTaskClass, taskClass);

			util.extend (xTaskClass.prototype, {
				run: function () {
					var failed = false;

					/**
					 * Apply $function to $args in $scope.
					 */
					if (taskFnName) {
						var origin = this.$origin || $mainModule.exports;
						var method = common.getByPath(taskFnName, origin);

						/**
						 * Try to look up $function in the global scope.
						 */
						if (!method || 'function' != typeof method.value) {
							method = common.getByPath(taskFnName);
						}

						if (method && 'function' == typeof method.value) {
							var fn = method.value;
							var ctx  = this.$scope || method.scope;

							var args = this.$args;
							var argsType = Object.typeOf(args);

							if (null == args) {
								args = [ this ];
							} else if ('Array' != argsType &&
								'Arguments' != argsType) {
								args = [ args ];
							}

							try {
								var returnVal = fn.apply(ctx, args);
							} catch (e) {
								failed = e;
								this.failed(failed);
							}

							if (!failed) this.completed(returnVal);
						} else {
							failed = taskFnName + ' is not a function';
							this.failed(failed);
						}
					} else {
						// TODO: detailed error description
						this.completed(actualTaskParams.coderef(this));
					}
					if (failed) throw failed;
				}
			});

			task = new xTaskClass ({
				functionName: taskFnName,
				logTitle:     actualTaskParams.logTitle || actualTaskParams.$logTitle,
				require:      checkRequirements,
				important:    actualTaskParams.important || actualTaskParams.$important
			});

		}

//		console.log (task);

		return task;
	});

};

util.inherits (workflow, EventEmitter);

function pad(n) {
	return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

// one second low resolution timer
$stash.currentDate = new Date ();
$stash.currentDateInterval = setInterval (function () {
	$stash.currentDate = new Date ();
}, 1000);

function timestamp () {
	var time = [
		pad($stash.currentDate.getHours()),
		pad($stash.currentDate.getMinutes()),
		pad($stash.currentDate.getSeconds())
	].join(':');
	var date = [
		$stash.currentDate.getFullYear(),
		pad($stash.currentDate.getMonth() + 1),
		pad($stash.currentDate.getDate())
	].join ('-');
	return [date, time].join(' ');
}


util.extend (workflow.prototype, {
	checkTaskParams: checkTaskParams,
	taskRequirements: taskRequirements,
	isIdle: true,
	haveCompletedTasks: false,

	/**
	 * @method run Initiators call this method to launch the workflow.
	 */
	run: function () {
		if (!this.started)
			this.started = new Date().getTime();

		var self = this;

		if (self.stopped)
			return;

		self.failed = false;
		self.isIdle = false;
		self.haveCompletedTasks = false;

//		self.log ('workflow run');

		this.taskStates = [0, 0, 0, 0, 0, 0, 0];

		// check task states

		this.tasks.map (function (task) {

			if (task.subscribed === void(0)) {
				self.addEventListenersToTask (task);
			}

			task.checkState ();

			self.taskStates[task.state]++;

//			console.log ('task.className, task.state\n', task, task.state, task.isReady ());

			if (task.isReady ()) {
				self.logTask (task, 'started');
				try {
					task.run ();
				} catch (e) {
					self.logTaskError (task, 'failed to run', e);
				}

				// sync task support
				if (!task.isReady()) {
					self.taskStates[task.stateNames.ready]--;
					self.taskStates[task.state]++;
				}
			}
		});

		var taskStateNames = taskClass.prototype.stateNames;

		if (this.taskStates[taskStateNames.ready] || this.taskStates[taskStateNames.running]) {
			// it is save to continue, wait for running/ready task
			console.log ('have running tasks');

			self.isIdle = true;

			return;
		} else if (self.haveCompletedTasks) {
			console.log ('have completed tasks');
			// stack will be happy
			if ($isClientSide) {
				setTimeout (function () {self.run ();}, 0);
			} else if ($isServerSide) {
				process.nextTick (function () {self.run ()});
			}

			self.isIdle = true;

			return;
		}

		self.stopped = new Date().getTime();

		var scarceTaskMessage = 'unsatisfied requirements: ';

		// TODO: display scarce tasks unsatisfied requirements
		if (this.taskStates[taskStateNames.scarce]) {
			self.tasks.map (function (task) {
				if (task.state != taskStateNames.scarce && task.state != taskStateNames.skipped)
					return;
				if (task.important) {
					task.failed ("important task didn't started");
					self.taskStates[taskStateNames.scarce]--;
					self.taskStates[task.state]++;
					self.failed = true;
					scarceTaskMessage += '(important)';
				}

				if (task.state == taskStateNames.scarce)
					scarceTaskMessage += (task.logTitle) + ' => ' + task.unsatisfiedRequirements.join (', ') + '; ';
			});
			self.log (scarceTaskMessage);
		}

		if (self.verbose) {
			var requestDump = '???';
			try {
				requestDump = JSON.stringify (self.request)
			} catch (e) {
				if ((""+e).match (/circular/))
					requestDump = 'CIRCULAR'
				else
					requestDump = e
			};
		}

		if (this.failed) {
			// workflow stopped and failed

			self.emit ('failed', self);
			self.log (this.stage + ' failed in ' + (self.stopped - self.started) + 'ms; ' + this.taskStates[taskStateNames.failed]+' tasks of ' + self.tasks.length);

		} else {
			// workflow stopped and not failed

			self.emit ('completed', self);
			self.log (this.stage + ' complete in ' + (self.stopped - self.started) + 'ms');

		}

		self.isIdle = true;

	},
	stageMarker: {prepare: "()", workflow: "[]", presentation: "<>"},
	log: function (msg) {
//		if (this.quiet || process.quiet) return;
		var toLog = [
			timestamp (),
			this.stageMarker[this.stage][0] + this.coloredId + this.stageMarker[this.stage][1]
		];
		for (var i = 0, len = arguments.length; i < len; ++i) {
			toLog.push (arguments[i]);
		}

		// TODO: also check for bad clients (like ie9)
		if ($isPhoneGap) {
			toLog.shift();
			toLog = [toLog.join (' ')];
		}

		console.log.apply (console, toLog);
	},
	logTask: function (task, msg) {
		this.log (task.logTitle,  "("+task.state+")",  msg);
	},
	logTaskError: function (task, msg, options) {
		// TODO: fix by using console.error
		this.log(task.logTitle, "("+task.state+") \x1B[0;31m" + msg, options || '', "\x1B[0m");
	},
	logError: function (task, msg, options) {
		// TODO: fix by using console.error
		this.log(" \x1B[0;31m" + msg, options || '', "\x1B[0m");
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
			self.logTaskError (task, 'error: ', e);// + '\n' + arguments[0].stack);
		});

		// states
		task.on ('skip', function () {
//			if (task.important) {
//				self.failed = true;
//				return self.logTaskError (task, 'error ' + arguments[0]);// + '\n' + arguments[0].stack);
//			}
			self.logTask (task, 'task skipped');

			if (self.isIdle)
				self.run ();

		});

		task.on ('cancel', function () {

			self.logTaskError (task, 'canceled, retries = ' + task.retries);
			self.failed = true;

			if (self.isIdle)
				self.run ();
		});

		task.on ('complete', function (t, result) {

			if (result) {
				if (t.produce || t.$set) {
					common.pathToVal (self, t.produce || t.$set, result);
				} else if (t.$mergeWith) {
					common.pathToVal (self, t.$mergeWith, result, common.mergeObjects);
				}
			}

			self.logTask (task, 'task completed');

			if (self.isIdle)
				self.run ();
			else
				self.haveCompletedTasks = true;
		});

	}
});

});
