var dataflows = require ('dataflo.ws');
var common    = dataflows.common;
var paint     = dataflows.color;
var fs        = require ('fs');
var path      = require ('path');

var project = require ('dataflo.ws/project');

module.exports = {
	launchContext: function () {
	},
	defaultConfig: {
		debug: "<#false for production>",
		daemon: {
			http: {
				initiator: ['http']
			}
		},
		initiator: {
			token: {
				flows: {

				}
			},
			http: {
				host: "<#default:127.0.0.1>",
				domain: "<#host.local>",
				port: "<#50100>",
				session: {
					secret: "<#please generate unique string>",
					cookieTemplate: {
						name: "session",
						domain: "<$initiator.http.domain>",
						path: "/",
						expirePeriod: "+172800000",
						httpOnly: true
					}
				},

				static: {
					root: "www",
					index: "index.html",
					headers: {}
				},
				prepare: {
					post: {
						tasks: [{
							$class: "post",
							request: "{$request}",
							$set: "request.body"
						}]
					}
				},
				flows: []
			}
		}

	},
	launch: function (conf, project) {

		if (!conf) {
			if (this.args._.length <= 1) {
				var projectPath = path.resolve (this.args._[0] || '.');
				console.log (paint.dataflows(), 'initalizing project in ', paint.path (this.args._[0] || '.', '('+projectPath+')'));

				var confDir      = path.resolve (projectPath, '.dataflows');
				var instanceName = project.prototype.generatedInstance ();
				var confFixup    = path.resolve (confDir, instanceName);

				if (!fs.existsSync (confDir))
					fs.mkdirSync (confDir);
				// TODO: add detection of stub variables
				if (!fs.existsSync (path.resolve (confDir, 'project')) && !fs.existsSync (path.resolve (confDir, 'project.json')))
				fs.writeFileSync (path.resolve (confDir, 'project.json'),
					JSON.stringify (this.defaultConfig, null, "\t"), {flag: "wx"}
				);

				if (!fs.existsSync (path.resolve (confDir, 'instance')))
				fs.writeFileSync (
					path.resolve (confDir, 'instance'),
					instanceName,
					{flag: "wx"}
				);

				if (!fs.existsSync (confFixup))
					fs.mkdirSync (confFixup);

			} else {

			}

			// console.log ('no dataflo.ws project found within current dir. please run `dataflows init` within project dir');
			return;
		} else if (conf && !project.instance) {
			var confDir      = project.configDir;
			var instanceName = project.prototype.generatedInstance ();
			var confFixup    = path.resolve (confDir, instanceName);

			fs.writeFileSync (
				path.resolve (confDir, 'instance'),
				instanceName,
				{flag: "wx"}
			);

			if (!fs.existsSync (confFixup))
				fs.mkdirSync (confFixup);

		} else {
			console.log (paint.dataflows(), 'project already initialized');
			process.kill();
		}

		var project = common.getProject ();

		// 1) check for legacy project dir
		if (project.legacy) {
			console.error (paint.error ('project has legacy configuration layout. you can migrate by running those commands:'));
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
