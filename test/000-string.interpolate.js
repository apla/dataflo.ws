var test   = require('utest');
var assert = require('assert');

var common = require ('../common');

var data = {
	boolExp: "{$data.bool}",
	stringExp: "{$data.string}",
	stringExp2: "{$badString}",
	stringExp3: "{$okString}",
	numberExp: "{$data.number}",
	inlineExp: "{$data.string}-{$data.number}",
	arrayExp: "{$arr}",
	objectExp: "{$data}",
	indexedExp: "{$nestedData.arr.0}",
	indexedZeroPropExp: "{$nestedData.arr.0.record}",
	indexedNonZeroPropExp: "{$nestedData.arr.1.record}",

};

var dict = {
	data: {
		bool: true,
		string: "string",
		number: 123
	},
	nestedData: {
		arr: [
			{ record: 'a' },
			{ record: 'b' }
		]
	},
	badString: "{$",
	okString: "}",
	arr: ['a', 'b'],
};

test('interpolate', {
	'expandBoolean': function() {
		var result = data.boolExp.interpolate (dict);
		assert.strictEqual (result, true);
	},

	'expandString': function() {
		var result = data.stringExp.interpolate (dict);
		assert.strictEqual (result, "string");
	},
	'expandString2': function() {
		assert.throws (function () {
			var result = data.stringExp2.interpolate (dict);
		});
	},
	'expandString3': function() {
		var result = data.stringExp3.interpolate (dict);
		assert.strictEqual (result, "}");
	},

	'expandNumber': function() {
		var result = data.numberExp.interpolate (dict);
		assert.strictEqual (result, 123);
	},

	'expandInline': function() {
		var result = data.inlineExp.interpolate (dict);
		assert.strictEqual (result, "string-123");
	},

	'expandArray': function() {
		var result = data.arrayExp.interpolate (dict);
		assert.deepEqual (result, ['a', 'b']);
	},

	'expandObject': function() {
		var result = data.objectExp.interpolate (dict);
		assert.deepEqual (result, {
			bool: true,
			string: "string",
			number: 123
		});
	},

	'expandIndexed': function() {
		var result = data.indexedExp.interpolate (dict);
		console.log(result);
		assert.deepEqual (result, { record: 'a' });
	},

	'expandIndexedZeroProp': function() {
		var result = data.indexedZeroPropExp.interpolate (dict);
		console.log(result);
		assert.equal (result, 'a');
	},

	'expandIndexedNonZeroProp': function() {
		var result = data.indexedNonZeroPropExp.interpolate (dict);
		console.log(result);
		assert.equal (result, 'b');
	}
});
