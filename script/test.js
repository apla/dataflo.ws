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
		for (var token in flows) {
			if (token.match(/^test\W/))
				cases.push(token);
		}
		cases.sort();

		var context = this.launchContext();
		var casesToRun = cases.length;
		var casesResult = { ok: 0, fail: 0 };

		var onTestEnd = function() {
			if (--casesToRun)
				return;

			console.log('Completed: ' + casesResult['ok'] + ' of ' + cases.length );
			console.log('Failed:    ' + casesResult['fail'] + ' of ' + cases.length );
			process.kill();
		}

		cases.forEach(function(token) {
			var successKey = 'ok';
			var failKey    = 'fail';

			var m = token.match (/^test\W(ok|fail)?/);
			
			if (m[1] == 'fail') {
				successKey = 'fail';
				failKey    = 'ok';
			}
			
			console.print ('Running test case ' + token + '; expected ' + successKey);
//			console.log (conf.templates.task);

			var flow = processor.process(token, {
				templates: conf.templates.task,
				request: context.param,
				autoRun: false
			});

			flow.on('completed', function(flow) {
				casesResult[successKey]++;
				onTestEnd();
			});
			flow.on('failed', function(flow) {
				casesResult[failKey]++;
				onTestEnd();
			});

			flow.run();
		})

	}
}
