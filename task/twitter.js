var OAuth = require('oauth').OAuth,
	querystring = require('querystring'),
	task = require('task/base'),
	util = require('util');
	
// - - - static	
	
var twitterConfig = project.config.consumerConfig.twitter;
var twitterScopes = (twitterConfig ? twitterConfig.scopes : null);

if (!twitterScopes) {

	util.extend (twitterConfig, {		
		"scopes": {
			"profile"			: "https://www.googleapis.com/auth/userinfo.profile",
			"userinfo"			: "https://www.googleapis.com/auth/userinfo.email",
			"analytics"			: "https://www.google.com/analytics/feeds/",
			"google_base"		: "https://www.google.com/base/feeds/",
			"google_buzz"		: "https://www.googleapis.com/auth/buzz",
			"book_search"		: "https://www.google.com/books/feeds/",
			"blogger"			: "https://www.blogger.com/feeds/",
			"calendar"			: "https://www.google.com/calendar/feeds/",
			"contacts"			: "https://www.google.com/m8/feeds/",
			"chrome_web store"	: "https://www.googleapis.com/auth/chromewebstore.readonly",
			"documents_list"	: "https://docs.google.com/feeds/",
			"finance"			: "https://finance.google.com/finance/feeds/",
			"gmail"				: "https://mail.google.com/mail/feed/atom",
			"health"			: "https://www.google.com/health/feeds/",
			"h9"				: "https://www.google.com/h9/feeds/",
			"maps"				: "https://maps.google.com/maps/feeds/",
			"moderator"			: "https://www.googleapis.com/auth/moderator",
			"opensocial"		: "https://www-opensocial.googleusercontent.com/api/people/",
			"orkut"				: "https://orkut.gmodules.com/social/rest",
			"picasa_web"		: "https://picasaweb.google.com/data/",
			"sidewiki"			: "https://www.google.com/sidewiki/feeds/",
			"sites"				: "https://sites.google.com/feeds/",
			"spreadsheets"		: "https://spreadsheets.google.com/feeds/",
			"tasks"				: "https://www.googleapis.com/auth/tasks",
			"url_shortener"		: "https://www.googleapis.com/auth/urlshortener",
			"wave"				: "http://wave.googleusercontent.com/api/rpc",
			"webmaster_tools"	: "https://www.google.com/webmasters/tools/feeds/",
			"youtube"			: "https://gdata.youtube.com"
		}
	});
	
	twitterScopes = twitterConfig.scopes;
	
	for (var scope in twitterScopes) {
		twitterScopes[scope] = [twitterScopes[scope], querystring.escape(twitterScopes[scope])];
	}
	
	console.log ('<------------------ twitter',  twitterConfig);

}
	
// - - -

var twitter = module.exports = function(config) {

	this.scopes = [
		"profile",
		"userinfo"
	];

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
		
		var scopes = [];
		
		self.scopes.map(function(scope) {
			scopes.push(twitterScopes[scope][1]);
		});
		
		// TODO: move callback path to config
		
		var query = req.url.query;
		
		var oa = new OAuth(twitterConfig.requestTokenUrl,
			twitterConfig.accessTokenUrl,
			twitterConfig.consumerKey,
			twitterConfig.consumerSecret,
			"1.0",
			twitterConfig.callbackUrl + ( query.action && query.action != "" ? "?action="+querystring.escape(query.action) : "" ),
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