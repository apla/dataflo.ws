// Require initiator.listener

var events  = require ('events'),
	urlUtil = require ('url'),
	util    = require ('util');


var model = module.exports = function (url, optionalParams) {

	var self = this;

	if (url.constructor === String) {
		try {
			this.url = urlUtil.parse (url, true);
			var a = this.url.protocol.length;
		} catch (e) {
			self.emit ('error', e);
		}
	} else {
		this.url = url;
		if (!this.url.protocol) {
			// assume http
			this.url.protocol = 'http:';
		}
	}

	// convert:
	// 		http: -> http
	// 		https: -> http
	// 		ftp: -> ftp
	// 		sftp: -> ftp
	this.modelName = this.url.protocol.replace(/(^s|:$|s:$)/g, '');

	// console.log (this.modelName);
	var requiredModel = require ('./'+this.modelName);
	this.dataSource = new requiredModel (this, optionalParams);

	// fetch method

	this.fetch = function (target) {
		self.dataSource.fetch(target);
	}

	this.store = function (target) {
		self.dataSource.store(target);
	}

	this.stop = function (reason) {
		if (self.dataSource.stop)
			self.dataSource.stop (reason);
	}

	// this.init();
}

util.inherits (model, events.EventEmitter);

// there are some examples:
// fetch: url (call GET for http, RETR for ftp)
// store: url (call POST for http, PUT for ftp, send email for mailto)
