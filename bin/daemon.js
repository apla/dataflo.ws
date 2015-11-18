var path    = require ('path');
var cluster = require ('cluster');
var os      = require ('os');

var numCPUs = os.cpus().length;

var dataflows = require ('dataflo.ws');
var minimist  = require ('commop/lib/minimist');

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
		var daemonName = ctx.configKey;

		if ('fork' in ctx.args && !ctx.args.fork) {
			runDaemon (conf, daemonName);

			return;
		}

		// instead of forking, cluster launch new script instance

		if (cluster.isMaster) {
			// Fork workers. TODO: make worker number configurable
			for (var i = 0; i < numCPUs; i++) {
				cluster.fork();
			}

			cluster.on('exit', function(worker, code, signal) {
				// TODO: relaunch worker?
				console.log('worker ' + worker.process.pid + ' died, code: ' + code + ', signal:' + signal);
				if (code != 0) {
					console.log("worker crashed! spawning a replacement.");
					cluster.fork();
				}
			});

			// process.on ('SIGINT',   killWorkers);
			// process.on ('SIGTERM',  killWorkers);
			// process.on ('SIGBREAK', killWorkers);
			// process.on ('SIGINT',   gracefullyRestartWorkers);

			process.on ('SIGHUP',   gracefullyRestartWorkers);

		} else {
			// Workers can share any TCP connection

			runDaemon (conf, daemonName);
		}

		// watch config directories and node_modules directories when debug
		if (!project.config.debug) {
			return;
		}

		return;

		setupWatcher ();
	}
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

		var newWorker = cluster.fork();
		newWorker.on("listening", function() {
			console.log("replacement worker online.");
			i++;
			f();
		});
	}
	f();
}



function runDaemon (conf, daemonName) {
	var configDaemonNames = Object.keys(conf.daemon);
	if (daemonName == undefined && configDaemonNames.length == 1)
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

	var daemonConf = conf.daemon[daemonName];
	var initiatorTypes = daemonConf.initiator;

	var initiators = {};

	initiatorTypes.forEach(function (initiatorType) {
		var initiatorConf = conf.initiator[initiatorType];
		// setters and getters is a flimsy shim for languages
		// without lvalue
		var initiatorClass = dataflows.initiator (initiatorType);

		if ('function' == typeof initiatorClass) {
			initiators[initiatorType] = new initiatorClass (initiatorConf, initiators);
		} else {
			console.error('Cannot load initiator "%s"', initiatorType);
		}
	});
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
