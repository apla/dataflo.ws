var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var globalVerbose = process.env.VERBOSE || false;

var files = fs.readdirSync (path.join (__dirname, '..'));

describe ("005 tech debt", function () {
	files.forEach (function (fileName) {
		if (fileName.match (/^\./) || !fileName.match (/\.js$/)) {
			return;
		}
		var fileContents = fs.readFileSync (fileName);
		var todos = fileContents.toString().match (/TODO[^\n\r]+|WTF[^\n\r]+/g);
		if (todos) {
			todos.forEach (function (todoText) {
				it.skip (fileName + ': ' + todoText);
				//			console.log (todoText);
			});
		}

	});

});
