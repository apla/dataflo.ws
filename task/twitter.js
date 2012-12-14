var OAuth = require('oauth').OAuth,
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

            //req.twitter_redirect_url = req.url;
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
console.log('0');
		var req = self.req;
console.log('1');
		var tokens = req.user.tokens;
console.log('2',req);
		var oa = new OAuth(twitterConfig.requestTokenUrl,
			twitterConfig.accessTokenUrl,
			twitterConfig.consumerKey,
			twitterConfig.consumerSecret,
			"1.0",
			twitterConfig.callbackUrl,
			"HMAC-SHA1");

console.log('2', self.userId);

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
		var url, ctype;

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

		if (msg['media[]']) {
			url = 'https://upload.twitter.com/1/statuses/update_with_media.json';
			ctype = 'multipart/form-data';
		} else {
			url = 'http://api.twitter.com/1/statuses/update.json';
			ctype = 'application/x-www-form-urlencoded';
		}

		//console.log('TW', url, ctype, msg);

		oa.post(
			url,
			tokens.oauth_token,
			tokens.oauth_token_secret,
			msg,
			ctype,
			function(error, data) {
				var ret;
				if (error) {
					console.log('ERR!', error);
					try {
						ret = JSON.parse(error.data);
					} catch (e) {
						ret = error.data;
					}
					self.completed(ret);
				} else {
					console.log('TW.OK', data);
					self.completed(JSON.parse(data));
				}
			}
		);

	},

	multipartPost : function (msg) {
		var self = this;
		var crlf = "\r\n";
		var boundary = '---------------------------10102754414578508781458777923';

		var separator = '--' + boundary;
		var footer = crlf + separator + '--' + crlf;
		var fileHeader = 'Content-Disposition: file; name="media"; filename="' + photoName + '"';

		var contents = separator + crlf +
				'Content-Disposition: form-data; name="status"' + crlf +
				crlf +
				tweet + crlf +
				separator + crlf +
				fileHeader + crlf +
				'Content-Type: image/jpeg' +  crlf +
				crlf;

		var multipartBody = Buffer.concat([
			new Buffer(contents),
			image,
			new Buffer(footer)]);

		var hostname = 'upload.twitter.com';
		var authorization = oauth.authHeader(
			'https://upload.twitter.com/1/statuses/update_with_media.json',
			accessToken, tokenSecret, 'POST');

		var headers = {
			'Authorization': authorization,
			'Content-Type': 'multipart/form-data; boundary=' + boundary,
			'Host': hostname,
			'Content-Length': multipartBody.length,
			'Connection': 'Keep-Alive'
		};

		var options = {
			host: hostname,
			port: 443,
			path: '/1/statuses/update_with_media.json',
			method: 'POST',
			headers: headers
		};

		var request = https.request(options);
		request.write(multipartBody);
		request.end();

		request.on('error', function (err) {
			console.log('Error: Something is wrong.\n'+JSON.stringify(err)+'\n');
		});

		request.on('response', function (response) {
			response.setEncoding('utf8');
			response.on('data', function (chunk) {
				console.log(chunk.toString());
			});
			response.on('end', function () {
				console.log(response.statusCode +'\n');
				res.end();
			});
		});

	},

	mappingUser: function(user) {

		return {
			name: user.name,
			email: user.screen_name+"@twitter.com",
			avatar: user.profile_image_url,
			link: "https://twitter.com/?id="+user.id,
			authType: 'twitter'
		};

	}
});
