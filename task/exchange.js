'use strict';

var task = require('task/base'),
	util = require('util'),
	https = require('https'),
	url	  = require('url');

var exchangeConfig = project.config.consumerConfig.exchange;

var wsdlUrl = exchangeConfig.wsdlUrl;

var exchange = module.exports = function (config) {
	this.init (config);		
};

util.inherits(exchange, task);

util.extend(exchange.prototype, {
	run: function () {
		this.failed('use method [login|callback|profile]');
	},

	login: function () {
		var self = this;
		var login = self.credentials.login,
			password = self.credentials.password,
			sessionUID = self.sessionUID;

		var auth = 'Basic ' + new Buffer(login + ":" + password).toString('base64');

		
		var options = url.parse(wsdlUrl);
		
		options.method = 'GET';
//		options.headers = {
//			'Authorization' : auth,
//			'Accept' : '*/*'
//		};
		options.auth = login + ":" + password;
		
		console.log(options);
		
		var req = https.request(options, function(response){
			console.log(response.statusCode);
			if (response.statusCode == 200)
			{
				self.completed({
					//TODO: find how to find avatar, username and link on portal
					//"avatar" : "",
					"email" : login+exchangeConfig.emailPostfix,
					"name" : login,
					"sessionUIDs" : [
						sessionUID
					],
					"tokens" : {
						"password":password
					}
				});
			}
			response.destroy();
		});
		
		req.on('error', function(e) {
		  console.error(e);
		});
		req.end();
		
		
	}
});
