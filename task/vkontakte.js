var OAuth2 = require('oauth').OAuth2,
	querystring = require('querystring'),
	util = require('util'),
	task = require('./base');

// - - - static

var vkontakteConfig = project.config.consumerConfig.vkontakte;
var vkontakteScopes = (vkontakteConfig ? vkontakteConfig.scopes : null);

if (!vkontakteScopes) {

	util.extend (vkontakteConfig, {
		"scopes": {
			"notify": "notify",
			"contacts": "friends",
			"photos": "photos",
			"audio": "audio",
			"video": "video",
			"docs": "docs",
			"notes": "notes",
			"pages": "pages",
			"offers": "offers",
			"questions": "questions",
			"wall": "wall",
			"groups": "groups",
			"messages": "messages",
			"notifications": "notifications",
			"ads": "ads",
			"offline": "offline",
			"nohttps": "nohttps"
		}
	});

	vkontakteScopes = vkontakteConfig.scopes;

//	console.log ('<------vkontakteConfig', vkontakteConfig);
}

// - - -

var vkontakte = module.exports = function(config) {

	this.scopes = [
		"contacts"
	];

	this.init (config);

};

util.inherits (vkontakte, task);

util.extend (vkontakte.prototype, {

	run: function() {

		var self = this;
		self.failed('use method [login|callback|profile]');

	},

	login: function () {

		var self = this;
		var req = self.req;
		var res = self.res;
		var query = req.url.query;

		var scopes = [];

		self.scopes.map(function(scope) {
			scopes.push (vkontakteScopes[scope]);
		});

		var getParams = {
			client_id: vkontakteConfig.appId,
			response_type : "code",
			redirect_uri: vkontakteConfig.callbackUrl,
			scope: scopes.join(','),
		};

		var redirectUrl = vkontakteConfig.requestTokenUrl + "?" + querystring.stringify(getParams);

		self.completed(redirectUrl);
	},

	callback: function() {

		var self = this;
		var req = self.req;
		var query = req.url.query;
		var tokens = req.user.tokens;

		if (query.error || !query.code) {
			self.failed (query.error_description || "token was not accepted");
		}

		var oa = new OAuth2(vkontakteConfig.appId,  vkontakteConfig.appSecret,  vkontakteConfig.baseUrl, vkontakteConfig.authorizeUrl, vkontakteConfig.accessTokenUrl);

		oa.getOAuthAccessToken(
			query.code,
			{},
			function( error, access_token, refresh_token, results){

				if (error) {

					self.failed(error);

				} else {

					tokens.oauth_access_token = access_token;
					if (refresh_token) tokens.oauth_refresh_token = refresh_token;

					self.completed (results.user_id);
				}
		});
	},

	profile: function() {

		var self = this;
		var req = self.req;
		var tokens = req.user.tokens;

		var options = {
			uid: self.userId,
			fields: 'uid,first_name,last_name,photo'
		};

		var oa = new OAuth2(vkontakteConfig.appId,  vkontakteConfig.appSecret,  vkontakteConfig.baseUrl, vkontakteConfig.authorizeUrl, vkontakteConfig.accessTokenUrl);

		oa.getProtectedResource(
			"https://api.vkontakte.ru/method/getProfiles?"+querystring.stringify(options),
			tokens.oauth_access_token,
			function (error, data, response) {

				if (error) {
					self.failed(error);
				} else {
					try {
						var user = JSON.parse(data).response[0];
						self.completed(self.mappingUser(user));
					} catch (e) {
						self.failed(e);
					}
				}
		});
	},

	mappingUser: function(user) {

		return {
			name: user.first_name+' '+user.last_name,
			email: "id"+user.uid+ "@vk.com",
			avatar: user.photo,
			link: "http://vk.com/id"+user.uid,
			authType: 'vk'
		};

	}
});
