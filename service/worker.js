var dataflows = require ('dataflo.ws');

function Worker (conf, appName, serviceName) {

	this.conf     = conf;
	this.appName  = appName;

	this.services = {};

	// serviceName is provided only for master process
	if (serviceName)
		return this.launchService (serviceName);

	this.requestServiceName (
		conf,
		appName,
		this.startServices.bind (this)
	);
}

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
	var service = dataflows.service (serviceConfig.module || serviceType);

	// service constructor must be function
	if ('function' !== typeof service) {
		console.error('Cannot load service "%s"', serviceType);
		process.exit (1);
		return;
	}

	if (!this.busy) {
		var worker = new service (serviceConfig, this.services);

		this.services[serviceType] = worker;
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
		var service = dataflows.service (
			conf.service[otherServiceName].module || otherServiceName
		);
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

module.export = Worker;
