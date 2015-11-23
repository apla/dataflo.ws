var testCommon = require ("../test/common");
testCommon.injectMain ();

var baseName = testCommon.baseName (__filename);

var httpi     = require ("../initiator/http");
var flow      = require ("../flow");

var dataflows = require ("../");

var paint = dataflows.color;

var testData = testCommon.initTests (__dirname, baseName);

var verbose = false;

var httpDaemon;

var descriptor = {

	before: function (done) {
		// runs before all tests in this block
		httpDaemon = new httpi (testData.initiator.http, {
			logger: function () {
				var toLog = [].slice.call (arguments);
				var level = toLog.shift() || 'log';

				toLog = this.buildLogString.apply (this, toLog);

				// we don't need date here
				toLog[0] = "|http daemon|";

				toLog = paint.fillUnpainted ('grey', toLog.join (' '));

				(console[level] || console.log).call (console, toLog);

			}
		});
		httpDaemon.on ('ready', done);
	},
	after: function (done) {
		// runs after all tests in this block
		httpDaemon.server.close (done);
	}
};


describe (baseName + " running http initiator tests", testCommon.runTests.bind (descriptor, testData, {
	// dataflow parameters
	initiator: testData.initiator // for host name and port
}, verbose));

