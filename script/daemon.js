var dataflows = require ('dataflo.ws');

module.exports = {
	launch: function (conf) {
		var daemonName = process.argv[3];
		if (!conf.daemon || !conf.daemon[daemonName]) {
			// TODO: add description for daemon config generation
			console.error ('no daemon named "'+daemonName+'" available in configuration');
			process.exit();
		}
		var daemonConf = conf.daemon[daemonName];
		var initiatorTypes = daemonConf.initiator;
		initiatorTypes.forEach(function (initiatorType) {
			var initiatorConf = conf.initiator[initiatorType];
			// setters and getters is a flimsy excuse for languages
			// without lvalue
			var initiatorClass = dataflows.initiator (initiatorType);

			if ('function' == typeof initiatorClass) {
				new initiatorClass(initiatorConf);
			} else {
				console.error ('cannot load initiator "' + initiatorType + '"');
			}
		});

	}
}
