var EventEmitter = require ('events').EventEmitter,
	util         = require ('util');

var taskStateList = ['scarce', 'ready', 'running', 'idle', 'complete', 'failed'];

var taskStateNames = {};

var taskStateMethods = {};

for (var stateNum = 0; stateNum < taskStateList.length; stateNum++) {
	
	taskStateNames[taskStateList[stateNum]] = stateNum;
	
	var fName = 'is' + taskStateList[stateNum].toLowerCase().replace(/\b([a-z])/i, function(c) {return c.toUpperCase()});
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
 * A class implement a running of atomic asynchrone/synchrone task within RIA.Workflow conception.
 *
 * Example:
 <pre><code>
	{
		workflows: [{
			url: "/entity/suggest",
			tasks: [{
				functionName: 'parseFilter',
				url: "{$request.url}",
				produce: "data.suggest"
			}, {
				className:  "mongoRequestTask",
				connector:  "mongo",
				collection: "messages",
				filter:     "{$data.suggest.tag}",
				produce:    "data.records"
			}, {
				className: "renderTask",
				type: "json",
				data: "{$data.records}",
				output: "{$response}"
			}]
		}]
	}
 </code></pre>
 *
 * @cfg {String} className (Require) name of node-module for asynchrone running of task.
 * <b>Warning:</b> Params className and functionName are incompatible.
 *
 * @cfg {String} functionName (Require) name of node-exported function for synchrone running of some actions.
 * <b>Warning:</b> Params className and functionName are incompatible.
 *
 * @cfg {String} method (Optional) entry point to task running. Default value is "run". This method will be called after requirements statisfied.
 *
 * @cfg {String} produce (Require) name of the property, receiving the result of the task.
 * <b>Note:</b> Param is't require only for renderTask, because it send self result by response marked in output property.
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
		
		if (!this.logTitle) {
			this.logTitle = this.className || this.functionName;
		}
		
		var stateList = taskStateList;
		
		var self = this;
		
		this.state = 0;
		
		// default values
		
		self.timeout = 5;
		self.retries = 1;
		
		var state = this.checkState ();
//		console.log (this.url, 'state is', stateList[state], ' (' + state + ')', (state == 0 ? (this.require instanceof Array ? this.require.join (', ') : this.require) : ''));
		
		var oldRun = this[config.method || 'run'];
		
		this.run = function () {
			
			//this.emit ('log', 'RUN RETRIES : ' + this.retries);
			
			if (this.retries < 1) {
				this.cancel();
				return;
			}
			
			if (this.state != 1) return;
			
			this.state = 2;
			
			if (oldRun) oldRun.call (this);
		}
		
		var oldCancel = this.cancel;
		
		this.cancel = function () {
			
			if (this.state == 2) return;
			
			this.state = 5;
			
			if (oldCancel) oldCancel.call (this);
			
			self.clearOperationTimeout();
			
			//this.emit ('log', 'CANCEL RETRIES : ' + this.retries);
			
			if (this.retries > 0) {
				
				this.retries--;
				
				this.state = 1;
				
				setTimeout(function () {
					if (self.retries > 0) {
						//self.retries--;
						self.run();
					}
				}, this.timeout.seconds());
			}

			this.emit ('cancel');
			
		}

	},
	
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
		
		this.emit ("complete", this, result);
	},
	
	mapFields: function (item) {
		var self = this;
		
		for (var k in self.mapping) {
			if (item[self.mapping[k]])
				item[k] = item[self.mapping[k]];
		}
	},
	
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
	
	clearOperationTimeout: function() {
	
		if (this.timeoutId) {
			clearTimeout (this.timeoutId);
			this.timeoutId = 0;
		}
	
	},
	
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
				self.emit ('log', 'timeout is over for ' + place + ' operation');
				self.model.stop();
				self.cancel();				
			
			}, self.timeout.seconds());
		}
	},
	
	stateNames: taskStateNames,
	
	failed: function (e) {
		if (e) {
			this.state = 5;
			this.emit('error', e);
			this.cancel();
			return true;
		} else {
			return false;
		}
	}


});

task.prototype.EmitError = task.prototype.failed;
