var path    = require ('path');
var cluster = require ('cluster');
var os      = require ('os');

var maxForks = os.cpus().length;

var dataflows = require ('dataflo.ws');
var minimist  = require ('commop/lib/minimist');

// globals
var services = [];
var workers  = {};

function getWorkerCount (config, serviceName) {
	var serviceConfig = config.service[serviceName];
		var service = dataflows.service (serviceName);

		// maxWorkers can be 0 (no child should fork for this service)
		// 1 (only single fork is allowed)
		// and undefined (use maxForks as reference)

		// maxWorkers is a function because service can calculate number
		// of forks needed based on service configuration.

		var serviceWorkers;
		if (service.maxWorkers === undefined) {
			serviceWorkers = maxForks;
		} else if (typeof service.maxWorkers === 'function') {
			serviceWorkers = service.maxWorkers();
		} else if (service.maxWorkers.constructor === Number) {
			serviceWorkers = service.maxWorkers;
		}

		// some services depends on others, like websocket on http
		// in this case websocket service don't need it's own workers,
		// but rely on http ones.
		var keyNames = service.keyNames ? service.keyNames (serviceConfig) : [serviceName];

		if (cluster.isMaster)
			console.log (
				'service %s requested %d worker%s for',
				serviceName,
				serviceWorkers,
				serviceWorkers === 1 ? '' : 's',
				keyNames
			);

		for (var childId = 0; childId < serviceWorkers; childId++) {
			keyNames.forEach (function (key) {
				services.push (key);
			});
		}
}

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
		var appName = getRealAppName (ctx.configKey, conf);

		if ('fork' in ctx.args) {
			if (!ctx.args.fork) {
				maxForks = 1;
			} else {
				maxForks = parseInt (ctx.args.fork);
				if (!maxForks || isNaN (maxForks))
					maxForks = 1;
			}
		}

		// deprecations
		if (conf.daemon) {
			console.error ('`daemon` key in configuration is deprecated in favor of `app`');
			if (conf.app) {
				console.error ('`app` key in configuration cannot coexists with `daemon`');
				process.exit (1);
				return;
			}

			conf.app = {};
			for (var k in conf.daemon) {
				conf.app[k] = conf.daemon[k];
				conf.app[k].services = conf.daemon[k].initiator || conf.daemon[k].initiators;
				delete conf.app[k].initiator;
				delete conf.app[k].initiators;
			}
			delete conf.daemon;
		}

		if (conf.initiator) {
			console.error ('`initiator` key in configuration is deprecated in favor of `service`');
			if (conf.service) {
				console.error ('`service` key in configuration cannot coexists with `initiator`');
				process.exit (1);
				return;
			}
			conf.service = conf.initiator;
			delete conf.initiator;
		}

		// We've just received app name, let's enumerate services.
		// In master we should fork service processes, but with respect
		// for service expectations. For example, usb service should be
		// single process and websocket service don't need to be forked when
		// websocket is running on top of existing http server.

		var appConf = conf.app[appName];
		var serviceNames = appConf.services;

		serviceNames.forEach (getWorkerCount.bind (this, conf));

		if (cluster.isMaster) {

			forkWorker ();

			cluster.on ('exit', function (workerIPC, code, signal) {

				// if service died before ready event, don't spawn a new worker.
				if (!workers[workerIPC.process.pid].ready) {

				}

				console.log('worker ' + workerIPC.process.pid + ' died, code: ' + code + ', signal:' + signal);
				if (code != 0 && workers[workerIPC.process.pid].ready) {
					setTimeout (function () {
						console.log ("spawning a replacement worker");
						forkWorker ();
					}, 500);
				}

				services.push (workers[workerIPC.process.pid]);
				delete workers[workerIPC.process.pid];

			});

			// process.on ('SIGINT',   killWorkers);
			// process.on ('SIGTERM',  killWorkers);
			// process.on ('SIGBREAK', killWorkers);
			// process.on ('SIGINT',   gracefullyRestartWorkers);

			// use signal/watch service for this
			// process.on ('SIGHUP',   gracefullyRestartWorkers);

		} else {
			// Workers can share any TCP connection

			var worker = new Worker (conf, appName);

		}

		// watch config directories and node_modules directories when debug
		if (!project.config.debug) {
			return;
		}

		return;

		setupWatcher ();
	}
}

function getRealAppName (requestedAppName, conf) {
	var configAppNames = Object.keys(conf.app || conf.daemon);
	var appName = requestedAppName;
	if (requestedAppName == undefined && configAppNames.length == 1)
		appName = configAppNames[0];
	if ((!conf.app || !conf.app[appName]) && (!conf.daemon || !conf.daemon[appName])) {
		// TODO: add description for app config generation
		console.error(
			'No app named "%s" found in configuration', appName
		);
		var logAppNames = configAppNames.join ('", "');
		console.error ('You can select one from those app configurations: "%s"', logAppNames);
		process.exit();
	}

	return appName;
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

		var newWorker = forkWorker ();
		newWorker.once ("listening", function() {
			console.log("replacement worker online.");
			i++;
			f();
		});
	}
	f();
}

function forkWorker () {
	var workerIPC = cluster.fork();
	workerIPC.on ('message', function (msg) {
		if (msg.status && msg.status === 'ready') {
			workers[workerIPC.process.pid].ready = true;
			if (services.length)
				forkWorker ();
		}

		if (msg.request && msg.request === 'config') {
			workerIPC.send ({
				request: msg.request,
				response: {
					config: project.config,
					root:   project.root.path
				}
			});
		}

		// services should contain at least one item
		if (msg.request && msg.request === 'service') {
			var serviceName = services.shift ();
			// console.log ('worker asking for service name', serviceName);
			workers[workerIPC.process.pid] = {
				type: serviceName,
				ready: false
			};
			workerIPC.send ({
				request: msg.request,
				response: serviceName
			});
		}

	});

	return workerIPC;
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

function Worker (conf, appName) {

	this.conf    = conf;
	this.appName = appName;

	this.requestServiceName (
		conf,
		appName,
		this.startServices.bind (this)
	);
}

Worker.services = {};

Worker.prototype.requestServiceName = function (conf, appName, callback) {
	// Ask master for a service name
	process.send ({request: 'service'});

	// let's get service name
	process.on ('message', function keyHandler (msg) {
		if (msg.request && msg.request === 'service') {

			callback (msg.response);

			process.removeListener ('message', keyHandler);
		}
	});
}

Worker.prototype.launchService = function (serviceType) {
	var conf = this.conf;
	var serviceConfig = conf.service[serviceType];
	var service = dataflows.service (serviceType);

	// service constructor must be function
	if ('function' !== typeof service) {
		console.error('Cannot load service "%s"', serviceType);
		process.exit (1);
		return;
	}

	if (!this.busy) {
		var worker = new service (serviceConfig, Worker.services);

		Worker.services[serviceType] = worker;
		worker.on ('ready', function () {
			this.busy = false;
			if (this.queue.length) {
				var serviceType = this.queue.shift ();
				this.launchService (serviceType);
			} else {
				this.callback && this.callback ();
			}
		}.bind (this));
		this.busy = true;
	} else {
		this.queue.push (serviceType);
	}
}

Worker.prototype.startServices = function (serviceName) {

	var conf = this.conf;
	var appConfig = conf.app[this.appName];
	var serviceNames = appConfig.services;
	var serviceConfig = conf.service[serviceName];

	this.queue = [];
	this.callback = function () {
		process.send ({status: 'ready'});
	}

	if (serviceNames.indexOf (serviceName) >= 0) {
		this.launchService (serviceName);
	}

	serviceNames.filter (function (otherServiceName) {
		var service = dataflows.service (otherServiceName);
		var keyNames = service.keyNames
		? service.keyNames (serviceConfig)
		: [otherServiceName];

		if (serviceName === otherServiceName) {
			return false;
		}

		if (keyNames.indexOf (serviceName) >= 0 || keyNames.indexOf ('*') >= 0) {
			return true;
		}
	}).forEach (this.launchService.bind (this));
}
