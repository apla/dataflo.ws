var test     = require('utest');
var assert   = require('assert');

var util     = require ('util');

var common   = require ('../common');
var workflow = require ('../workflow');

clearInterval ($stash.currentDateInterval);

var verbose = true;

var tests = [];

var failure = function (desc) {
	return function () {
		test (desc, {'failure test': function () {
			if (verbose) console.log ('failure, ' + desc);
			assert.equal (true, false);
		}});
	}
}

var ok = function (desc) {
	return function () {
		var tests = {};
		tests[desc + 'ok test'] = function () {
			if (verbose) console.log ('ok, ' + desc);
			assert.equal (true, true);
		};
		test (desc, tests);
	};
}

//process.on('uncaughtException', failure ('unhadled exception'));

var workflows = [{
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
	completed: failure ('non-existent-task'),
	failed: ok ('non-existent-task')
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
	failed: failure ('complete + skipped task'),
	completed: ok ('complete + skipped task')
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
	failed: failure ('skipped + skipped task'),
	completed: ok ('skipped + skipped task')
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
	failed: failure ('complete + skipped by requirements task'),
	completed: ok ('complete + skipped by requirements task')
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
	failed: ok ('skipped important task'),
	completed: failure ('skipped important task')
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
	failed: ok ('failed itself important task'),
	completed: failure ('failed itself important task')
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
	failed: ok ('fail task'),
	completed: failure ('fail task')
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
	failed: failure ('fail task'),
	completed: ok ('fail task')
//}, {

}];

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
	
	var independentWf = new workflow (
		util.extend (true, {}, independentConfig.config),
		{request: independentConfig.request}
	);
	
	if (!independentWf.ready)
		return independentConfig.failed ();
	
	independentWf.on ('completed', independentConfig.completed);

	independentWf.on ('failed', independentConfig.failed);

	if (independentConfig.autoRun || independentConfig.autoRun == void 0)
		independentWf.run();

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
	
	var dependentWf = new workflow (
		util.extend (true, {}, dependentConfig.config),
		{request: dependentConfig.request}
	);
	
	if (!dependentWf.ready)
		return dependentConfig.failed ();
	
	dependentWf.on ('completed', dependentConfig.completed);

	dependentWf.on ('failed', dependentConfig.failed);

	if (dependentConfig.autoRun || dependentConfig.autoRun == void 0)
		dependentWf.run();

	
	workflows.map (function (item) {

		var wf = new workflow (
			util.extend (true, {}, item.config),
			{request: item.request}
		);
		
		if (!wf.ready)
			return item.failed ();
		
		wf.on ('completed', item.completed);

		wf.on ('failed', item.failed);

		if (item.autoRun || item.autoRun == void 0)
			wf.run();

	});
	
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
