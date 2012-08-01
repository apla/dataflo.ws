#!/usr/bin/env node

var http = require ('http');

var options = {
	host: '127.0.0.1',
	port: 50088,
	path: '/',
	method: 'GET'
};

var toRun     = 10000;
var completed = 0;

var started   = new Date ();

for (var i = 1; i <= toRun; i++) {

	var req = http.request(options, function(res) {
		var buffer = new Buffer (0);
//		console.log('STATUS: ' + res.statusCode);
//		console.log('HEADERS: ' + JSON.stringify(res.headers));
//		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			buffer += chunk;
//			console.log('BODY: ' + chunk);
		});
		res.on ('end', function () {
			var bLength = buffer.length;
//			console.log (bLength);
			completed++;
			if (completed == toRun) {
				var finished = new Date ();
				console.log ('finished in', finished.getTime () - started.getTime (), 'ms');
			}
		});
	});
	
	req.end ();
}

//req.on('error', function(e) {
//  console.log('problem with request: ' + e.message);
//});
//
//// write data to request body
//req.write('data\n');
//req.write('data\n');
//req.end();
