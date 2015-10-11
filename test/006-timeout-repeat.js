var assert   = require('assert');

var util     = require ('util');
var path     = require ('path');

var baseName = path.basename (__filename, path.extname (__filename));

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
	},
	"test:15-timeout-repeat": {
		"expect": "fail",
		"tasks": [{
			"task": "./test/task/timeout2times",
			"$method": "start",
			"$args": {"timeout": 100, "times": 3},
			"timeout": 50,
			"retries": 2,
			"$setOnFail": "errback111"
		}]
	}
};

describe (baseName + " running timeout repeat", function () {
	Object.keys (dataflows).forEach (function (token) {
		var item = dataflows[token];
		var method = it;

		if (typeof testOnly !== "undefined" && testOnly) {
			if (testOnly === token) {
				method = it.only;
			} else {
				return;
			}
		}

		method (item.description ? item.description + ' ('+token+')' : token, function (done) {

			var df = new flow (
				{
					tasks: item.tasks,
					// templates: templates,
					logger: "VERBOSE" in process.env ? undefined : function () {}
				}, {
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

			df.on ('exception', function () {
				assert (item.expect === "exception" ? true : false);
				done ();
			});

			if (item.autoRun || item.autoRun == void 0)
				df.run();

		});
	});
});
