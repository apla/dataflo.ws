var testCommon = require ("../test/common");
testCommon.injectMain ();

var baseName = testCommon.baseName (__filename);

var verbose = false;

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

var testData = {tests: dataflows};

describe (baseName + " running timeout repeat", testCommon.runTests.bind (testCommon, testData, {}, verbose));
