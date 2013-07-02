var dataflows = require('dataflo.ws');

module.exports = {
	launchContext: function () {
		return {
			token:    process.argv[3],
			param:    process.argv[4],
			params:   process.argv.slice(4)
		};
	},
	launch: function (conf) {
		/*var daemonName = this.launchContext().configKey;
		if (!conf.daemon || !conf.daemon[daemonName]) {
			// TODO: add description for daemon config generation
			console.error(
				'No daemon named "%s" found in configuration', daemonName
			);
			process.exit();
		}
		var daemonConf = conf.daemon[daemonName];
		// var initiatorTypes = daemonConf.initiator;
		*/

		var callbackIConf = conf.initiator['callback'];

		var callbackIClass = dataflows.initiator('callback');

		if ('function' == typeof callbackIClass) {
			var processor = new callbackIClass(callbackIConf);
		} else {
			console.error('Cannot load initiator "%s"', 'callback');
		}

		var flow = processor.process (this.launchContext().token, {
			templates: {},
			request: {
				param: this.launchContext().param,
				params: this.launchContext().params
			},
			autoRun: false
		});

		flow.on ('completed', function (flow) {
			process.kill();
		});
		flow.on ('failed', function (flow) {
			process.kill();
		});

		flow.run ();

	}
}
