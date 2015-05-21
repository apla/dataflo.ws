var util = require('util');
var path = require('path');
var fs   = require('fs');

var common = require('../common');
var flow   = require('../flow');

var fsWatchI = module.exports = function (config) {
	this.config = util.extend({}, this.defaultConfig);

	if (config) {
		util.extend(this.config, config);
	}

	this.flows = config.workflows || config.dataflows || config.flows;

	this.listen();
};

fsWatchI.defaultConfig = {
	verbose: true // log messages for each FS path
};

fsWatchI.prototype.listen = function () {
	var iConfig = this.config;
	var rootPath = common.getProject().root.path;

	this.flows.forEach(function (cfg) {
		var df = new flow (cfg);
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
			df.data.event = event;       // "rename" or "change"
			df.data.filename = filename; // limited number of OSes support it

			// all together now
			df.data.fsEvent = {
				event: event,
				filename: filename
			};

			df.runDelayed ();

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
