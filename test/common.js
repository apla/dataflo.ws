var assert    = require('assert');

var util      = require ('util');
var path      = require ('path');

var dataflows = require ("../");
var flow      = require ("../flow");

var dfProject = require ('../project');

var paint = dataflows.color;


var injects = {
	dfHandleGet: function (params) {
		// http server test:
		// 1) just request, check for User-Agent
		// 2) get request with query string
		// 3) post request
		if (params.cookieAndRedirect) {
			return true;
		}
		// if (checkCookie) {

		// }
	},
	dfShowBuffer: function (buf) {
		console.log (buf.toString ());
	},
	dfThrowUnlessEqual: function () {
		var msg = arguments[2] || '';
		if (arguments[0] == arguments[1]) {
			console.log (msg, arguments[0], '==', arguments[1]);
			return arguments[0] || true;
		} else {
			console.error (msg, arguments[0], '==', arguments[1]);
			throw ('arguments not equal');
		}
	},
	dfThrowUnlessDefined: function () {
		for (var argIdx = 0; argIdx < arguments.length; argIdx ++) {
			if (typeof arguments[argIdx] == "undefined")
				throw ('argument '+argIdx+' not defined');
		}

	},
	dfThrowNow: function () {
		throw ('defined');
	},
	dfHandleGet: function (params) {
		// http server test:
		// 1) just request, check for User-Agent
		// 2) get request with query string
		// 3) post request
		if (params.cookieAndRedirect) {
			return true;
		}
		// if (checkCookie) {

		// }
	},
	dfGetPromise: function (delay, arg, result) {
		var ayepromise = require ("ayepromise");

		var defer = ayepromise.defer();
		setTimeout (function () {
			if (result) {
				defer.resolve (arg);
			} else {
				defer.reject (arg);
			}
		}, delay);
		return defer.promise;
	},
	dfErrback: function (delay, arg, result) {
		var cb = arguments[arguments.length - 1];
		setTimeout (function () {
			if (result) {
				cb (null, arg);
			} else {
				cb (arg);
			}
		}, delay);
	},
	dfDataObject: function (data) {
		return data || {a: ['b', 'c']};
	}
};

function injectMain () {
	for (var fnName in injects) {
		require.main.exports[fnName] = injects[fnName];
	}
}

function baseName (modulePath) {
	return path.basename (modulePath, path.extname (modulePath));
}

function initTests (dirName, baseName) {

	//process.on('uncaughtException', failure ('unhadled exception'));

	var testData = require (path.join (dirName, baseName+".json"));

	return testData;
}

function runTests (config, dfParams, verbose) {

	if (this.before)
		before (this.before);

	if (this.beforeEach)
		beforeEach (this.beforeEach);

	if (this.after)
		after (this.after);

	if (this.afterEach)
		afterEach (this.afterEach);

	Object.keys (config.tests).forEach (function (token) {
		var item = config.tests[token];
		var method = it;

		if (item.only) {
			method = it.only;
			verbose = true;
		} else if (item.skip) {
			method = it.skip;
		}

		if (!config.templates) config.templates = {task: {}};

		method (item.description ? item.description + ' ('+token+')' : token, function (done) {

			var df = new flow ({
				tasks: item.tasks,
				templates: config.templates.task,
				logger: verbose || "VERBOSE" in process.env ? undefined : function () {}
			}, dfParams);

			if (!df.ready) {
				console.log ("dataflow not ready");
				assert (item.expect === "fail" ? true : false);
				done ();
				return;
			}

			function dfStatus (df) {
				console.log ('dataflow token:', token);
				if (df.failed) {
					console.log ("failed tasks:");
					df.tasks.forEach (function (task, idx) {
						if (task.state === 5) { // error
							console.log (idx + ': ' + util.inspect (task.originalConfig));
						}
					});
				}
				console.log ("flow data:");
				delete (df.data.initiator);
				delete (df.data.appMain);
				delete (df.data.project);
				console.log (util.inspect (df.data));
			}

			df.on ('completed', function () {
				var passed = item.expect === "ok" ? true : false;
				if (!passed) dfStatus (df);
				assert (passed);
				done ();
			});

			df.on ('failed', function () {
				var passed = item.expect === "fail" ? true : false;
				if (!passed) dfStatus (df);
				assert (passed);
				done ();
			});

			if (item.autoRun || item.autoRun == void 0)
				df.run();

		});
	});
}

module.exports = {
	injectMain: injectMain,
	initTests:  initTests,
	runTests:   runTests,
	baseName:   baseName
};
