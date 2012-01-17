var test     = require('utest');
var assert   = require('assert');

var common   = require ('../common');
var workflow = require ('../workflow');

var checkTaskParams = workflow.prototype.checkTaskParams;

var data = {
	boolExp: "{$data.bool}",
	stringExp: "{$data.string}",
	stringExp2: "{$badString}",
	stringExp3: "{$okString}",
	numberExp: "{$data.number}",
	inlineExp: "{$data.string}-{$data.number}",
	arrayExp: "{$arr}",
	objectExp: "{$data}",

};

var dict = {
	data: {
		bool: true,
		string: "string",
		number: 123
	},
	badString: "{$",
	okString: "}",
	arr: ['a', 'b']
};

test('check task requirements', {
	'expandFailNoThrow': function() {
		var result = checkTaskParams (data, dict);
		assert.deepEqual (result.failed, ['stringExp2']);
	},

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

});
