var task         = require ('task/base'),
	util         = require ('util'),
	mime         = require ('mime');

var jade         = require ('jade');



var renderTask = module.exports = function (config) {

	this.init (config);

};

util.inherits (renderTask, task);

var cache = {};

/**
 * @class task.renderTask
 * @extends task.task
 */
util.extend (renderTask.prototype, {
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
	 * Renders {@link #template} into {@link #output}.
	 */
	run: function () {

		var self = this;

		if (this.type == 'jade') {
			self.output.setHeader(
				"Content-Type",
				(this.type || 'text/html') + '; charset=utf-8'
			);
			var templateIO = project.root.fileIO (this.template);
			// TODO
			//if (cache {this.template}) {
			//	templateIO.stat
			//}
			self.readTemplate (templateIO, function (err, data) {
				if (err) {
					console.error (
						"Can't access %s file.", this.template,
						"Create one and define the project ID.",
					);
					process.kill ();
					return;
				};
				var fn = jade.compile(data, {});
				self.output.end (fn ({
					test: 2,
					pageTitle: 3,
					youAreUsingJade: false
				}));
				self.completed ();

			});

		} else if (this.type == 'json') {
			self.output.setHeader(
				"Content-Type",
				mime.lookup(this.type) + '; charset=utf-8'
			);
			self.output.end (JSON.stringify(self.data));
			self.completed ();
		} else  if (this.type == 'asis') {
			self.output.setHeader ("Content-Type", self.contentType);
			self.output.end (self.data);
			self.completed ();
		}
	}
});
