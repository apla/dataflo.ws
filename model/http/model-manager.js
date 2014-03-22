var util     = require ('util')
	urlUtil  = require ('url');

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var connectionLimits;

try {
	connectionLimits = project.config.http.outgoingLimits;
} catch (e) {
	connectionLimits = {};
}

function getConnectionLimits(urlParams) {

	var httpHost = urlParams.hostname + urlParams.pathname;
	var result = connectionLimits[httpHost];
	return result ? result : 1;
}

var connectionTimeout = 10000;

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var HttpModelManager = function () {

	this.https = {}
}

util.extend(HttpModelManager.prototype, {

	add: function (http, params) {

		var self = this,
			hostname = params.url.hostname,
			requestUID = self.getRequestUID(params);

		http.timestamp = Date.now();
		http.isDownloading = false;

		// add to https list

		if (!self.https[hostname])
			self.https[hostname] = {};

		self.https[hostname][requestUID] = http;

		// check new ftps and limits and run newest ftp

		self.checkHttpAndRun();

		// listen events

		http.modelBase.on('error', function(err) {
			self.completedHttp(http);
			self.checkHttpAndRun();
		});

		// on end completed ftp

		http.modelBase.on('end', function() {

			self.completedHttp(http);
			self.checkHttpAndRun();
		});
	},

	getRequestUID: function(params) {

		if (params.url.method == 'GET') {
			return params.url.pathname;
		}

		var headers = params.headers,
			bodyData = params.bodyData,
			result = '';

		result += params.url.method + params.url.pathname;

		for (var header in headers) {
			result += '/' + header + ':' + headers[header];
		}

		result += '/' + bodyData;

		return result;
	},

	checkHttpAndRun: function () {

		for (var hostname in this.https) {

			var nextHTTP = this.next(hostname);

			if (nextHTTP) {
				nextHTTP.isDownloading = true;
				nextHTTP.run();
			}
		}
	},

	next: function (hostname) {

		var self = this;
		var httpQueue = self.https[hostname];
		var newest;

		var maxConnections = getConnectionLimits(hostname);
		var activeConnections = 0;

		for (var requestUID in httpQueue) {

			var http = httpQueue[requestUID];

			if (!http.isDownloading && (!newest || http.timestamp > newest.timestamp))
				newest = http;

			if (http.isDownloading)
				activeConnections++;
		}

		if (maxConnections > activeConnections)
			return newest;

		return;
	},

	everyItem: function (iterator) {

		for (var hostname in this.https) {

			var httpQueue = this.https[hostname];

			for (var requestUID in httpQueue) {
				var http = httpQueue[requestUID];
				iterator.call (this, http, hostname, requestUID);
			}
		}
	},

	completedHttp: function (completedHttp) {

		var self = this;

		completedHttp.isDownloading = false;

		this.everyItem (function (http, hostname, requestUID) {

			if (completedHttp == http) {

				delete self.https[hostname][requestUID];

				var hasItems = false;

				try {
					for (var i in self.https[hostname])
						if (self.https[hostname].hasOwnProperty(i))
							throw true;
				} catch (e) {
					hasItems = e;
				}
				if (!hasItems)
					delete self.https[hostname];
				return;
			}
		});
	}

});

global.httpModelManager = new HttpModelManager();
