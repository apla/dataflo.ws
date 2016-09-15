var EventEmitter = require ('events').EventEmitter,
	util         = require('util'),
	flow         = require ('../flow');

// node signals test:
// https://gist.github.com/coltrane/2599899
/*
$ node test-child-process-signals.js
SIGABRT ...OK
SIGALRM ...OK
SIGBUS ...OK
SIGFPE ...OK
SIGHUP ...OK
SIGILL ...OK
SIGINT ...FAIL: [exitCode=1, signal=null] exit: reported incorrect signal
SIGKILL ...OK
SIGPIPE ...FAIL: timeout (5s): child did not respond to signal.
SIGQUIT ...OK
SIGSEGV ...OK
SIGTERM ...FAIL: [exitCode=1, signal=null] exit: reported incorrect signal
SIGUSR1 ...OK (skipped) used by v8/node debugger
SIGUSR2 ...OK
SIGPOLL ...FAIL: Error: Unknown signal: SIGPOLL
SIGPROF ...OK
SIGSYS ...OK
SIGTRAP ...OK
SIGVTALRM ...OK
SIGXCPU ...OK
SIGXFSZ ...OK
*/
// please note, SIGINFO is available for node 6.x and later and
// this is one of the signals, easily accessible from keyboard with Ctrl+T
//

var signalService = module.exports = function (config) {

	var flows = config.flows || config;

	Object.keys (flows).forEach (function (signalName) {
		var flowConfig = flows[signalName];

		if (signalName.indexOf ('SIG') !== 0) {
			signalName = 'SIG' + signalName;
		}

		process.on (signalName, function () {
			var df = new flow (
				util.extend (true, {}, {tasks: flowConfig}),
				{} // dfRequire
			);

			if (!df) {
				self.emit ("unknown", {});
				return;
			}

			df.runDelayed ();
		});
	});

	this.ready = true;

	this.emit ('ready');

};

util.inherits (signalService, EventEmitter);

signalService.maxWorkers = 0;

signalService.attachToMaster = true;
