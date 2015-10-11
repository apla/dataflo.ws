var assert   = require('assert');

var util     = require ('util');
var path     = require ('path');

var baseName = path.basename (__filename, path.extname (__filename));

var flow   = require ("../flow");

var tests = [];

//process.on('uncaughtException', failure ('unhadled exception'));

var dataflows = require ("./003-every.json");

// var testOnly = "test:00-expansion";

describe (baseName + " running every", function () {
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

			var df = new flow ({
				tasks: item.tasks,
				logger: "VERBOSE" in process.env ? undefined : function () {}
			}, {
				// dataflow parameters
			});

			if (!df.ready) {
				console.log ("dataflow not ready");
				assert (item.expect === "fail" ? true : false);
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
