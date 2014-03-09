var path = require ('path');
var util = require ('util');

var io = require ('./io/easy');
var log = require ('./log');

// var fsm = StateMachine.create({
//   events: [
//     {name: 'prepare',     from: 'none',         to: 'prepared'},
//     {name: 'instantiate', from: 'prepared',     to: 'instantiated'},
//     {name: 'configure',   from: 'instantiated', to: 'configured'},
// ]});
// alert(fsm.current); // "none"
// fsm.prepare ();
// alert(fsm.current); // "green"

var Project = function (rootPath) {
	var rootPath = rootPath || process.env['PROJECT_ROOT'] || process.cwd();
	var projectRoot = new io(rootPath);

	this.root = projectRoot;
	var self  = this;

	this.configDir = '.dataflows';
	this.varDir    = '.dataflows';

	this.on ('prepared', this.readInstance.bind(this));
	this.on ('instantiated', this.loadConfig.bind(this));

	this.prepare ();
};

module.exports = Project;

var EventEmitter = require ('events').EventEmitter;

util.inherits (Project, EventEmitter);

Project.prototype.prepare = function (cb) {
	var self = this;
	this.root.fileIO ('etc/project').stat(function (err, stats) {
		if (!err && stats && stats.isFile()) {
			console.warn ("in", log.dataflows ("@0.60.0"), "we have changed configuration layout. please run", log.path("dataflows doctor"));
			self.configDir = 'etc';
			self.varDir    = 'var';
			self.legacy    = true;
		}
		self.emit ('prepared');
	})
}

Project.prototype.readInstance = function () {
	var self = this;
	this.root.fileIO (path.join (this.varDir, 'instance')).readFile (function (err, data) {

		// assume .dataflows dir always correct
		// if (err && self.varDir != '.dataflows') {
			// console.error ("PROBABLY HARMFUL: can't access "+self.varDir+"/instance: "+err);
			// console.warn (log.dataflows(), 'instance not defined');
		// } else {
			var instance = (""+data).split (/\n/)[0];
			self.instance = instance == "undefined" ? null : instance;
			args = [log.dataflows(), 'instance is:', instance];
			if (err) {
				args.push ('(' + log.c.red (err) + ')');
			}
			console.log.apply (console, args);
		// }

		self.emit ('instantiated');
	});
}

Project.prototype.loadConfig = function () {

	var self = this;

	this.root.fileIO (path.join(this.configDir, 'project')).readFile (function (err, data) {
		if (err) {
			var message = "can't access "+self.configDir+"/project file. create one and define project id";
			console.error (log.dataflows(), log.c.red (message));
			// process.kill ();
			self.emit ('error', message);
			return;
		}

		var configData = (""+data).match (/(\w+)(\W[^]*)/);
		configData.shift ();
		var parser = configData.shift ();

		// console.log ('parsing etc/project using "' + parser + '" parser');

		if (parser == 'json') {

			try {
				var config = JSON.parse (configData[0]);
			} catch (e) {
				var message = 'project config cannot parsed';
				console.error (log.c.red (message));
				self.emit ('error', message);
			}

			// TODO: read config fixup
		} else {
			var message =
				'parser ' + parser + ' unknown in '+self.configDir+'/project; '
				+ 'we analyze parser using first string of file; '
				+ 'you must put in first string comment with file format, like "// json"';
			console.error (log.c.red (message));
			self.emit ('error', message);
			// process.kill ();
			return;
		}


		self.id = config.id;

		self.loadIncludes(config, 'projectRoot', function (err, config) {
			if (err) {
				console.error(err);
				console.warn("Couldn't load includes.");
				self.emit ('ready');
				return;
			}

			self.config = config;

			if (!self.instance) {
				self.emit ('ready');
				return;
			}

			self.root.fileIO (path.join(self.configDir, self.instance, 'fixup')).readFile (function (err, data) {
				if (err) {
					console.error (
						"config fixup file unavailable ("+log.path (path.join(self.configDir, self.instance, 'fixup'))+")",
						"create one and define local configuration fixup"
					);
					self.emit ('ready');
					// process.kill ();
					return;

				}

				var fixupData = (""+data).match (/(\w+)(\W[^]*)/);
				fixupData.shift ();
				var fixupParser = fixupData.shift ();

				var fixupData = (""+data).match (/(\w+)(\W[^]*)/);
				fixupData.shift ();
				var fixupParser = fixupData.shift ();

				// console.log ('parsing etc/' + self.instance + '/fixup using "' + fixupParser + '" parser');
				// TODO: error handling

				if (fixupParser == 'json') {
					var config = JSON.parse (fixupData[0]);

					util.extend (true, self.config, config);
				} else {
					console.error (
						'parser ' + fixupParser + ' unknown in etc/' + self.instance + 'fixup; '
						+ 'we analyze parser using first string of file; '
						+ 'you must put in first string comment with file format, like "// json"');

					// process.kill ();
					return;
				}

				// console.log ('project ready');

				self.emit ('ready');
			});
		});
	});
}


Project.prototype.connectors = {};
Project.prototype.connections = {};

Project.prototype.getModule = function (type, name, optional) {
	var self = this;
	optional = optional || false;
	var mod;
	var taskFound = [
		path.join('dataflo.ws', type, name),
		path.resolve(this.root.path, type, name),
		path.resolve(this.root.path, 'node_modules', type, name),
		name
	].some (function (modPath) {
		try {
			mod = require(modPath);
			return true;
		} catch (e) {
			// assuming format: Error: Cannot find module 'csv2array' {"code":"MODULE_NOT_FOUND"}
			if (e.toString().indexOf(name + '\'') > 0 && e.code == "MODULE_NOT_FOUND") {
				return false;
			} else {
				console.error ('requirement failed:', log.c.red (e.toString()), "in", log.path (self.root.relative (modPath)));
				return true;
			}
		}
	});

	if (!mod && !optional)
		console.error ("module " + type + " " + name + " cannot be used");

	return mod;
};

Project.prototype.getInitiator = function (name) {
	return this.getModule('initiator', name);
};

Project.prototype.getTask = function (name) {
	return this.getModule('task', name);
};

Project.prototype.require = function (name, optional) {
	return this.getModule('', name, optional);
}

var configCache = {};

Project.prototype.loadIncludes = function (config, level, cb) {
	var self = this;

	var DEFAULT_ROOT = this.configDir,
		DELIMITER = ' > ',
		tagRe = /<([^>]+)>/,
		cnt = 0,
		len = 0;

	var levelHash = {};

	level.split(DELIMITER).forEach(function(key) {
		levelHash[key] = true;
	});

	function onLoad() {
		cnt += 1;
		if (cnt >= len) {
			cb(null, config);
		}
	}

	function onError(err) {
		console.log('[WARNING] Level:', level, 'is not correct.\nError:', log.c.red (err));
		cb(err, config);
	}

	function iterateTree(tree, cb) {
		if (null == tree) { return; }

		var step = function (node, key, tree) {
			cb(tree, key);
			iterateTree(node, cb);
		};

		if (Array === tree.constructor) {
			tree.forEach(step);
		} else if (Object === tree.constructor) {
			Object.keys(tree).forEach(function (key) {
				step(tree[key], key, tree)
			});
		}
	}

	function iterateNode(node, key) {
		var value = node[key];

		if ('string' === typeof value) {
			var match = value.match(tagRe);
			if (match) {
				len += 1;

				var incPath = match[1];

				if (0 !== incPath.indexOf('/')) {
					incPath = path.join (DEFAULT_ROOT, incPath);
				}

				if (incPath in levelHash) {
					//console.error('\n\n\nError: on level "' + level + '" key "' + key + '" linked to "' + value + '" in node:\n', node);
					throw new Error('circular linking');
				}

				delete node[key];

				if (configCache[incPath]) {

					node[key] = util.clone(configCache[incPath]);
					onLoad();

				} else {

					self.root.fileIO(incPath).readFile(function (err, data) {
						if (err) {

							onError(err);

						} else {

							self.loadIncludes(JSON.parse(data), path.join(level, DELIMITER, incPath), function(tree, includeConfig) {

								configCache[incPath] = includeConfig;

								node[key] = util.clone(configCache[incPath]);
								onLoad();
							});

						}
					});
				}
			}
		}
	}

	iterateTree(config, iterateNode);

//	console.log('including:', level, config);

	!len && cb(null, config);
}
