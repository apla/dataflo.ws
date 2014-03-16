var dataflows = require('dataflo.ws');
var common    = require('dataflo.ws/common');
var log       = require('dataflo.ws/log');
var minimist  = require('minimist');

var tasks = [{
	"$class": "remoteResource",
	"method": "toBuffer",
	"timeout": 10000,
	"retries": 100,
	"url": "{$xmlUrl}",
	"$set": "resourse"
}, {

}];

module.exports = {
	launchContext: function () {
		return {
			args:     minimist(process.argv.slice(3))
		};
	},
	launch: function (conf) {

		GET /gists/:id

		if (!conf) {
			console.log ('no dataflo.ws project found within current dir. please run `dataflows init` within project dir');
			return;
		}

		var project = common.getProject ();

		// 1) check for legacy project dir
		if (project.legacy) {
			console.error (log.c.red ('project has legacy configuration layout. you can migrate by running those commands:'));
			console.error ("\n\tcd "+project.root.path);
			console.error ("\tmv etc .dataflows");
			if (project.instance)
				console.error ("\tmv var/instance .dataflows/");
			console.error();
		}
		// 2) check for instance
		if (!project.instance) {
			// TODO
		}
		// 3) check for config errors
		// TODO
	}
};

// in case of unreadable dataflows project config
module.exports.launchAnyway = module.exports.launch;
