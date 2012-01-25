var task         = require ('task/base'),
	util         = require ('util');

try {
	var jade         = require ('jade');
} catch (e) {
	// console.log ('jade not available');
}

/**
 * @class task.presenterTask
 * @extends task.task
 *
 * This is a type of task that sends a rendered template as an HTTP response.
 *
 * Implementation specific by definition.
 */
var presenterTask = module.exports = function (config) {

	this.init (config);

};

util.inherits (presenterTask, task);

var cache = {};

util.extend (presenterTask.prototype, {
	/**
	 * @private
	 */
	readTemplate: function (templateIO, cb) {
		templateIO.readFile (function (err, data) {
			cb.call (this, err, data);
		});

	},

	/**
	 * @method run
	 * Renders the template from {@link #file} and sends the result
	 * as the content of the {@link #response}.
	 */
	run: function () {

		var self = this;

		/**
		 * @cfg {String} file (required) The template file name.
		 */

		/**
		 * @cfg {String} type Template type. Tries to guess the type
		 * by the {@link #file} extension.
		 *
		 * Possible values:
		 * - `jade`, Jade template
		 * - `json`, JSON string
		 * - `asis`, plain text.
		 */

		/**
		 * @cfg {http.ClientResponse} response (required) The response object.
		 *
		 * This task doesn't populate the {@link #produce}
		 * field of the workflow. Instead, it sends the result via HTTP.
		 */

		/**
		 * @cfg {String} contentType The MIME type of the response content.
		 *
		 * Default values depend on the template {@link #type}.
		 */
		if (!this.type) {
			// guess on file name
			this.type = this.file.match(".*\\.(.*)$")[1];
			console.log (
				"Guessed %s presenter type from filename: %s",
				this.type, this.file
			);
		}

		if (this.type == 'jade') {
			self.response.setHeader (
				"Content-Type",
				(this.contentType || 'text/html') + '; charset=utf-8'
			);
			var templateIO = project.root.fileIO (this.file);
			// TODO
			//if (cache {this.template}) {
			//	templateIO.stat
			//}
			self.readTemplate (templateIO, function (err, data) {
				if (err) {
					console.error (
						"Can't access %s file.", self.file,
						"Create one and define the project ID.",
					);
					process.kill ();
					return;
				};
				var fn = jade.compile(data, {});
				self.response.end (fn (self.vars));
				self.completed ();

			});

		} else if (this.type == 'json') {
			self.response.setHeader (
				"Content-Type",
				"application/json; charset=utf-8"
			);
			self.response.end (JSON.stringify (self.vars));
			self.completed ();
		} else  if (this.type == 'asis') {
			self.response.setHeader ("Content-Type", self.contentType);
			self.response.end (self.vars);
			self.completed ();
		}
	}
});
