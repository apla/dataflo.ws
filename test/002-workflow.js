var util     = require ('util');
var path     = require ('path');

var assert   = require ('assert');

var df     = require ("../");
var flow   = require ("../flow");

var baseName = path.basename (__filename, path.extname (__filename));

var testCommon = require ("../test/common");
testCommon.injectMain ();

var tests = [];

var verbose = false;

//process.on('uncaughtException', failure ('unhadled exception'));

var dataflows = [{
	description: "task failed at constructor call",
	config: {
		tasks: [{
			className: "non-existent-task",
			produce: "data.ok"
		}]
	},
	request: {
		test: true
	},
	completed: false,
	failed: true
}, {
	description: "one completed and one skipped task",
	config: {
		tasks: [{
			className: "./test/task/002-ok-task",
			produce: "data.ok"
		}, {
			className: "./test/task/002-skip-task",
			requires: "{$data.ok}",
			produce: "data.skip"
		}]
	},
	request: {
		test: true
	},
	failed: false,
	completed: true
}, {
	description: "task without run method",
	config: {
		tasks: [{
			className: "./test/task/002-task-methodless",
			produce: "data.ok"
		}, {
			className: "./test/task/002-task-methodless",
			method: "methodName",
			produce: "data.skip"
		}]
	},
	failed: false,
	completed: true
}, {
	description: "two skipped tasks",
	config: {
		tasks: [{
			className: "./test/task/002-skip-task",
			produce: "data.skip1"
		}, {
			className: "./test/task/002-skip-task",
			produce: "data.skip2"
		}]
	},
	request: {
		test: true
	},
	failed: false,
	completed: true
}, {
	description: "it's ok to skip some tasks if requirements not satisfied",
	config: {
		tasks: [{
			className: "./test/task/002-ok-task",
			produce: "data.ok"
		}, {
			className: "./test/task/002-skip-task",
			requires: "{$data.nothing}",
			produce: "data.skip"
		}]
	},
	request: {
		test: true
	},
	failed: false,
	completed: true
}, {
	description: "skipped important task",
	config: {
		tasks: [{
			className: "./test/task/002-ok-task",
			produce: "data.ok"
		}, {
			className: "./test/task/002-skip-task",
			important: true,
			requires: "{$data.nothing}",
			produce: "data.skip"
		}]
	},
	request: {
		test: true
	},
	failed: true,
	completed: false
}, {
	description: "important task decide itself fail or skip",
	config: {
		tasks: [{
			className: "./test/task/002-skip-task",
			important: true,
			produce: "data.ok"
		}]
	},
	request: {
		test: true
	},
	failed: true,
	completed: false
}, {
	description: "fail task",
	config: {
		tasks: [{
			className: "./test/task/002-fail-task",
			produce: "data.fail"
		}]
	},
	request: {
		test: true
	},
	failed: true,
	completed: false
}, {
	description: "no tasks",
	config: {
	},
	request: {
		test: true
	},
	failed: true,
	completed: false
}, {
	description: "it is ok not to run anything when no importnat task is defined",
	config: {
		tasks: [{
			className: "./test/task/002-ok-task",
			if: "{$unexisting}",
			produce: "data.ok"
		}]
	},
	failed: false,
	completed: true
}, {
	description: "flow unready because of absent requirements",
	config: {
		tasks: [{
			className: "./test/task/002-ok-task",
			important: true,
			if: "{$unexisting}",
			produce: "data.ok"
		}]
	},
	failed: true,
	completed: false
}, {
	description: "no task",
	config: {
		tasks: [{
		}]
	},
	request: {
		test: true
	},
	failed: true,
	completed: false
}, {
	description: "fail task is skipped by requirements",
	config: {
		tasks: [{
			className: "./test/task/002-ok-task",
			produce: "data.ok"
		}, {
			className: "./test/task/002-fail-task",
			requires: "{$data.ok}",
			produce: "data.fail"
		}]
	},
	request: {
		test: true
	},
	failed: true,
	completed: false
}, {
	description: "data merge test",
	// only: true,
	config: {
		tasks: [{
			fn: "dfDataObject",
			$args: {"a": "b"},
			$mergeWith: "data"
		}, {
			fn: "dfDataObject",
			$args: {"c": "d"},
			$mergeWith: "data"
		}, {
			fn: "dfDataObject",
			$mergeWith: "data"
		}, {
			fn: "console.log",
			important: true,
			$args: ["{$data.a}", "{$data.c}"],
		}]
	},
	failed: false,
	completed: true
}, {
	description: "empty data branch",
	config: {
		tasks: [{
			task: "./test/task/002-ok-task",
			method: "emptyMethod",
			setOnEmpty: "empty"
		}, {
			fn: "console.log",
			important: true,
			$args: ["{$empty}"],
		}]
	},
	failed: false,
	completed: true

//}, {

}];

describe (baseName + " running dataflow", function () {
	dataflows.map (function (item) {

		var method = it;

		if (item.only) {
			method = it.only;
			verbose = true;
		}

		method (item.description, function (done) {

			var df = new flow (
				{
					tasks: item.config.tasks,
					logger: ("VERBOSE" in process.env) || verbose ? undefined : function () {}
				}, {
					request: item.request
				}
			);

//			if (!df.ready) {
//				console.log ("dataflow not ready");
//				assert (item.failed === true);
//				done ();
//				return;
//			}

			function dfStatus (df) {
				if (df.failed) {
					console.log ("failed tasks:");
					df.tasks.forEach (function (task, idx) {
						if (task.state === 5) { // error
							console.log (idx + ': ' + util.inspect (task.originalConfig));
						}
					});
				}
				if (verbose) console.log (df);
				console.log ("flow data:");
				delete (df.data.initiator);
				delete (df.data.appMain);
				delete (df.data.project);
				console.log (util.inspect (df.data));
			}

			df.on ('completed', function () {
				var passed = item.completed === true ? true : false;
				if (!passed || verbose) dfStatus (df);
				assert (passed);
				done ();
			});

			df.on ('failed', function () {
				var passed = item.failed === true ? true : false;
				if (!passed || verbose) dfStatus (df);
				assert (passed);
				done ();
			});

			df.on ('exception', function () {
				assert (item.exception === true);
				done ();
			});

			if (item.autoRun || item.autoRun == void 0)
				df.run();

		});
	});
});


return;

var started = new Date ();

var repeat = parseInt (process.argv[2]) || 1;

repeat.times (function () {

	var independentConfig = {
		description: "1000 independent tasks",
		config: {
			tasks: []
		},
		request: {
			test: true
		},
		failed: failure ('1000 independent tasks'),
		completed: ok ('1000 independent tasks')

	};

	1000..times (function (num) {
		independentConfig.config.tasks.push ({
			className: "./test/task/002-ok-task",
			produce: "data.ok"+num
		});
	});

	var independentDf = new flow (
		util.extend (true, {}, independentConfig.config),
		{request: independentConfig.request}
	);

	if (!independentDf.ready)
		return independentConfig.failed ();

	independentDf.on ('completed', independentConfig.completed);

	independentDf.on ('failed', independentConfig.failed);

	if (independentConfig.autoRun || independentConfig.autoRun == void 0)
		independentDf.run();

	var dependentConfig = {
		description: "1000 dependent tasks",
		config: {
			tasks: []
		},
		request: {
			test: true
		},
		failed: failure ('1000 dependent tasks'),
		completed: ok ('1000 dependent tasks')

	};

	dependentConfig.config.tasks.push ({
		className: "./test/task/002-ok-task",
		produce: "data.ok0"
	});

	999..times (function (num) {
		dependentConfig.config.tasks.push ({
			className: "./test/task/002-ok-task",
			produce: "data.ok"+(num+1),
			require: "{$data.ok"+num+"}"
		});
	});

	var dependentDf = new flow (
		util.extend (true, {}, dependentConfig.config),
		{request: dependentConfig.request}
	);

	if (!dependentDf.ready)
		return dependentConfig.failed ();

	dependentDf.on ('completed', dependentConfig.completed);

	dependentDf.on ('failed', dependentConfig.failed);

	if (dependentConfig.autoRun || dependentConfig.autoRun == void 0)
		dependentDf.run();

});

process.on('exit', function () {
	var finished = new Date ();
	console.error ('finished in', finished.getTime () - started.getTime (), 'ms');
});

//test('check task requirements', {
//	'expandFailNoThrow': function() {
//		var result = checkTaskParams (data, dict);
//		assert.deepEqual (result.failed, [
//			"checkFalse.falseExp",
//			"checkFalse.zeroExp",
//			"checkFalse.emptyExp",
//			"checkFalse.emptyArr",
//			"checkFalse.emptyObj",
//
//			"exception.stringExp2",
//			"exception.nothing"
//		]);
//	},
//
//});
