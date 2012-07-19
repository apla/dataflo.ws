var task = require('task/base'),
	util = require('util'),
	https = require('https'),
	url	= require('url'),
	io = require ('io/easy'),
	crypto = require ('crypto');

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
		var self = this,
			login = self.credentials.login,
			password = self.credentials.password;

		var auth = 'Basic ' + new Buffer(login + ":" + password).toString('base64'),
			options = url.parse(wsdlUrl);
		
		options.method = 'GET';
		options.auth = login + ":" + password;
				
		var req = https.request(options, function(response){
			switch (response.statusCode)
			{
				case 200: 
					self.completed({
						statusCode: 200, 
						err: '', 
						accessAllowed: true
					});
					break;
				default: 
					self.completed({
						statusCode: 401, 
						err: 'User not authorized', 
						accessAllowed: false
					});
					break;
			}
			response.destroy();
		});
		
		req.on('error', function(e) {
		  console.error(e);
		});
		req.end();
	},
	
	profile: function() {
		var self = this,
			ldapRequest = self.ldapResponse,
			sessionUID = self.sessionUID,
			user = ldapRequest.data && ldapRequest.data.length && ldapRequest.data[0],
			credentials = self.credentials;
			
		if (user) {
			user.memberof = user.memberof.map(function(item) {
				return item.split(',')[0].split('=')[1];
			});
			
			var result = {
				"email" : user.mail,
				"name" : user.cn,
				"groupIds" : user.memberof,
				"sessionUIDs" : sessionUID,
				"tokens" : {
					"login" : credentials.login, 
					"password" : credentials.password
				}
			};
			
			if (user.thumbnailphoto){
				var shasum = crypto.createHash('sha1');
				shasum.update(user.mail);
				var filePath = '/images/avatars/'+shasum.digest('hex')+'.png';
				var cacheFileStream = project.root.fileIO('htdocs'+filePath).writeStream({flags: 'w', mode: 0666});
				cacheFileStream.write(new Buffer(user.thumbnailphoto, 'base64'));
				
				result.avatar = filePath;
			}
			if (user.department){
				result.department = user.department;
			}
			if (user.division){
				result.division = user.division;
			}
			
			self.completed(result);
		} else {
			self.failed({
				statusCode: 404,
				msg: 'User Not Found!'
			});
		}
		
	}
});
