var util			= require ('util'),
	fs				= require ('fs'),
	urlUtils		= require ('url'),
	querystring     = require ('querystring'),
	httpManager     = require ('./http/model-manager');

var HTTPClient, HTTPSClient, followRedirects;

try {
	followRedirects = require('follow-redirects');
	HTTPClient  = followRedirects.http;
	HTTPSClient = followRedirects.https;
} catch (e) {
	console.warn(
		'Falling back to standard HTTP(S) client.',
		'If you want to follow redirects,',
		'install "follow-redirects" module.'
	);
	HTTPClient  = require('http');
	HTTPSClient = require('https');
}

// - - - - - - -

var pipeProgress = function (config) {
	this.bytesTotal = 0;
	this.bytesPass  = 0; // because bytes can be read and written
	this.lastLogged = 0;
	util.extend (this, config);
}

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
}

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
		this.headers['Authorization'] = 'Basic ' +
			new Buffer(self.params.auth).toString('base64');
	}

	if (this.params.bodyData) {
		this.handleBodyData ();
		var method = this.params.method;
		this.params.method = (method && method.match (/POST|PUT/)) ? method : 'POST';
		this.bodyData = this.params.body;

		console.log ('!!!!!!!!!!!!!!!!!!', this.bodyData);

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

}

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

		console.log (configUrlObj.bodyData);

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
		result.code    = this.res.statusCode;
		result.headers = (this.res.headers) ? this.res.headers : {};
	},
	isSuccessResponse: function check () {
		var statusCode = this.res.statusCode;
		if (this.params.successCodes) {
			// format: 2xx,3xx
			var check = new RegExp (this.params.successCodes.replace (/x/g, "\\d").replace (/,/g, "|"));
			if ((""+statusCode).match (check)){
				return true;
			} else {
				return false;
			}
		} else if (statusCode == 200) {
			return true
		}
		return false;
	},

	run: function () {
		var self = this;

		var Client = (this.params.protocol == 'https:') ? HTTPSClient : HTTPClient;

		var req = self.req = Client.request(this.params, function (res) {

			self.res = res;

			// if (res.statusCode != 200) {
			// 	self.modelBase.emit (
			// 		'error',
			// 		new Error('statusCode = ' + res.statusCode)
			// 	);
			// 	return;
			// }

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
				self.modelBase.emit ('error', 'res : '+exception);
			});

			res.on ('data', function (chunk) {
				if (!self.isStream) self.target.to.data = Buffer.concat ([self.target.to.data, chunk]);
				self.modelBase.emit ('data', chunk);
			});

			res.on ('end', function () {
				self.modelBase.emit ('end');
			});
		});

		req.on('error', function(e) {
			self.modelBase.emit ('error', 'req : '+e);
		});

		if (self.headers) {
			for (var key in self.headers) {
				req.setHeader(key, self.headers[key]);
			}
		}

		if (self.bodyData) {
			console.log ('%%%%%%%%%%%%%%%%%%%%%%%%%%%%', self.bodyData);
			req.write(self.bodyData);
		}


		req.end();
	},

	stop: function () {
		if (this.req) this.req.abort();
		if (this.res) this.res.destroy();
	}
});
