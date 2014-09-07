var util			= require ('util'),
	fs				= require ('fs'),
	urlUtils		= require ('url'),
	querystring     = require ('querystring'),
	httpManager     = require ('./http/model-manager'),
	tough           = require ('tough-cookie');

var HTTPClient, HTTPSClient, followRedirects;

	HTTPClient  = require('http');
	HTTPSClient = require('https');

// - - - - - - -

var pipeProgress = function (config) {
	this.bytesTotal = 0;
	this.bytesPass  = 0; // because bytes can be read and written
	this.lastLogged = 0;
	util.extend (this, config);
};

pipeProgress.prototype.watch = function () {
	var self = this;
	if (this.reader && this.readerWatch) {
		this.reader.on (this.readerWatch, function (chunk) {
			self.bytesPass += chunk.length;
		});
	} else if (this.writer && this.writerWatch) {
		this.writer.on (this.writerWatch, function (chunk) {
			self.bytesPass += chunk.length;
		});
	}
};

/**
 * @class httpModel
 *
 * Wrapper of HTTP(S)Client for serverside requesting.
 *
 */
var httpModel = module.exports = function (modelBase, optionalUrlParams) {
	this.modelBase = modelBase;

	this.params = {};
	this.extendParams(this.params, optionalUrlParams, modelBase.url);

	this.headers = {};

	if (this.params.auth) {
		this.headers.Authorization = 'Basic ' +
			new Buffer(self.params.auth).toString('base64');
	}

	if (this.params.bodyData) {
		this.handleBodyData ();
		var method = this.params.method;
		this.params.method = (method && method.match (/POST|PUT/)) ? method : 'POST';
		this.bodyData = this.params.body;

		if (
			!this.params.headers ||
			!this.params.headers['content-length'] ||
			!this.params.headers['content-type']
		) {
			console.error ('content type/length undefined');
		}
		// TODO: stop request
		delete this.params.bodyData;

	}

	this.redirectCount = 0;
	this.cookieJar = new tough.CookieJar (null, false);

	if (this.params.headers) {
		try {
			util.extend(this.headers, this.params.headers);
			delete this.params.headers;
		} catch (e) {
			console.log ('headers is not correct');
		}
	}
};

httpModel.prototype.handleBodyData = function () {

	var bodyData = this.params.bodyData;

	var contentType = this.params.headers['content-type'],
		postType    = Object.typeOf (bodyData);

	// default object encoding form-urlencoded
	if (!contentType && postType == 'Object') {
		contentType = this.params.headers['content-type']   = 'application/x-www-form-urlencoded';
	} else if (!contentType) {
		contentType = 'undefined';
	}

	switch (contentType) {
	case 'application/x-www-form-urlencoded':
		this.params.body = querystring.stringify (bodyData);
		this.params.headers['content-length'] = this.params.body.length;
		break;
	case 'application/json':
		this.params.body = JSON.stringify (bodyData);
		this.params.headers['content-length'] = this.params.body.length;
		break;
	case 'multipart/mixed':
	case 'multipart/alternate':
		this.emitError ('multipart not yet implemented');
		return;
		break;
	case 'undefined':
		this.emitError ('you must define content type when submitting plain string as post data parameter');
		return;
		break;
	default:
		if (!this.params.headers['content-length']) {
			if (postType == 'String' || postType == 'Buffer') {
				this.params.headers['content-length'] = bodyData.length;
			} else {
				this.emitError ('you must define content-length when submitting plain string as post data parameter');
				return;
			}
		}
		break;
	}

};

util.extend (httpModel.prototype, {
	DefaultParams: {
		protocol: 'http:',
		port: 80,
		method: 'GET'
	},

	/**
	 * Commentary from http://nodejs.org/api/url.html
	 */
	UrlParamNames: [
		'href',
		// The full URL that was originally parsed.
		// Both the protocol and host are lowercased.

		'protocol',
		// The request protocol, lowercased.
		// Example: 'http:'

		'host',
		// The full lowercased host portion of the URL,
		// including port information.
		// Example: 'host.com:8080'

		'auth',
		// The authentication information portion of a URL.
		// Example: 'user:pass'

		'hostname',
		// Just the lowercased hostname portion of the host.
		// Example: 'host.com'

		'port',
		// The port number portion of the host.
		// Example: '8080'

		'pathname',
		// The path section of the URL, that comes after the host
		// and before the query, including the initial slash if present.
		// Example: '/p/a/t/h'

		'search',
		// The 'query string' portion of the URL, including
		// the leading question mark.
		// Example: '?query=string'

		'path',
		// Concatenation of pathname and search.
		// Example: '/p/a/t/h?query=string'

		'query',
		// Either the 'params' portion of the query string,
		// or a querystring-parsed object.
		// Example: 'query=string' or {'query':'string'}

		'hash'
		// The 'fragment' portion of the URL including the pound-sign.
		// Example: '#hash'
	],

	extendParams: function (params, configUrlObj, parsedUrlObj) {
		if (configUrlObj) {
			util.shallowMerge(params, configUrlObj, this.UrlParamNames);
		}

		if (parsedUrlObj) {
			util.shallowMerge(params, parsedUrlObj);
		}

		// add default params if missing
		util.shallowMerge(params, this.DefaultParams);

		params.successCodes = configUrlObj.successCodes;

		params.bodyData = configUrlObj.bodyData;

		// Reformat the merged URL object's compound parts.
		// Don't reorder the lines below.
		params.search = urlUtils.format({
			query: params.query
		});

		params.path = urlUtils.format({
			pathname: params.pathname,
			search: params.search
		});

		params.href = params.href || urlUtils.format(params);

		params.port = params.port || ((this.params.protocol == 'https:') ? 443 : 80);

		return params;
	},

	fetch: function (target) {
		this.target = target;

		this.isStream = target.to instanceof fs.WriteStream;

		if (!this.isStream) target.to.data = new Buffer('');

		this.progress = new pipeProgress ({
			writer: target.to
		});

		// add this for watching into httpModelManager
		global.httpModelManager.add(this, {
			url: this.params,
			headers: this.headers,
			bodyData: this.bodyData
		});

		return this.progress;
	},
	/**
	 * http model needs to return response headers and status code
	 * @param {Object} result result fields
	 */
	addResultFields: function (result) {
		result.code    = this.res.statusCode || 500;
		if (result.stopReason === "timeout")
			result.code = 504;
		result.headers = (this.res.headers) ? this.res.headers : {};
	},
	isSuccessResponse: function check () {
		if (!this.res)
			return false;
		var statusCode = this.res.statusCode;
		if (this.params.successCodes) {
			// format: 2xx,3xx
			var checkRe = new RegExp (this.params.successCodes.replace (/x/g, "\\d").replace (/,/g, "|"));
			if ((""+statusCode).match (checkRe)){
				return true;
			} else {
				return false;
			}
		} else if (statusCode == 200) {
			return true;
		}
		return false;
	},
	/**
	 * called from http model manager
	 * @return {[type]} [description]
	 */
	run: function (params, headers, bodyData) {
		var self = this;

		var Client = (params.protocol == 'https:') ? HTTPSClient : HTTPClient;

		var requestUrl = params.href;

		var req = self.req = Client.request (params, function (res) {

			self.res = res;
			res.responseData = new Buffer("");

			if (res.headers['set-cookie']) {
				if (res.headers['set-cookie'].constructor != Array) {
					res.headers['set-cookie'] = [res.headers['set-cookie']];
				}
				res.headers['set-cookie'].forEach (function (header) {
					self.cookieJar.setCookieSync (header, requestUrl);
					// console.log (self.cookieJar.getCookiesSync (requestUrl));
				});
			}

			var redirected = self.isRedirected (requestUrl, res);
			if (redirected) {
				res.redirected = true;
				self.run (urlUtils.parse (redirected, true), {});
				this.redirectCount ++;
			}
			// if (res.statusCode != 200) {
			// 	self.modelBase.emit (
			// 		'error',
			// 		new Error('statusCode = ' + res.statusCode)
			// 	);
			// 	return;
			// }

			// TODO: handle redirect
			util.extend (self.progress, {
				bytesTotal: res.headers['content-length'],
				reader: res,
				readerWatch: "data"
			});

			self.progress.watch ();

			if (self.isStream) {
				self.writeStream = self.target.to;
				res.pipe(self.writeStream);
			}

			res.on ('error', function (exception) {
				exception.scope = 'response';
				self.modelBase.emit ('error', exception);
			});

			// clean data on redirect
			res.on ('data', function (chunk) {
				if (!self.isStream)
					res.responseData += chunk;
				self.modelBase.emit ('data', chunk);
			});

			res.on ('end', function () {
				if (!res.redirected) {
					self.target.to.data = res.responseData;
					delete res.responseData;
					self.modelBase.emit ('end');
					return;
				}
				self.modelBase.emit ('stop');
				res.jar = self.cookieJar;
			});
		});

		req.on ('error', function (exception) {
			self.res = self.res || {};
			exception.scope = 'request';
			if (self.stopReason)
				exception.stopReason = self.stopReason;
//			console.log (exception);
			self.modelBase.emit ('error', exception);
		});

		if (headers) {
			for (var key in headers) {
				req.setHeader(key, headers[key]);
			}
		}

		this.cookieJar.getCookiesSync (requestUrl).forEach (function (cookie) {
			req.setHeader ('cookie', cookie.cookieString());
		});

		if (bodyData) {
			req.write (bodyData);
		}

		req.end();
	},

	isRedirected: function (reqUrl, res) {

		if (!("" + res.statusCode).match (/^30[1,2,3,5,7]$/)) {
			return false;
		}

		// no `Location:` header => nowhere to redirect
		if (!('location' in res.headers)) {
			return false;
		}

		// we are going to follow the redirect, but in node 0.10 we must first attach a data listener
		// to consume the stream and send the 'end' event
		res.on('data', function() {});

		// save the original clientRequest to our redirectOptions so we can emit errors later

		// need to use url.resolve() in case location is a relative URL
		var redirectUrl = urlUtils.resolve (reqUrl, "" + res.headers.location);
		return redirectUrl;
	},

	stop: function (reason) {
		if (reason)
			this.stopReason = reason;
		if (this.req) this.req.abort();
		if (this.res) this.res.destroy();
	}
});
