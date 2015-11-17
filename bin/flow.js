var dataflows = require('dataflo.ws');
var minimist = require('commop/lib/minimist');

module.exports = {
	launchContext: function () {
		return {
			token:    process.argv[3],
			param:    process.argv[4],
			args:     minimist(process.argv.slice(4))
		};
	},
	launch: function (conf) {
		var tokenDFConf = conf.initiator.token;

		var tokenIClass = dataflows.initiator ('token');

		if ('function' == typeof tokenIClass) {
			var processor = new tokenIClass (tokenDFConf);
		} else {
			console.error('Cannot load initiator "%s"', 'callback');
		}

		var flow = processor.process (this.launchContext().token, {
			templates: {},
			request: {
				param: this.launchContext().param,
				args:  this.launchContext().args
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
