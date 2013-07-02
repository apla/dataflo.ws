var dataflows = require('dataflo.ws');

module.exports = {
	launchContext: function () {
		return {
			token:    process.argv[3],
			param:    process.argv[4]
		};
	},
	launch: function (conf) {
		var callbackIConf = conf.initiator['callback'];
		var callbackIClass = dataflows.initiator('callback');

		if ('function' == typeof callbackIClass) {
			var processor = new callbackIClass(callbackIConf);
		} else {
			console.error('Cannot load initiator "%s"', 'callback');
		}

		var flows = processor.dataflows || processor.flows;
		var cases = [];
		for (i in flows) {
			if (i.match(/^test/))
				cases.push(i);
		}
		cases.sort();

		var context = this.launchContext();
		var casesToRun = cases.length;
		var casesResult = { success: 0, fail: 0 };

		var onTestEnd = function() {
			if (--casesToRun)
				return;

			console.log('Completed: ' + casesResult['success'] + ' tests of ' + cases.length );
			console.log('Failed: ' + casesResult['fail'] + ' test of ' + cases.length );
			process.kill();
		}

		cases.forEach(function(test) {
			console.log('Running test case ' + test);

			var flow = processor.process(test, {
				templates: {},
				request: context.param,
				autoRun: false
			});

			flow.on('completed', function(flow) {
				casesResult['success']++;
				onTestEnd();
			});
			flow.on('failed', function(flow) {
				casesResult['fail']++;
				onTestEnd();
			});

			flow.run();
		})

	}
}
