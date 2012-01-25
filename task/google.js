var OAuth = require('oauth').OAuth,
	querystring = require('querystring'),
	task = require('task/base'),
	util = require('util');
	
// - - - static	
	
var googleConfig = project.config.consumerConfig.google;
var googleScopes = (googleConfig ? googleConfig.scopes : null);

if (!googleScopes) {

	util.extend (googleConfig, {		
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
	
	googleScopes = googleConfig.scopes;
	
	for (var scope in googleScopes) {
		googleScopes[scope] = [googleScopes[scope], querystring.escape(googleScopes[scope])];
	}
	
	console.log ('<------------------ google',  googleConfig);

}
	
// - - -

var google = module.exports = function(config) {

	this.scopes = [
		"profile",
		"userinfo"
	];

	this.init (config);		

};

util.inherits (google, task);

util.extend (google.prototype, {

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
			scopes.push(googleScopes[scope][1]);
		});
		
		// TODO: move callback path to config
		
		var query = req.url.query;
		
		var oa = new OAuth(googleConfig.requestTokenUrl+"?scope="+scopes.join('+'),
			googleConfig.requestTokenUrl,
			googleConfig.clientId,
			googleConfig.clientSecret,
			"1.0",
			googleConfig.callbackUrl + ( query.action && query.action != "" ? "?action="+querystring.escape(query.action) : "" ),
			"HMAC-SHA1");

		oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
		  
			if(error) {
		
				self.failed(error);
			
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
	},
	
	callback: function() {
		
		var self = this;
		var req = self.req;
		var query = req.url.query;
		var tokens = req.user.tokens;
		
		var oa = new OAuth(tokens._requestUrl,
			googleConfig.accessTokenUrl,
			googleConfig.clientId,
			googleConfig.clientSecret,
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
	},
	
	profile: function() {
		var self = this;
		var req = self.req;
		var tokens = req.user.tokens;
		
		var oa = new OAuth(tokens._requestUrl,
			googleConfig.accessTokenUrl,
			googleConfig.clientId,
			googleConfig.clientSecret,
			"1.0",
			tokens._authorize_callback,
			"HMAC-SHA1");
		
		oa._headers['GData-Version'] = '2'; 
		
		oa.getProtectedResource(
			"https://www.googleapis.com/oauth2/v1/userinfo", 
			"GET", 
			tokens.oauth_access_token, 
			tokens.oauth_access_token_secret,
			function (error, data, response) {
				
				if (error) {
					self.failed(error.message);
				} else {
					try {
						var user = JSON.parse(data);
						self.completed(self.mappingUser(user));
					} catch (e) {
						self.failed(e);
					}
				}
			}
		);
	},
	
	mappingUser: function(user) {
		
		return {
			name: user.name,
			email: user.email,
			avatar: user.picture,
			link: user.link
		};
		
	}
});