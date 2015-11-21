var testCommon = require ("../test/common");
testCommon.injectMain ();

var baseName = testCommon.baseName (__filename);

var testData = testCommon.initTests (baseName);

var verbose = false;

describe (baseName + " running templates", testCommon.runTests.bind (testCommon, testData, {}, verbose));
