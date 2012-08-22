var OAuth = require('lib/node-oauth').OAuth,
	querystring = require('querystring'),
	task = require('task/base'),
	util = require('util');
	
// - - - static	
	
var twitterConfig = project.config.consumerConfig.twitter;

//console.log ('<------twitterConfig', twitterConfig);

	
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
            
			self.completed("http://twitter.com/oauth/authenticate?oauth_token=" + oauth_token);
          }
        
		});
	},
	
	callback: function() {
		
		var self = this;
		var req = self.req;
		var query = req.url.query;
		var tokens = req.user.tokens;
		
		var oa = new OAuth(twitterConfig.requestTokenUrl,
			twitterConfig.accessTokenUrl,
			twitterConfig.consumerKey,
			twitterConfig.consumerSecret,
			"1.0",
			twitterConfig.callbackUrl,
			"HMAC-SHA1");

		oa.getOAuthAccessToken(query.oauth_token, tokens.twitter_oauth_token_secret,
			function(error, oauth_token, oauth_token_secret, additionalParameters ) {
				if (error) {
					self.failed(error);
				} else {
					
					tokens.oauth_token_secret = oauth_token_secret;
					tokens.oauth_token = oauth_token;
					
					self.completed(additionalParameters.user_id);
			}
		});
	},
	
	profile: function() {
		var self = this;
		var req = self.req;
		var tokens = req.user.tokens;
		
		var oa = new OAuth(twitterConfig.requestTokenUrl,
			twitterConfig.accessTokenUrl,
			twitterConfig.consumerKey,
			twitterConfig.consumerSecret,
			"1.0",
			twitterConfig.callbackUrl,
			"HMAC-SHA1");
		
		oa.getProtectedResource(
			"https://api.twitter.com/1/users/show.json?id="+self.userId, 
			"GET", 
			tokens.oauth_token, 
			tokens.oauth_token_secret,
			
			function (error, data, response) {
				
				if (error) {
					self.failed(error.message);
				} else {
					try {
						var user = JSON.parse(data);
						
						//console.log ('<---------user', user);
						
						self.completed(self.mappingUser(user));
					} catch (e) {
						self.failed(e);
					}
				}
			}
		);
	},
	
	getConfiguration : function (callback) {
		var self = this;
		var req = self.req;
		var tokens = req.user.tokens;
		
		var oa = new OAuth(twitterConfig.requestTokenUrl,
			twitterConfig.accessTokenUrl,
			twitterConfig.consumerKey,
			twitterConfig.consumerSecret,
			"1.0",
			twitterConfig.callbackUrl,
			"HMAC-SHA1");

		

		oa.getProtectedResource(
			"https://api.twitter.com/1/help/configuration.json", 
			"GET", 
			tokens.oauth_token, 
			tokens.oauth_token_secret,
			
			function (error, data, response) {
				
				if (error) {
					callback && callback(null);
				} else {
					callback && callback(data);
				}
			}
		);

	},
	
	post : function () {
		var self = this;
		var req = self.req;
		var tokens = req.user.tokens;
		var msg = self.message;
		
		/*
			message = {
				tag,
				url,
				image,
				text
			}
		*/
		
		var oa = new OAuth(twitterConfig.requestTokenUrl,
			twitterConfig.accessTokenUrl,
			twitterConfig.consumerKey,
			twitterConfig.consumerSecret,
			"1.0",
			twitterConfig.callbackUrl,
			"HMAC-SHA1");
		
		//TODO: update_with_media
		// https://upload.twitter.com/1/statuses/update_with_media.json
		// https://dev.twitter.com/docs/api/1/post/statuses/update_with_media
		
		
		oa.post(
		  "http://api.twitter.com/1/statuses/update.json",
		  tokens.oauth_token, 
		  tokens.oauth_token_secret,
		  
		  {"status": msg},
		  
		  function(error, data) {
			if (error) {
				self.completed(JSON.parse(error.data));
			} else {
				self.completed(JSON.parse(data));
			}

		  }
		);

	},
	
	mappingUser: function(user) {
		
		return {
			name: user.name,
			email: user.screen_name+"@twitter.com",
			avatar: user.profile_image_url,
			link: "https://twitter.com/?id="+user.id
		};
		
	}
});