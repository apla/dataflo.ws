var path   = require ('path');
var assert = require ('assert');

var common   = require ('../common');
var dataflow = require ('../flow');

clearInterval (global.currentDateInterval);

var baseName = path.basename (__filename, path.extname (__filename));

var checkTaskParams  = dataflow.prototype.checkTaskParams;
var taskRequirements = dataflow.prototype.taskRequirements;

var data = {
	boolExp: "{$data.bool}",
	checkFalse: {
		falseExp: "{$data.no}",
		zeroExp: "{$data.zero}",
		emptyExp: "{$data.empty}",
		emptyArr: "{$data.emptyArr}",
		emptyObj: "{$data.emptyObj}"
	},
	exception: {
		nothing: "{$erlkjgnwlekrjgn}"
	},
	stringExp: "{$data.string}",
	stringExp3: "{$okString}",
	numberExp: "{$data.number}",
	inlineExp: "{$data.string}-{$data.number}",
	arrayExp: "{$arr}",
	objectExp: "{$data}",
	arrayExtExp: ["{$data}", "{$data.number}"]

};

var dict = {
	data: {
		bool: true,
		string: "string",
		number: 123,
		zero: 0,
		no: false,
		empty: "",
		emptyArr: [],
		emptyObj: {}
	},
	badString: "{$",
	okString: "}",
	arr: ['a', 'b'],
};

describe (baseName + ' check task requirements', function () {
	it ('expandFailNoThrow', function() {
		var result = checkTaskParams (data, dict);
		// console.log (result);
		assert.strictEqual (result.modified.arrayExtExp[1], 123);
		assert.deepEqual (result.failed, [
			"checkFalse.falseExp",
			"checkFalse.zeroExp",
			"checkFalse.emptyExp",
			"checkFalse.emptyArr",
			"checkFalse.emptyObj",

			"exception.nothing"
		]);
	})
});


// test('compare interpolation', {
// 	'simple': function() {
// 		var byTreeWalk = checkTaskParams (data, dict);
// //		console.log (result);

// 		var interpolateWhat  = common.findInterpolation (data);
// 		var taskWaitingFor   = taskRequirements (interpolateWhat, dict);

// 		// strictly saying string exception below is incorrect
// 		// because pathToVal is flawed
// 		assert.deepEqual (taskWaitingFor, [
// 			'checkFalse.falseExp',
// 			'checkFalse.zeroExp',
// 			'checkFalse.emptyExp',
// 			'checkFalse.emptyArr',
// 			'checkFalse.emptyObj',
// 			'exception.nothing'
// 		]);

// 		console.log (taskWaitingFor);

// //		var byDirectValueSet = ;

// 		assert.strictEqual (byTreeWalk.modified.arrayExtExp[1], 123);
// 		assert.deepEqual (byTreeWalk.failed, [
// 			"checkFalse.falseExp",
// 			"checkFalse.zeroExp",
// 			"checkFalse.emptyExp",
// 			"checkFalse.emptyArr",
// 			"checkFalse.emptyObj",

// 			"exception.stringExp2",
// 			"exception.nothing"
// 		]);
// 	}
// });


//	'expandString': function() {
//		var result = data.stringExp.interpolate (dict);
//		assert.strictEqual (result, "string");
//	},
//	'expandString2': function() {
//		assert.throws (function () {
//			var result = data.stringExp2.interpolate (dict);
//		});
//	},
//	'expandString3': function() {
//		var result = data.stringExp3.interpolate (dict);
//		assert.strictEqual (result, "}");
//	},
//
//	'expandNumber': function() {
//		var result = data.numberExp.interpolate (dict);
//		assert.strictEqual (result, 123);
//	},
//
//	'expandInline': function() {
//		var result = data.inlineExp.interpolate (dict);
//		assert.strictEqual (result, "string-123");
//	},
//
//	'expandArray': function() {
//		var result = data.arrayExp.interpolate (dict);
//		assert.deepEqual (result, ['a', 'b']);
//	},
//
//	'expandObject': function() {
//		var result = data.objectExp.interpolate (dict);
//		assert.deepEqual (result, {
//			bool: true,
//			string: "string",
//			number: 123
//		});
//	}
