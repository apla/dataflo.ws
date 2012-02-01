#!/usr/bin/env node

/**
 * Example workflow.
 *
 * Will search for a given topic in Twitter and present
 * the resulting JSON.
 */

var common  = require('common')
var httpdi  = require('initiator/http')

project.on ('ready', function () {
	var config = {
		port: 9000,
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
				requestUrl: 'http://search.twitter.com/search.json',
				dataType: 'json',
				query: '{$data.post.fields}',
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