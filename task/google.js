var OAuth2 = require('lib/node-oauth').OAuth2,
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
	
//	console.log ('<------------------ google',  googleConfig);

}
	
// - - -

var google = module.exports = function(config) {

	this.scopes = [
		"profile",
		"userinfo"
	];

	this.init (config);
	this.oa = new OAuth2(googleConfig.clientId,  googleConfig.clientSecret,  googleConfig.baseUrl, googleConfig.authorizePath, googleConfig.requestTokenUrl);		

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
		
		var scopes = [];
		
		self.scopes.map(function(scope) {
			scopes.push(googleScopes[scope][1]);
		});
		
		var getParams = {
			client_id: googleConfig.clientId,
			redirect_uri: googleConfig.callbackUrl,
			response_type: 'code',
			state: 'profile'
		};
		
		var redirectUrl = this.oa.getAuthorizeUrl(getParams)+'&scope='+scopes.join('+');
		
		self.completed(redirectUrl);
		
	},
	
	callback: function() {
		
		var self = this,
			req = self.req,
			query = req.url.query;
		
		req.user  = {
			tokens : {}
		};
		
		if (query.error || !query.code) {
			self.failed (query.error_description || "token was not accepted");
		}
		
		this.oa.getOAuthAccessToken(
			query.code,
			{
				redirect_uri: googleConfig.callbackUrl,
				grant_type: 'authorization_code'
			},
			function( error, access_token, refresh_token ){
				
				if (error) {
					
					self.failed(error);
				
				} else {
					
					req.user.tokens.oauth_access_token = access_token;
					if (refresh_token) req.user.tokens.oauth_refresh_token = refresh_token;
					
					var redirectUrl = (query.action && query.action != "") ? query.action : "/";
					self.completed (redirectUrl)
					
				}
		});
	},
	
	profile: function() {
		var self = this;
		var req = self.req;
		var tokens = req.user.tokens;
		
		this.oa.getProtectedResource(
			googleConfig.apiUrl+"/userinfo/v2/me",
			tokens.oauth_access_token,
			function (error, data, response) {
				
				if (error) {
					self.failed(error);
				} else {
					try {
						var user = JSON.parse(data);
						self.completed(self.mappingUser(user));
					} catch (e) {
						self.failed(e);
					}
				}
		});
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