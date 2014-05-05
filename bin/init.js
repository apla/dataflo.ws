var dataflows = require ('dataflo.ws');
var common    = dataflows.common;
var log       = dataflows.log;
var fs        = require ('fs');
var path      = require ('path');

module.exports = {
	launchContext: function () {
	},
	launch: function (conf, project) {

		if (!conf) {
			if (this.args._.length <= 1) {
				var projectPath = path.resolve (this.args._[0] || '.');
				console.log (log.dataflows(), 'initalizing project in ', log.path (this.args._[0] || '.', '('+projectPath+')'));

				var confDir      = path.resolve (projectPath, '.dataflows');
				var instanceName = process.env.USER + '@' + process.env.HOSTNAME
				var confFixup    = path.resolve (confDir, instanceName);

				if (!fs.existsSync (confDir))
					fs.mkdirSync (confDir);
				// TODO: add detection of stub variables
				if (!fs.existsSync (path.resolve (confDir, 'project')))
				fs.writeFileSync (path.resolve (confDir, 'project'),
					"// json\n" + JSON.stringify ({
						debug: "<$debug>",
						daemon: {
							http: {
								initiator: ['http']
							}
						},
						initiator: {
							callback: {
								flows: {

								}
							},
							http: {
								port: "<$daemonHttpPort>",
								static: {
									root: "www",
									index: "index.html",
									headers: {}
								},
								prepare: {},
								flows: []
							}
						}
					}, null, "\t"), {flag: "wx"}
				);

				if (!fs.existsSync (path.resolve (confDir, 'instance')))
				fs.writeFileSync (
					path.resolve (confDir, 'instance'),
					instanceName,
					{flag: "wx"}
				);

				if (!fs.existsSync (confFixup))
					fs.mkdirSync (confFixup);

				if (!fs.existsSync (path.resolve (confFixup, 'fixup')))
				fs.writeFileSync (
					path.resolve (confFixup, 'fixup'),
					"// json\n" + JSON.stringify ({
						debug: true,
						initiator: {
							http: {
								port: "<$daemonHttpPort>",
							}
						}
					}, null, "\t"), {flag: "wx"}
				);
				// TODO: gitignore

			} else {

			}

			// console.log ('no dataflo.ws project found within current dir. please run `dataflows init` within project dir');
			return;
		} else if (conf && !project.instance) {
			var confDir      = project.configDir;
			var instanceName = process.env.USER + '@' + process.env.HOSTNAME
			var confFixup    = path.resolve (confDir, instanceName);

			fs.writeFileSync (
				path.resolve (confDir, 'instance'),
				instanceName,
				{flag: "wx"}
			);

			if (!fs.existsSync (confFixup))
				fs.mkdirSync (confFixup);
			fs.writeFileSync (
				path.resolve (confFixup, 'fixup'),
				"// json\n" + JSON.stringify ({
					debug: true,
					initiator: {
						http: {
							port: "<$daemonHttpPort>",
						}
					}
				}, null, "\t"), {flag: "wx"}
			);

		} else {
			console.log (log.dataflows(), 'project already initialized');
			process.kill();
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
