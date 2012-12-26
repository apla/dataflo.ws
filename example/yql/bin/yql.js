#!/usr/bin/env node

/**
 * Example workflow.
 *
 * Will search for a given topic in Twitter and present
 * the resulting JSON.
 */

var httpdi  = require('initiator/http');

module.exports.pimp = function (config) {
	return config.obj.toLowerCase();
};

project.on ('ready', function () {
	var config = {
		port: 50088,
		static: {
			index: "index.html",
			root: project.root
		},
		workflows: [{
			url: "/search",
			tasks: [{
				$class: "task/post",
				request: "{$request}",
				produce: "data.post"
			}, {
				$function: "print",
				$args: "{$data.post.fields}",
				$origin: "{$global.console}"
			}, {
				$function: "String.prototype.trim",
				$scope: "{$data.post.fields.q}",
				$args: [],
				produce: "data.trimmedText"
			}, {
				$function: "toUpperCase",
				$origin: "{$data.trimmedText}",
				$args: [],
				produce: "data.upperCasedText"
			}, {
				$function: "global.console.log",
				$args: [ "UPPER CASE", "{$data.upperCasedText}" ]
			}, {
				$function: "pimp",
				obj: "{$data.upperCasedText}",
				produce: "data.pimpedText"
			}, {
				$function: "encodeURIComponent",
				$args: [ 'select * from contentanalysis.analyze ' +
						 'where text="{$data.pimpedText}"' ],
				produce: "data.yql"
			}, {
				$function: "console.log",
				$args: [ "ENCODED ", "{$data.yql}" ]
			}, {
				$class: "task/download",
				url: "http://query.yahooapis.com/v1/public/yql?" +
					"format=json&q={$data.yql}",
				timeout: 10000,
				retries: 10,
				produce: "data.results"
			}],
			presenter: {
				type: "asis",
				vars: "{$data.results.data}"
			}
		}]
	};

	new httpdi(config);
});
