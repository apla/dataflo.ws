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

var dataflows = require ("./004-template.json");

var templates = {
	"jsonParseAndMerge": {
		"$origin":    "{$global.JSON}",
		"$function":  "parse",
		"$mergeWith": "result"
	},
	"jsonParseAndSet": {
		"$origin":    "{$global.JSON}",
		"$function":  "parse",
		"$set":       "result"
	},
	"indexEqItem": {
		"$function": "throwUnlessEqual",
		"$args": [
			"[*every.index]",
			"[*every.item]"
		]
	},
	"testHttpResource": {
		"$class":"remoteResource",
		"$method": "toBuffer"
	}
};


describe ("running every", function () {
	Object.keys (dataflows).forEach (function (token) {
		var item = dataflows[token];
		it (item.description || token, function (done) {

			var df = new flow (
				util.extend (true, {}, item),
				{
					// dataflow parameters
					templates: templates
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
