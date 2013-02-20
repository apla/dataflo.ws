var util = require('util');
var path = require('path');
var fs  = require('fs');
var common = require('dataflo.ws/common');
var Workflow = require('dataflo.ws/workflow');

var fsWatchI = module.exports = function (config) {
	this.config = util.extend({}, fsWatchI.defaultConfig);

	if (config) {
		util.extend(this.config, config);
	}

	this.listen();
};

fsWatchI.defaultConfig = {
	verbose: true // log messages for each FS path
};

fsWatchI.prototype.listen = function () {
	var iConfig = this.config;
	var rootPath = common.getProject().root.path;

	iConfig.workflows.forEach(function (cfg) {
		var wf = new Workflow(cfg);
		var watchPath = cfg.path || cfg.dir || cfg.file;
		var absPath, displayPath;

		if (watchPath) {
			absPath = path.resolve(rootPath, watchPath);
			displayPath = './' + watchPath;
		} else {
			absPath = rootPath;
			displayPath = "the project root";
		}

		fs.watch(absPath, function (event, filename) {
			wf.data.event = event;       // "rename" or "change"
			wf.data.filename = filename; // limited number of OSes support it

			// all together now
			wf.data.fsEvent = {
				event: event,
				filename: filename
			};

			wf.run();

			if (iConfig.verbose || cfg.verbose) {
				console.log(
					'Some file has been %sd in %s',
					event, displayPath
				);
			}
		});

		console.log(
			'You are now watching for filesytem events in %s 👀',
			displayPath
		);
	});
};
