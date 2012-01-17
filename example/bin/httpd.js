#!/usr/bin/env node

var common   = require ('common');
var httpdi   = require ('initiator/http');

module.exports = {
	generateSomething: function (params) {
		return {
			receivedParamA: params.paramA,
			receivedParamB: params.paramB
		}
	}
};

project.on ('ready', function () {
	
	var config = {
		port: 50088,
		static: {
			index: "index.html",
			root: project.root
		},
		workflows: [{
			url: "/data",
			tasks: [{
				functionName: "generateSomething",
				paramA: "111",
				paramB: "222",
				produce: "data.something"
			}],
			presenter: {
				type: "json",
				vars: "{$data.something}"
			}
		}]
	};

	var initiator = new httpdi (config);

});
