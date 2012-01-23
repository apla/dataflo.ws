var OAuth = require('oauth').OAuth,
	querystring = require('querystring'),
	task = require('task/base'),
	util = require('util');
	
			
var googleCallback = module.exports = function(config) {

	this.init (config);		

};

util.inherits (googleCallback, task);

util.extend (googleCallback.prototype, {

	run: function () {
		
		var self = this;
		var req = self.req;
		var query = req.url.query;
		
		var oa = new OAuth(req.session._requestUrl,
			"https://www.google.com/accounts/OAuthGetAccessToken",
			"anonymous",
			"anonymous",
			"1.0",
			req.session._authorize_callback,
			"HMAC-SHA1");

		oa.getOAuthAccessToken(

			req.session.oauth_token, 
			req.session.oauth_token_secret, 
			query['oauth_verifier'], 
			function(error, oauth_access_token, oauth_access_token_secret, results) {

				if (error) {
					
					self.failed(error);
					
				} else {

					// store the access token in the session
					req.session.oauth_access_token = oauth_access_token;
					req.session.oauth_access_token_secret = oauth_access_token_secret;
					
					var redirectUrl = (query.action && query.action != "") ? query.action : "/"
					
					self.completed(redirectUrl);
				}
			}
		);
	}
});