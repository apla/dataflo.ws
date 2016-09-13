var path    = require ('path');
var cluster = require ('cluster');
var os      = require ('os');

var maxForks = os.cpus().length;

var dataflows = require ('dataflo.ws');
var minimist  = require ('commop/lib/minimist');

// globals
var initiators = [];
var workers    = {};
var workerInitiators = {};

module.exports = {
	launchContext: function () {
		var argv = minimist(process.argv.slice(3));
		return {
			configKey: argv._[0],
			method:    argv._[1],
			args:      argv
		};
	},
	launch: function (conf) {
		var ctx = this.launchContext();
		var daemonName = getRealDaemonName (ctx.configKey, conf);

		if ('fork' in ctx.args) {
			if (!ctx.args.fork) {
				maxForks = 1;
			} else {
				maxForks = parseInt (ctx.args.fork);
				if (!maxForks || isNaN (maxForks))
					maxForks = 1;
			}
		}

		// We've just received daemon name, let's enumerate initiators.
		// In master we should fork initiator processes, but with respect
		// for initiator expectations. For example, usb initiator should be
		// single process and websocket initiator don't need to be forked when
		// websocket is running on top of existing http server.

		var daemonConf = conf.daemon[daemonName];
		var initiatorTypes = daemonConf.initiator;

		initiatorTypes.forEach(function (initiatorType) {
			var initiatorConf = conf.initiator[initiatorType];
			var initiatorClass = dataflows.initiator (initiatorType);

			// maxWorkers can be 0 (no child should fork with this initiator)
			// 1 (only single fork is allowed)
			// and undefined (use maxForks as reference)

			// maxWorkers is a function because initiator can calculate number
			// of forks needed.

			var initiatorWorkers;
			if (initiatorClass.maxWorkers === undefined) {
				initiatorWorkers = maxForks;
			} else if (typeof initiatorClass.maxWorkers === 'function') {
				initiatorWorkers = initiatorClass.maxWorkers();
			} else if (initiatorClass.maxWorkers.constructor === Number) {
				initiatorWorkers = initiatorClass.maxWorkers;
			}

			// this is a initiator key names which activating initiator
			var keyNames = initiatorClass.keyNames ? initiatorClass.keyNames (initiatorConf) : [initiatorType];

			if (cluster.isMaster)
			console.log (
				'initiator %s requested %d worker%s for',
				initiatorType,
				initiatorWorkers,
				initiatorWorkers === 1 ? '' : 's',
				keyNames
			);

			for (var childId = 0; childId < initiatorWorkers; childId++) {
				keyNames.forEach (function (key) {
					initiators.push (key);
				});
			}
		});

		if (cluster.isMaster) {
			// Fork workers. TODO: make worker number configurable

			forkInitiatorChild ();

			cluster.on('exit', function (worker, code, signal) {

				// if initiator died before ready event, don't spawn a new worker.
				if (!workers[worker.process.pid].ready) {

				}

				console.log('worker ' + worker.process.pid + ' died, code: ' + code + ', signal:' + signal);
				if (code != 0 && workers[worker.process.pid].ready) {
					setTimeout (function () {
						console.log ("spawning a replacement worker");
						forkInitiatorChild ();
					}, 500);
				}

				initiators.push (workers[worker.process.pid]);
				delete workers[worker.process.pid];

			});

			// process.on ('SIGINT',   killWorkers);
			// process.on ('SIGTERM',  killWorkers);
			// process.on ('SIGBREAK', killWorkers);
			// process.on ('SIGINT',   gracefullyRestartWorkers);

			// use signal/watch initiator for this
			// process.on ('SIGHUP',   gracefullyRestartWorkers);

		} else {
			// Workers can share any TCP connection

			// Ask master for a initiator name
			process.send ({request: 'initiator'});

			// let's get initiator key
			process.on ('message', function keyHandler (msg) {
				if (msg.request && msg.request === 'initiator') {

					runDaemon (conf, daemonName, msg.response);

					process.removeListener ('message', keyHandler);
				}
			});

		}

		// watch config directories and node_modules directories when debug
		if (!project.config.debug) {
			return;
		}

		return;

		setupWatcher ();
	}
}

function getRealDaemonName (requestedDaemonName, conf) {
	var configDaemonNames = Object.keys(conf.daemon);
	var daemonName = requestedDaemonName;
	if (requestedDaemonName == undefined && configDaemonNames.length == 1)
		daemonName = configDaemonNames[0];
	if (!conf.daemon || !conf.daemon[daemonName]) {
		// TODO: add description for daemon config generation
		console.error(
			'No daemon named "%s" found in configuration', daemonName
		);
		var logDaemonNames = configDaemonNames.join ('", "');
		console.error ('You can select one from those daemon configurations: "%s"', logDaemonNames);
		process.exit();
	}

	return daemonName;
}

function killWorkers () {
	Object.keys(cluster.workers).forEach (function (workerNum) {
		cluster.workers[workerNum].kill ();
	});
}

function gracefullyRestartWorkers () {
	// only reload one worker at a time
	// otherwise, we'll have a time when no request handlers are running
	var i = 0;
	var workers = Object.keys(cluster.workers);
	var f = function() {
		if (i == workers.length) return;

		console.log("Killing " + workers[i]);

		cluster.workers[workers[i]].disconnect();
		cluster.workers[workers[i]].on("disconnect", function() {
			console.log("worker shutdown complete");
		});

		// TODO: set timeout and kill worker

		var newWorker = forkInitiatorChild ();
		newWorker.once ("listening", function() {
			console.log("replacement worker online.");
			i++;
			f();
		});
	}
	f();
}

function forkInitiatorChild () {
	var worker = cluster.fork();
	worker.on ('message', function (msg) {
		if (msg.status && msg.status === 'ready') {
			workers[worker.process.pid].ready = true;
			if (initiators.length)
				forkInitiatorChild ();
		}

		if (msg.request && msg.request === 'config') {
			worker.send ({
				request: msg.request,
				response: {
					config: project.config,
					root:   project.root.path
				}
			});
		}

		// initiators should contain at least one item
		if (msg.request && msg.request === 'initiator') {
			var initiatorType = initiators.shift ();
			// console.log ('worker asking for initiator type', initiatorType);
			workers[worker.process.pid] = {
				type: initiatorType,
				ready: false
			};
			worker.send ({
				request: msg.request,
				response: initiatorType
			});
		}

	});

	return worker;
}

function runDaemon (conf, daemonName, initiatorKey) {

	var daemonConf = conf.daemon[daemonName];
	var initiatorTypes = daemonConf.initiator;

	function loadInitiator (initiatorType) {
		var initiatorConf = conf.initiator[initiatorType];
		var initiatorClass = dataflows.initiator (initiatorType);

		// initiator constructor must be function
		if ('function' !== typeof initiatorClass) {
			console.error('Cannot load initiator "%s"', initiatorType);
			process.exit (1);
			return;
		}

		if (!loadInitiator.busy) {
			var worker = new initiatorClass (initiatorConf, workerInitiators);

			workerInitiators[initiatorType] = worker;
			worker.on ('ready', function () {
				loadInitiator.busy = false;
				if (loadInitiator.queue.length) {
					var initiatorType = loadInitiator.queue.shift ();
					loadInitiator (initiatorType);
				} else {
					loadInitiator.callback && loadInitiator.callback ();
				}
			});
			loadInitiator.busy = true;
		} else {
			loadInitiator.queue.push (initiatorType);
		}
	}

	loadInitiator.queue = [];
	loadInitiator.callback = function () {
		process.send ({status: 'ready'});
	}

	if (initiatorTypes.indexOf (initiatorKey) >= 0) {
		loadInitiator (initiatorKey);
	}

	initiatorTypes.filter (function (initiatorType) {
		var initiatorClass = dataflows.initiator (initiatorType);
		var keyNames = initiatorClass.keyNames ? initiatorClass.keyNames (initiatorConf) : [initiatorType];

		if (initiatorKey === initiatorType) {
			return false;
		}

		if (keyNames.indexOf (initiatorKey) >= 0 || keyNames.indexOf ('*') >= 0) {
			return true;
		}
	}).forEach (loadInitiator);
}

function setupWatcher () {

	if (os.platform() === "darwin") {
		var fsevents = require('fsevents');
		var watcher = fsevents(__dirname);
		watcher.on('fsevent', function(path, flags, id) { }); // RAW Event as emitted by OS-X
		watcher.on('change', function(path, info) {}); // Common Event for all changes
		watcher.start() // To start observation
		watcher.stop()  // To end observation
	} else {

	}
	var chokidar = require ('chokidar');

	var watcher = chokidar.watch([
		path.join (project.root.path, '.dataflows'),
		path.join (project.root.path, 'node_modules')
	], {
		// ignored: /[\/\\]\./,
		persistent: true
	});

	// Add event listeners
	watcher
		.on('add', function(path) { log('File', path, 'has been added'); })
		.on('change', function(path) { log('File', path, 'has been changed'); })
		.on('unlink', function(path) { log('File', path, 'has been removed'); })
	// More events.
		.on('addDir', function(path) { log('Directory', path, 'has been added'); })
		.on('unlinkDir', function(path) { log('Directory', path, 'has been removed'); })
		.on('error', function(error) { log('Error happened', error); })
		.on('ready', function() { log('Initial scan complete. Ready for changes.'); })
		.on('raw', function(event, path, details) { log('Raw event info:', event, path, details); })

}
