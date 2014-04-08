var dataflows = require('dataflo.ws');
var minimist  = require('minimist');

module.exports = {
	launchContext: function () {
		return {
			configKey: process.argv[3],
			method:    process.argv[4],
			args:      minimist(process.argv.slice(5))
		};
	},
	launch: function (conf) {
		var daemonName = this.launchContext().configKey;
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

		initiatorTypes.forEach(function (initiatorType) {
			var initiatorConf = conf.initiator[initiatorType];
			// setters and getters is a flimsy shim for languages
			// without lvalue
			var initiatorClass = dataflows.initiator(initiatorType);

			if ('function' == typeof initiatorClass) {
				new initiatorClass(initiatorConf);
			} else {
				console.error('Cannot load initiator "%s"', initiatorType);
			}
		});

	}
}
