var util			= require ('util'),
	fs				= require ('fs'),
	urlUtils		= require ('url'),
	httpManager     = require ('./http/model-manager');

var HTTPClient;
try {
	HTTPClient = require('follow-redirects').http;
} catch (e) {
	console.warn(
		'Falling back to standard HTTP client.',
		'If you wnat to follow redirects,',
		'install "follow-redirects" module.'
	);
	HTTPClient = require('http');
}

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

var shallowMerge = function (dest, src, filter) {
	Object.keys(src).forEach(function (key) {
		if ((!filter || -1 != filter.indexOf(key)) && null == dest[key]) {
			dest[key] = src[key];
		}
	});
	return dest;
};

/**
 * @class httpModel
 *
 * Wrapper of HTTPClient for serverside requesting.
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

	if (this.params.body) {
		this.params.method = 'POST';
		this.postBody = this.params.body;

		if (
			!this.params.headers ||
			!this.params.headers['content-length'] ||
			!this.params.headers['content-type']
		) {
			console.error ('content type/length undefined');
		}
		delete this.params.body;
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
			shallowMerge(params, configUrlObj, this.UrlParamNames);
		}

		if (parsedUrlObj) {
			shallowMerge(params, parsedUrlObj);
		}

		// add default params if missing
		shallowMerge(params, this.DefaultParams);

		// Reformat the merged URL object's compound parts.
		// Don't reorder the lines below.
		params.search = urlUtils.format({
			query: params.query
		});
		params.path = urlUtils.format({
			pathname: params.pathname,
			search: params.search
		});
		params.host = urlUtils.format({
			hostname: params.hostname,
			port: params.port
		});
		params.href = urlUtils.format(params);

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
		project.httpModelManager.add(this, {
			url: this.params,
			headers: this.headers,
			postBody: this.postBody
		});

		return this.progress;
	},

	run: function () {
		var self = this;

		var req = self.req = HTTPClient.request(this.params, function (res) {

			self.res = res;

			if (res.statusCode != 200) {
				self.modelBase.emit ('error', new Error('statusCode = ' + res.statusCode));
				return;
			}

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

		if (self.postBody) {
			req.write(self.postBody);
		}


		req.end();
	},

	stop: function () {
		if (this.req) this.req.abort();
		if (this.res) this.res.destroy();
	}
});
