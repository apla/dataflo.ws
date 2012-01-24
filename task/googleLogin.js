var googleConfig	= project.config.consumerConfig.google;
var googleScopes	= googleConfig.scopes;
	
// - - -

var OAuth = require('oauth').OAuth,
	querystring = require('querystring'),
	task = require('task/base'),
	util = require('util');
	
	// console.log ('<------googleConfig', googleConfig);

var googleLogin = module.exports = function(config) {

	this.scopes = [
		"profile",
		"userinfo"
	];

	this.init (config);		

};

util.inherits (googleLogin, task);

util.extend (googleLogin.prototype, {

	run: function () {
		
		var self = this;
		var req = self.req;
		var res = self.res;
		
		var gdataScopes = [];
		
		// GData specifid: scopes that wa want access to
		self.scopes.map(function(scope) {
			gdataScopes.push(googleScopes[scope][1])
		});
		
		// TODO: move callback path to config
		
		var query = req.url.query;
		
		var oa = new OAuth(googleConfig.requestTokenUrl+"?scope="+gdataScopes.join('+'),
			googleConfig.requestTokenUrl,
			googleConfig.clientId,
			googleConfig.clientSecret,
			"1.0",
			googleConfig.callbackUrl + ( query.action && query.action != "" ? "?action="+querystring.escape(query.action) : "" ),
			"HMAC-SHA1");

		oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
		  
			if(error) {
				self.failed('Error: statusCode = '+error.statusCode + ', data = ' + error.data);
			} else { 
				
				// store the oa config in the session
				
				req._requestUrl			= oa._requestUrl;
				req._authorize_callback = oa._authorize_callback;
				
				// - - - and tokens
				
				req.oauth_token = oauth_token;
				req.oauth_token_secret = oauth_token_secret;
				
				var redirectUrl = "https://www.google.com/accounts/OAuthAuthorizeToken?oauth_token="+oauth_token;
				
				self.completed(redirectUrl);
			}
		  
		});
	}
});