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
	this.root = new io (rootPath || process.env['PROJECT_ROOT'] || process.cwd());

	this.configDir = '.dataflows';
	this.varDir    = '.dataflows';

	this.on ('legacy-checked', this.checkConfig.bind(this));
	this.on ('config-checked', this.readInstance.bind(this));
	this.on ('instantiated', this.loadConfig.bind(this));

	this.checkLegacy ();

	// common.waitAll ([
	// 	[this, 'legacy-checked'], // check legacy config
	// 	[this, 'config-checked'], // check current config
	// ], this.readInstance.bind(this));

};

module.exports = Project;

var EventEmitter = require ('events').EventEmitter;

util.inherits (Project, EventEmitter);

Project.prototype.checkLegacy = function (cb) {
	var self = this;
	this.root.fileIO ('etc/project').stat(function (err, stats) {
		if (!err && stats && stats.isFile()) {
			console.error (log.errMsg ('project has legacy configuration layout. you can migrate by running those commands:'));
			console.error ("\n\tcd "+self.root.path);
			console.error ("\tmv etc .dataflows");

			// console.warn ("in", log.dataflows ("@0.60.0"), "we have changed configuration layout. please run", log.path("dataflows doctor"));
			self.configDir = 'etc';
			self.varDir    = 'var';
			self.legacy    = true;
		}
		self.emit ('legacy-checked');
	})
}

Project.prototype.checkConfig = function (cb) {
	var self = this;
	if (self.legacy) {
		self.emit ('config-checked');
		return;
	}

	// search for config root
	var guessedRoot = this.root;
	guessedRoot.findUp (this.configDir, function (foundConfigDir) {
		var detectedRoot = foundConfigDir.parent()
		if (self.root.path != detectedRoot.path)
			console.log (log.dataflows (), 'using', log.path (detectedRoot.path), 'as project root');
		self.root = detectedRoot;
		self.emit ('config-checked');
		return true;
	}, function () {
		self.emit ('error', 'no project config');
	});

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
				args.push ('(' + log.errMsg (err) + ')');
			} else if (self.legacy) {
				console.error ("\tmv var/instance .dataflows/");
			}
			if (self.legacy) console.log ();
			console.log.apply (console, args);
		// }

		self.emit ('instantiated');
	});
}

Project.prototype.logUnpopulated = function(variable) {
	console.error ("variable", log.path(variable), "unpopulated. please run", log.dataflows ("config set", variable, "<value>"));
};

Project.prototype.loadConfig = function () {

	var self = this;

	this.root.fileIO (path.join(this.configDir, 'project')).readFile (function (err, data) {
		if (err) {
			var message = "can't access "+self.configDir+"/project file. create one and define project id";
			console.error (log.dataflows(), log.errMsg (message));
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
				var message = 'project config cannot parsed:';
				console.error (message, log.errMsg (e));
				self.emit ('error', message + ' ' + e.toString());
				process.kill ();
			}

			// TODO: read config fixup
		} else {
			var message =
				'parser ' + parser + ' unknown in '+self.configDir+'/project; '
				+ 'we analyze parser using first string of file; '
				+ 'you must put in first string comment with file format, like "// json"';
			console.error (log.errMsg (message));
			self.emit ('error', message);
			// process.kill ();
			return;
		}


		self.id = config.id;

		// TODO: load includes after fixup is loaded
		self.loadIncludes(config, 'projectRoot', function (err, config, variables) {

			self.variables = variables;

			if (err) {
				console.error(err);
				console.warn("Couldn't load includes.");
				self.emit ('ready');
				return;
			}

			self.config = config;

			if (!self.instance) {
				for (var k in variables) {
					self.logUnpopulated (k);
				}
				self.emit ('ready');
				return;
			}

			self.fixupFile = path.join(self.configDir, self.instance, 'fixup');

			self.root.fileIO (self.fixupFile).readFile (function (err, data) {
				var fixupConfig = {};
				if (err) {
					console.error (
						"config fixup file unavailable ("+log.path (path.join(self.configDir, self.instance, 'fixup'))+")",
						"create one and define local configuration fixup"
					);
				} else {
					var fixupData = (""+data).match (/(\w+)(\W[^]*)/);
					fixupData.shift ();
					var fixupParser = fixupData.shift ();

					// console.log ('parsing etc/' + self.instance + '/fixup using "' + fixupParser + '" parser');
					// TODO: error handling

					if (fixupParser == 'json') {
						fixupConfig = self.fixupConfig = JSON.parse (fixupData[0]);
					} else {
						console.error (
							'parser ' + fixupParser + ' unknown in etc/' + self.instance + 'fixup; '
							+ 'we analyze parser using first string of file; '
							+ 'you must put in first string comment with file format, like "// json"');
					}
				}

				util.extend (true, self.config, fixupConfig);

				var unpopulatedVars = false;

				// var variables = {};

				var tagRe = /^<([^>]+)>$/;
				function iterateNode (node, key, depth) {
					var value = node[key];
					var fullKey = depth.join ('.');
					var match;

					if ('string' === typeof value) {
						match = value.match(tagRe);
						if (match) {

							if (match[1].match (/^\$\w+/)) {
								self.variables[fullKey] = [match[1]];
								self.logUnpopulated (fullKey);
								unpopulatedVars = true;
								return;
							}
						}
					}

					if (self.variables[fullKey] && !match) {
						self.variables[fullKey][1] = value.toString ? value.toString() : value;
					}
				}

				self.iterateTree (config, iterateNode, []);

				if (unpopulatedVars) {
					self.emit ('error', 'unpopulated variables');
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
				console.error ('requirement failed:', log.errMsg (e.toString()), "in", log.path (self.root.relative (modPath)));
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

Project.prototype.iterateTree = function iterateTree (tree, cb, depth) {
	if (null == tree)
		return;

	var level = depth.length;

	var step = function (node, key, tree) {
		depth[level] = key;
		cb (tree, key, depth);
		iterateTree (node, cb, depth.slice (0));
	};

	if (Array === tree.constructor) {
		tree.forEach (step);
	} else if (Object === tree.constructor) {
		Object.keys(tree).forEach(function (key) {
			step (tree[key], key, tree)
		});
	}
}


Project.prototype.loadIncludes = function (config, level, cb) {
	var self = this;

	var DEFAULT_ROOT = this.configDir,
		DELIMITER = ' > ',
		tagRe = /^<([^>]+)>$/,
		cnt = 0,
		len = 0;

	var levelHash = {};

	var variables = {};

	level.split(DELIMITER).forEach(function(key) {
		levelHash[key] = true;
	});

	function onLoad() {
		cnt += 1;
		if (cnt >= len) {
			cb(null, config, variables);
		}
	}

	function onError(err) {
		console.log('[WARNING] Level:', level, 'is not correct.\nError:', log.errMsg (err));
		cb(err, config, variables);
	}

	function iterateNode (node, key, depth) {
		var value = node[key];

		if ('string' === typeof value) {
			var match = value.match(tagRe);
			if (match) {
				len ++;

				if (match[1].match (/^\$\w+/)) {
					variables[depth.join ('.')] = [match[1]];
					len --;
					return;
				}
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

	this.iterateTree(config, iterateNode, []);

//	console.log('including:', level, config);

	!len && cb(null, config, variables);
}
