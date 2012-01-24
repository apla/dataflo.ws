var OAuth = require('oauth').OAuth,
	querystring = require('querystring'),
	task = require('task/base'),
	util = require('util');
	
			
var facebookCallback = module.exports = function(config) {

	this.init (config);		

};

util.inherits (facebookCallback, task);

util.extend (facebookCallback.prototype, {

	run: function () {
		
		var self = this;
		var req = self.req;
		var query = req.url.query;
		var tokens = req.user.tokens;
		
		var oa = new OAuth(tokens._requestUrl,
			"https://www.google.com/accounts/OAuthGetAccessToken",
			"anonymous",
			"anonymous",
			"1.0",
			tokens._authorize_callback,
			"HMAC-SHA1");

		oa.getOAuthAccessToken(

			tokens.oauth_token, 
			tokens.oauth_token_secret, 
			query['oauth_verifier'], 
			function(error, oauth_access_token, oauth_access_token_secret, results) {

				if (error) {
					
					self.failed(error);
					
				} else {

					// store the access token in the session
					tokens.oauth_access_token = oauth_access_token;
					tokens.oauth_access_token_secret = oauth_access_token_secret;
					
					var redirectUrl = (query.action && query.action != "") ? query.action : "/"
					self.completed(redirectUrl);
				}
			}
		);
	}
});