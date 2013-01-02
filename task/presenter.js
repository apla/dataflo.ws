var task = require ('./base'),
	util = require ('util');

var presenters = {};

/**
 * @class task.presenterTask
 * @extends task.task
 *
 * This is a type of task that sends a rendered template as an HTTP response.
 *
 * Implementation specific by definition.
 */
var presenterTask = module.exports = function (config) {

	this.headers = {};
	this.init (config);

	if (config.headers) util.extend (this.headers, config.headers);
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
	 * @private
	 */
	// TODO: add cache management
	renderCompile: function() {

		var self = this;

		var render = cache[self.file];

		if (render) {

			self.renderProcess(render);

		} else {
			// TODO: add absolute paths
			// no more presentation files in strange places
			var templateIO = project.root.fileIO ('share', 'presentation', this.file);

			self.readTemplate (templateIO, function (err, tpl) {

				if (err) {
					console.error ("can't access file at share/presentation/" + self.file);
					// process.kill (); // bad idea
					return;
				};

				var tplStr = tpl.toString();

				// compile class method must return function. we call
				// this function with presentation data. if your renderer
				// doesn't have such function, you must extend renderer
				// via renderer.prototype.compile
				var compileMethod = self.compileMethod || 'compile';

				if (!presenters[self.type])
					presenters[self.type] = require (self.type);

				if (!presenters[self.type][compileMethod]) {
					console.error (
						'renderer \"' + self.type +
						'\" doesn\'t have a template compilation method named \"'
						+ compileMethod + '\"'
					);
				}

				render = presenters[self.type][compileMethod] (tplStr, self.compileParams || {});

				// TODO: check for result. render MUST be a function
				cache[self.file] = render;

				self.renderProcess(render);

			});
		}
	},

	/**
	 * @private
	 */

	renderProcess: function(render) {

		this.renderResult (
			render (this.vars)
		);

	},

	/**
	 * @private
	 */

	renderResult: function(result) {

		this.headers.connection = 'close';

		if (this.headers) {
			for (var key in this.headers) {
					this.response.setHeader(key, this.headers[key]);
			}
		}

		this.response.end (result);
		this.completed ();

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
		 *
		 * - `ejs`, EJS template
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
		if (!self.type) {
			// guess on file name
			self.type = self.file.substring (self.file.lastIndexOf ('.') + 1);;
			console.log ('guessed ' + self.type + ' presenter type from filename: ' + self.file);
		}

		switch (self.type) {

			case 'ejs':
				this.setContentType('text/html; charset=utf-8');
				self.renderCompile();
				break;

			case 'json':
				this.setContentType('application/json; charset=utf-8');
				self.renderResult (
					JSON.stringify (self.vars)
				);
				break;

			case 'asis':

				if (!this.headers['content-type']) {
					var contentType = (self.contentType) ? self.contentType : 'text/plain';

					if (!self.noUTF8 || contentType.indexOf ('application/') != 0) {
						contentType += '; charset=utf-8';
					}

					this.setContentType(contentType);
				}

				self.renderResult (self.vars);
				break;
		}
	},

	setContentType: function(value) {
		this.headers['content-type'] = value;
	}
});
