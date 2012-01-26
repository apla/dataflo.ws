var OAuth = require('oauth').OAuth,
	querystring = require('querystring'),
	task = require('task/base'),
	util = require('util');
	
// - - - static	
	
var twitterConfig = project.config.consumerConfig.twitter;

console.log ('<------twitterConfig', twitterConfig);

	
// - - -

var twitter = module.exports = function(config) {

	this.init (config);		

};

util.inherits (twitter, task);

util.extend (twitter.prototype, {

	run: function() {
		
		var self = this;
		self.failed('use method [login|callback|profile]');
		
	},
	
	login: function () {
		
		var self = this;
		var req = self.req;
		var res = self.res;
		
		var query = req.url.query;
		
		var oa = new OAuth(twitterConfig.requestTokenUrl,
			twitterConfig.accessTokenUrl,
			twitterConfig.consumerKey,
			twitterConfig.consumerSecret,
			"1.0",
			twitterConfig.callbackUrl,
			"HMAC-SHA1");

		oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, oauth_authorize_url, additionalParameters ) {
		
          if (error) {
            
			self.failed(error);
          
		  } else {
		  
            req.twitter_redirect_url = req.url;
            req.twitter_oauth_token_secret = oauth_token_secret;
            req.twitter_oauth_token = oauth_token;
            
			self.complete("http://twitter.com/oauth/authenticate?oauth_token=" + oauth_token);
          }
        
		});
	},
	
	callback: function() {
		
		var self = this;
		var req = self.req;
		var query = req.url.query;
		var tokens = req.user.tokens;
		
		var oa = new OAuth(tokens._requestUrl,
			twitterConfig.accessTokenUrl,
			twitterConfig.clientId,
			twitterConfig.clientSecret,
			"1.0",
			tokens._authorize_callback,
			"HMAC-SHA1");

		oa.getOAuthAccessToken(query.oauth_token, tokens.twitter_oauth_token_secret,
			function(error, oauth_token, oauth_token_secret, additionalParameters ) {
				if (error) {
					self.failed(error);
				} else {
					
					tokens.twitter_oauth_token_secret = oauth_token_secret;
					tokens.twitter_oauth_token = oauth_token;
					
					console.log (additionalParameters);
					
					self.complete(self.mappingUser(additionalParameters));
			}
		});
	},
	
//	profile: function() {
//		var self = this;
//		var req = self.req;
//		var tokens = req.user.tokens;
//		
//		var oa = new OAuth(tokens._requestUrl,
//			twitterConfig.accessTokenUrl,
//			twitterConfig.clientId,
//			twitterConfig.clientSecret,
//			"1.0",
//			tokens._authorize_callback,
//			"HMAC-SHA1");
//		
//		oa._headers['GData-Version'] = '2'; 
//		
//		oa.getProtectedResource(
//			"https://www.googleapis.com/oauth2/v1/userinfo", 
//			"GET", 
//			tokens.oauth_access_token, 
//			tokens.oauth_access_token_secret,
//			function (error, data, response) {
//				
//				if (error) {
//					self.failed(error.message);
//				} else {
//					try {
//						var user = JSON.parse(data);
//						self.completed(self.mappingUser(user));
//					} catch (e) {
//						self.failed(e);
//					}
//				}
//			}
//		);
//	},
	
	mappingUser: function(user) {
		
		var user = {
			user_id: user.user_id,
			username: user.screen_name
		};
		
		
		return {
			name: user.name,
			email: user.email,
			avatar: user.picture,
			link: user.link
		};
		
	}
});