var EventEmitter = require ('events').EventEmitter,
	common       = require ('common'),
	util         = require ('util'),
	taskClass    = require ('RIA/Workflow/Task');

var colours = {
  reset: "\x1B[0m",

  grey:    "\x1B[0;30m",
  red:     "\x1B[0;31m",
  green:   "\x1B[0;32m",
  yellow:  "\x1B[0;33m",
  blue:    "\x1B[0;34m",
  magenta: "\x1B[0;35m",
  cyan:    "\x1B[0;36m",
  white:   "\x1B[0;37m",

  bold: {
    grey:    "\x1B[1;30m",
    red:     "\x1B[1;31m",
    green:   "\x1B[1;32m",
    yellow:  "\x1B[1;33m",
    blue:    "\x1B[1;34m",
    magenta: "\x1B[1;35m",
    cyan:    "\x1B[1;36m",
    white:   "\x1B[1;37m",
  }
};

var taskStateNames = taskClass.prototype.stateNames;

function pathToVal (dict, path, value) {
//	console.log ('pathToVal ('+ dict + ', '+ path + ', '+value+')');
	var chunks = path.split ('.');
	if (chunks.length == 1) {
		var oldValue = dict[chunks[0]];
		if (value !== void(0))
			dict[chunks[0]] = value;
//		console.log (''+oldValue);
		return oldValue;
	}
	return pathToVal (dict[chunks.shift()], chunks.join('.'), value)
}

function checkTaskParams (taskParams, dict) {
	// parse task params
		
	// TODO: modify this function because recursive changes of parameters works dirty (indexOf for value)
	
	var modifiedParams = {};
	
	var failedParams = [];
	
	try {
	
		for (var key in taskParams) {
			var val = taskParams[key];
			var valCheck = val;
			
			if (!val.indexOf) {
				modifiedParams[key] = val;
				continue;
			}
			
			var pos = val.indexOf ('{$');
			while (pos > -1) {
				var end = val.indexOf ('}', pos);
				var str = val.substr (pos + 2, end - pos - 2);
				
				// console.log ("found replacement: key => "+key+", requires => $"+str+"\n";
				
				var fix;
				if (str.indexOf ('.') > -1) { //  treat as path
					//  warn join ', ', keys %{$self->var};
					fix = pathToVal (dict, str);
				} else { // scalar
					fix = dict[str];
				}
				
				if (fix === void(0))
					throw [key, val];
				
				// warn "value for replace is: $fix\n";
				
				if (pos == 0 && end == (val.length - 1)) {
					val = fix;
				} else {
					val = val.substr (0, pos) + fix + val.substr (end - pos + 1);
				}
				
				if (val.indexOf)
					pos = val.indexOf ('{$', end);
				else
					break;
			}
//			if (val != valCheck)
			modifiedParams[key] = val;
			// console.log ("key is: " + key + ", param is: " + $1);
		}
	} catch (e) {
//		console.log (e[1], ' of task param '+e[0]+' is undefined');
//		console.log (taskParams, '!!!!!!!!!!!' + e) //, new Error().stack);
		failedParams.push (e[0]);
	}
	
	if (failedParams.length > 0) {
		return failedParams;
	}
	
	return modifiedParams;
}

var Workflow = module.exports = function (config, reqParam) {
		
	var self = this;
	common.extend (true, this, config);
	common.extend (true, this, reqParam);
	
	this.started = new Date().getTime();
	this.id      = this.started % 1e6;
	
	var idString = ""+this.id;
	while (idString.length < 6) {idString = '0' + idString};
	this.coloredId = [
		"" + idString[0] + idString[1],
		"" + idString[2] + idString[3],
		"" + idString[4] + idString[5]
	].map (function (item) {
		return "\x1B[0;3" + (parseInt(item) % 8)  + "m" + item + "\x1B[0m";
	}).join ('');

	this.data = {};
	
//	console.log ('!!!!!!!!!!!!!!!!!!!' + this.data.keys.length);
	
//	console.log ('config, reqParam', config, reqParam);
	
	this.tasks = config.tasks.map (function (taskParams) {
		var task;

		var checkRequirements = function () {
			var modifiedParams = checkTaskParams (taskParams, self);
			if (modifiedParams instanceof Array) {
				this.unsatisfiedRequirements = modifiedParams;
				return false;
			} else if (modifiedParams) {
				common.extend (this, modifiedParams);
				return true;
			}
		}
		
//		console.log (taskParams);
		
		if (taskParams.className) {
			self.log (taskParams.className + ': initializing task from class');
			var xTaskClass;
			
			try {
				xTaskClass = require ('RIA/Workflow/'+taskParams.className);
			} catch (e) {
				xTaskClass = require (taskParams.className);
			}
			
			task = new xTaskClass ({
				className: taskParams.className,
				require: checkRequirements
			});
		} else if (taskParams.coderef || taskParams.functionName) {
		
			self.log ((taskParams.functionName || taskParams.logTitle) + ': initializing task from function');
			if (!taskParams.functionName && !taskParams.logTitle)
				throw "task must have a logTitle when using call parameter";
			
			var xTaskClass = function (config) {
				this.init (config);
			};

			util.inherits (xTaskClass, taskClass);

			common.extend (xTaskClass.prototype, {
				run: function () {
					if (taskParams.functionName && process.mainModule.exports[taskParams.functionName]) {
						this.completed (process.mainModule.exports[taskParams.functionName] (this));
					} else {
						this.completed (taskParams.coderef (this));
					}
				}
			});
			
			task = new xTaskClass ({
				className: taskParams.logTitle,
				require: checkRequirements
			});
			
		}
		
//		console.log (task);
		
		return task;
	});
};

util.inherits (Workflow, EventEmitter);

function pad(n) {
	return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

// one second low resolution timer
var currentDate = new Date ();
setInterval (function () {
	currentDate = new Date ();
}, 1000);

function timestamp () {
	var time = [
		pad(currentDate.getHours()),
		pad(currentDate.getMinutes()),
		pad(currentDate.getSeconds())
	].join(':');
	var date = [
		currentDate.getFullYear(),
		pad(currentDate.getMonth()),
		pad(currentDate.getDate())
	].join ('-');
	return [date, time].join(' ');
}


common.extend (Workflow.prototype, {
	
	isIdle: 1,
	log: function (msg) {
		if (process.quiet || this.quiet) return;
		var toLog = [
			timestamp (),
			"[" + this.coloredId + "]"
		];
		for (var i = 0, len = arguments.length; i < len; ++i) {
			toLog.push (arguments[i]);
		}
		console.log.apply (console, toLog);
	},
	logTask: function (task, msg) {
		this.log (task.className || task.functionName || task.logTitle,  "("+task.state+")",  msg);
	},
	logTaskError: function (task, msg) {
		this.log(task.className || task.functionName || task.logTitle, "("+task.state+") \x1B[0;31m" + msg + "\x1B[0m");
	},
	
	haveCompletedTasks: false,
	run: function () {
		
		var self = this;
		
		self.isIdle = 0;
		self.haveCompletedTasks = false;
				
		self.log ('workflow run');
		
		this.taskStates = [0, 0, 0, 0, 0, 0];
		
		this.tasks.map (function (task) {
			
			if (task.subscribed === void(0)) {
				task.subscribed = 1;
			
				task.on ('log', function (message) {
					self.logTask (task, message); 
				});
				
				task.on ('error', function () {
					self.logTaskError (task, 'error ' + arguments[0]);// + '\n' + arguments[0].stack);
				});
				
				task.on ('cancel', function () {
					
					self.logTaskError (task, 'canceled, retries = ' + task.retries);
					
					if (self.isIdle)
						self.run ();
				});
				
				task.on ('complete', function (t, result) {
					
					if (t.produce && result)
						pathToVal (self, t.produce, result);
					
					self.logTask (task, 'task completed');
					
					if (self.isIdle)
						self.run ();
					else
						self.haveCompletedTasks = true;
				});
			}
			
			task.checkState ();
			
			self.taskStates[task.state]++;
			
//			console.log ('task.className, task.state\n', task, task.state, task.isReady ());
			
			if (task.isReady ()) {
				self.logTask (task, 'started');
				task.run ();
			}
		});
		
		var taskStateNames = taskClass.prototype.stateNames;
		
		if (this.taskStates[taskStateNames.ready] || this.taskStates[taskStateNames.running]) {
			// it is save to continue, wait for running/ready task
		} else {
			// here we fail, because no more tasks to complete
		}
		
		self.isIdle = 1;
		
		// check workflow
		
		if (this.taskStates[taskStateNames.complete] > 0)
			self.log ('completed tasks count ' + this.taskStates[taskStateNames.complete] + '/'+ self.tasks.length);

//		console.log (
//			'%%%%%%%%%%%%%',
//			this.taskStates[taskStateNames.complete],
//			this.taskStates[taskStateNames.failed],
//			this.taskStates[taskStateNames.scarce],
//			self.tasks.length
//		);

		if (this.taskStates[taskStateNames.complete] == self.tasks.length) {
			
//			self.emit ('');
			self.log ('workflow complete');
		
		} else if (
			this.taskStates[taskStateNames.complete]
			+ this.taskStates[taskStateNames.failed]
			+ this.taskStates[taskStateNames.scarce]
			== self.tasks.length
		) {
		
			var scarceTaskMessage = ', unsatisfied requirements:';
		
			// TODO: display scarce tasks unsatisfied requirements
			if (this.taskStates[taskStateNames.scarce]) {
				scarceTaskMessage += self.tasks.map (function (task) {
					if (task.state != taskStateNames.scarce)
						return;
					return (task.className || task.functionName || task.logTitle) + ' => ' + task.unsatisfiedRequirements.join (', ');
				}).join ('; ');
			}
			
			var requestDump = 'CIRCULAR';
			try {requestDump = JSON.stringify (self.request)} catch (e) {};

			
			self.log ('workflow failed, request: ' + requestDump + scarceTaskMessage);
		} else if (self.haveCompletedTasks) {
			
			setTimeout (function () {
				self.run ();
			}, 0);
		
		}
	}
});