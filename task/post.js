var util        = require ('util'),
	qs			= require ('querystring'),
	formidable  = require ('formidable'),
	task        = require ('./base');


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

		if (
			contentType.match(/urlencoded/i) ||
			(contentType.match(/multipart/i) && contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i))
		) {
			var form = new formidable.IncomingForm();
			// TODO: add support for parameters

			form.on ('fileBegin', function (name, file) {
				self.emit ('log', 'started loading '+name);
				// here we can overload generated file name
			});

			form.on ('file', function (name, file) {
				self.emit ('log', 'finished loading '+name);
			});

			form.on ('error', function (error) {
				self.emit ('error', 'form error '+ error);
			});

			form.on ('aborted', function () {
				self.emit ('error', 'form aborted');
			});

			form.on ('end', function () {
				self.emit ('log', 'form end');
			});

			form.parse(this.request, function(err, fields, files) {
				self.completed ({err: err, fields: fields, files: files});
			});
		} else {

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

		}
		
		this.request.resume();
	}
});
