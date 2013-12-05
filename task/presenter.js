var task   = require ('./base'),
	path   = require ('path'),
	fs     = require ('fs'),
	util   = require ('util'),
	stream = require('stream');

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
	DEFAULT_TEMPLATE_DIR: 'share/presentation',

	/**
	 * @private
	 */
	readTemplate: function (templateIO, cb) {
		templateIO.readFile (function (err, data) {
			cb.call (this, err, data);
		});

	},

	isInStaticDir: function (filePath) {
		var httpStatic;
		try {
			httpStatic =
				project.config.initiator.http.static.root.path ||
				project.config.initiator.http.static.root;
		} catch (e) {}

		if (httpStatic) {
			var rootPath = project.root.path;
			httpStatic = path.resolve(rootPath, httpStatic);

			var dirName = filePath;

			while (dirName != rootPath) {
				dirName = path.dirname(dirName);
				if (dirName == httpStatic) {
					return true;
					break;
				}
			}
		}
		return false;
	},

	getTemplateIO: function (callback) {
		var self = this;
		var defTemplate = path.resolve(
			project.root.path, this.DEFAULT_TEMPLATE_DIR, this.file
		);
		var origTemplate = path.resolve(project.root.path, this.file);
		var theTemplate;

		fs.exists(defTemplate, function (exists) {
			theTemplate = exists ? defTemplate : origTemplate;

			// warn if file is in static HTTP directory
			if (self.isInStaticDir(theTemplate)) {
				throw new Error(
					'Publicly accessible template file at '+theTemplate+'!'
				);
			}

			callback(project.root.fileIO(theTemplate));
		});
	},

	renderFile: function () {
		var self = this;

		this.getTemplateIO(function (templateIO) {
			templateIO.readFile(function (err, data) {
				if (err) {
					console.error("can't access file %s", templateIO.path);
				} else {
					self.renderResult(data.toString());
				}
			});
		});
	},

	/**
	 * @private
	 */
	// TODO: add cache management
	renderCompile: function() {
		var self = this;

		if (self.file in cache) {
			self.renderProcess(cache[self.file]);
			return;
		}

		var templateIO = this.getTemplateIO(function (templateIO) {
			self.readTemplate (templateIO, function (err, tpl) {
				if (err) {
					console.error ("can't access file %s", templateIO.path);
					// process.kill (); // bad idea
					return;
				}

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
						'\" doesn\'t have a template' +
						'compilation method named \"' +
						compileMethod + '\"'
					);
				}

				cache[self.file] = presenters[self.type][compileMethod](
					tplStr, self.compileParams || {}
				);
				
				if (self.renderMethod) {
					self.renderProcess(cache[self.file][self.renderMethod].bind(cache[self.file]))
				} else {
					self.renderProcess(cache[self.file]);
				}

			});
		});
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
		console.log (123);
		if (this.headers) {
			for (var key in this.headers) {
				this.response.setHeader(key, this.headers[key]);
			}
		}
		this.headers.connection = 'close';

		if (result instanceof stream.Readable) {
			result.pipe(this.response);
		} else {
			this.response.end(result);	
		}

		this.completed();

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
		 * - `fileAsIs`, file from disk (please provide `file` param)
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

		switch (self.type.toLowerCase()) {
			case 'html':
				self.setContentType('text/html; charset=utf-8');
				self.renderFile();
				break;
			
			case 'jade':
			case 'mustache':
			case 'hogan.js':
			case 'ejs':
				self.setContentType('text/html; charset=utf-8');
				self.renderCompile();
				break;

			case 'json':
				self.setContentType('application/json; charset=utf-8');
				self.renderResult (
					JSON.stringify (self.vars)
				);
				break;

			case 'fileasis':
				var mmm;
				try {
					mmm = require ('mmmagic');
				} catch (e) {
					console.error ("module 'mmmagic' not found.",
						"this module required if you plan to use fileAsIs presenter type");
					process.kill();
				}
				
				var Magic = mmm.Magic;

				var magic = new Magic(mmm.MAGIC_MIME_TYPE);
				magic.detectFile(self.file, function(err, contentType) {
				    if (err) throw err;
				    
				    self.setContentType(contentType);
				    var fileStream = fs.createReadStream(self.file);
				    self.renderResult (fileStream);
				});

				break;


			case 'asis':
			default:
				if (!self.headers['content-type']) {
					var contentType = (self.contentType) ? self.contentType : 'text/plain';

					if (!self.noUTF8 || contentType.indexOf ('application/') != 0) {
						contentType += '; charset=utf-8';
					}

					self.setContentType(contentType);
				}

				self.renderResult (self.vars);
				break;
		}
	},

	setContentType: function(value) {
		this.headers['content-type'] = value;
	}
});
