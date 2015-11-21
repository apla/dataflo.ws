var testCommon = require ("../test/common");
testCommon.injectMain ();

var baseName = testCommon.baseName (__filename);

var httpi   = require ("../initiator/http");

var testData = testCommon.initTests (baseName);

var verbose = false;

var httpDaemon;

var descriptor = {

	before: function (done) {
		// runs before all tests in this block
		httpDaemon = new httpi (testData.initiator.http);
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

