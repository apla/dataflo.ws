#!/usr/bin/env node

/**
 * Example workflow.
 *
 * Will search for a given topic in Twitter and present
 * the resulting JSON.
 */

var httpdi  = require('initiator/http')

project.on ('ready', function () {
	var config = {
		port: 50088,
		static: {
			index: 'index.html',
			root: project.root
		},
		workflows: [{
			url: '/search',
			tasks: [{
				className: 'task/post',
				request: '{$request}',
				produce: 'data.post'
			}, {
				className: 'task/http-client-request',
				require: '{$data.post}',
				requestUrl: 'http://search.twitter.com/search.json',
				urlParams: {
					query: '{$data.post.fields}'
				},
				dataType: 'json',
				produce: 'data.results'
			}],
			presenter: {
				type: 'jade',
				file: 'templates/results.jade',
				vars: '{$data.results}'
			}
		}]
	};

	new httpdi(config);
});