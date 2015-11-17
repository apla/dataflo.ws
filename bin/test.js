var dataflows = require ('dataflo.ws');
var paint     = dataflows.color;

var minimist  = require ('commop/lib/minimist');

module.exports = {
	launchContext: function () {
		return {
			token:    process.argv[3],
			args:     minimist(process.argv.slice(3))
		};
	},
	launch: function (conf) {
		var tokenIConf = conf.initiator['token'];
		var tokenIClass = dataflows.initiator('token');

		if ('function' == typeof tokenIClass) {
			var processor = new tokenIClass(tokenIConf);
		} else {
			console.error('Cannot load initiator "%s"', 'token');
		}

		var context = this.launchContext();

		var caseMatch = context.args._[0] || "^test\\W";

		var flows = processor.dataflows || processor.flows;
		var cases = [];
		for (var token in flows) {
			if (token.match (caseMatch))
				cases.push (token);
		}
		cases.sort();

		var casesToRun = cases.length;
		var casesResult = { ok: [], fail: [] };

		var onTestEnd = function(token) {
			if (--casesToRun)
				return;

			console.log('Completed: ' + casesResult.ok.length + ' of ' + cases.length );
			console.log(
				'Failed:    ' + casesResult.fail.length + ' of ' + cases.length
				+ (casesResult.fail.length === 0 ? '': ': ')
				+ casesResult.fail.map (function (c) {return paint.error (c)}).join (', ')
			);

			// process.kill();
		}

		cases.forEach(function(token) {
			var successKey = 'ok';
			var failKey    = 'fail';

			console.log ('Running test case ' + paint.magenta (token) + '; expected ' + paint.green (successKey));
//			console.log (conf.templates.task);

			var flow = processor.process(token, {
				templates: conf.templates.task,
				request: context.param,
				autoRun: false
			});

			var flowExpect = "ok";
			if (flow.expect) {
				flowExpect = flow.expect;
			}

			if (flowExpect == 'fail') {
				successKey = 'fail';
				failKey    = 'ok';
			}

			flow.on('completed', function(flow) {
				console.log (paint.green ('Test case', token, 'ok'));
				casesResult[successKey].push (token);
				onTestEnd(token);
			});

			flow.on('failed', function(flow) {
				console.log (paint.red ('Test case', token, 'failed'));
				casesResult[failKey].push (token);
				onTestEnd(token);
			});

			flow.run();
		})

	}
}
