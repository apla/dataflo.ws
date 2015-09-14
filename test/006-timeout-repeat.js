var assert   = require('assert');

var util     = require ('util');

var df     = require ("../");
var flow   = require ("../flow");

// dirty, but works
// TODO: need to rewrite
require ("./common");

var verbose = true;

var tests = [];

//process.on('uncaughtException', failure ('unhadled exception'));

var dataflows = {
	"test:14-timeout-repeat": {
		"expect": "ok",
		"tasks": [{
			"task": "./test/task/timeout2times",
			"$method": "start",
			"$args": {"timeout": 100, "times": 3},
			"timeout": 50,
			"retries": 5,
			"$setOnFail": "errback111"
		}]
	}
};

describe ("running every", function () {
	Object.keys (dataflows).forEach (function (token) {
		var item = dataflows[token];
		it.only (item.description || token, function (done) {

			var df = new flow (
				util.extend (true, {}, item),
				{
					// dataflow parameters
				}
			);

			if (!df.ready) {
				console.log ("dataflow not ready");
				assert (item.expect === "no-dataflow" ? true : false);
				done ();
				return;
			}

			df.on ('completed', function () {
				assert (item.expect === "ok" ? true : false);
				done ();
			});

			df.on ('failed', function () {
				assert (item.expect === "fail" ? true : false);
				done ();
			});

			if (item.autoRun || item.autoRun == void 0)
				df.run();

		});
	});
});
