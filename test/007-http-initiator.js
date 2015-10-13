var assert   = require('assert');

var util     = require ('util');
var path     = require ('path');

var baseName = path.basename (__filename, path.extname (__filename));

var flow   = require ("../flow");

var httpi   = require ("../initiator/http");

var tests = [];

//process.on('uncaughtException', failure ('unhadled exception'));

var config = require ("./007-http-initiator.json");

//var testOnly = "redirect";
//var testOnly = "post";

var verbose = false;

describe (baseName + " running http initiator tests", function () {

	var httpDaemon;

	before (function (done) {
		// runs before all tests in this block
		httpDaemon = new httpi (config.initiator.http);
		httpDaemon.on ('ready', done);
	});

	after(function() {
		// runs after all tests in this block
		// httpDaemon.server.close();
	});

	Object.keys (config.tests).forEach (function (token) {
		var item = config.tests[token];
		var method = it;

		if (typeof testOnly !== "undefined" && testOnly) {
			if (testOnly === token) {
				method = it.only;
				verbose = true;
			} else {
				return;
			}
		}

		method (item.description ? item.description + ' ('+token+')' : token, function (done) {

			var df = new flow ({
				tasks: item.tasks,
				templates: config.templates.task,
				logger: verbose || "VERBOSE" in process.env ? undefined : function () {}
			}, {
				// dataflow parameters
				initiator: config.initiator // for host name and port
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
