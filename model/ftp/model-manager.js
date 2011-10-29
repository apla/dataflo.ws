var common     = require ('common')
	urlUtil    = require ('url');

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var connectionLimits   = {
	'127.0.0.1/Public/test/hello'		:	1,
	'127.0.0.1/test/'					:	1
};

function getConnectionLimits(targetUrl) {

	var parsedUrl = urlUtil.parse(targetUrl);
	var ftpHost = parsedUrl.hostname + parsedUrl.pathname;
	var result = connectionLimits[ftpHost];
	return result ? result : 1;
}

var connectionTimeout = 15000;

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var FtpModelManager = function () {

	this.ftps = {}
}

common.extend(FtpModelManager.prototype, {

	add: function (ftp, source) {

		var self = this;

		ftp.isDelivering = false;

		// add to ftps list

		if (!self.ftps[ftp.url])
			self.ftps[ftp.url] = {};

		self.ftps[ftp.url][source.originalFileName] = ftp;

		// check new ftps and limits and run newest ftp

		self.checkFtpAndRun();

		// listen events

		ftp.modelBase.on('error', function(err) {
			self.completedFtp(ftp);
			self.checkFtpAndRun();
		});

		// on end completed ftp

		ftp.modelBase.on('end', function() {

			self.completedFtp(ftp);
			self.checkFtpAndRun();
		});
	},

	checkFtpAndRun: function () {

		for (var url in this.ftps) {

			var nextFTP = this.next(url);

			if (nextFTP) {
				nextFTP.isDelivering = true;
				nextFTP.run();
			}
		}
	},

	next: function (url) {

		var self = this;
		var ftpQueue = self.ftps[url];
		var newest;

		var maxConnections = getConnectionLimits(url);
		var activeConnections = 0;

		for (var fileName in ftpQueue) {

			var ftp = ftpQueue[fileName];

			if (!ftp.isDelivering && (!newest || ftp.timestamp > newest.timestamp))
				newest = ftp;

			if (ftp.isDelivering)
				activeConnections++;
		}

		if (maxConnections > activeConnections)
			return newest;

		return;
	},

	everyItem: function (iterator) {

		for (var url in this.ftps) {

			var ftpQueue = this.ftps[url];

			for (var fileName in ftpQueue) {
				var ftp = ftpQueue[fileName];
				iterator.call (this, ftp, url, fileName);
			}
		}
	},

	completedFtp: function (completedFtp) {

		var self = this;

		completedFtp.isDelivering = false;

		this.everyItem (function (ftp, url, fileName) {

			if (completedFtp == ftp) {

				delete self.ftps[url][fileName];

				var hasItems = false;

				try {
					for (var i in self.ftps[url])
						if (self.ftps[url].hasOwnProperty(i))
							throw true;
				} catch (e) {
					hasItems = e;
				}
				if (!hasItems)
					delete self.ftps[url];
				return;
			}
		});
	}

});

project.ftpModelManager = new FtpModelManager();