var task        = require ('task/base'),
	util        = require ('util'),
	qs			= require ('querystring'),
	formidable  = require ('formidable');


var postTask = module.exports = function (config) {

	this.request = config.request;
	this.init (config);

};

util.inherits (postTask, task);

util.extend (postTask.prototype, {

	run: function () {

		// TODO: add data limit

		var self = this;

		if (self.request.method != 'POST' && self.request.method != 'PUT')
			return self.skipped ();

		var contentType = self.request.headers['content-type'];

		if (contentType != 'application/octet-stream') {

			self.data = "";

			self.request.on("data", function (chunk) {
				self.data += chunk;
			});

			self.request.on("error", function (e) {
				self.emmitError(e);
			});

			// TODO: file uploads

			self.request.on("end", function () {

				var fields, err;

				if (self.dumpData) {
					self.emit ('log', self.data);
				}

				try {
					fields = JSON.parse (self.data);
				} catch (e) {
					err = e;
				}

// TODO : move to httpd.js
				var body = {fields: fields};
				self.request.body = body;
// =======

				if (err) {

					err = null;

					try {
						fields = qs.parse (self.data);
					} catch (e) {
						err == e;
					}
				}

				var body = (err) ? self.data : {fields: fields};

				self.request.body = body;
				self.completed (body);
			});

			return;
		}

		var form = new formidable.IncomingForm();
		form.parse(self.request, function(err, fields, files) {

			if (err) {
				self.failed (err);
				return;
			}

			var body = {fields: fields, files: files};
			self.request.body = body;
			self.completed (body);
		});
	}
});
