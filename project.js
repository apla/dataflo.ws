var path = require ('path');
var util = require ('util');

var io = require ('./io/easy');

var Project = function (rootPath) {
	var rootPath = rootPath || process.env['PROJECT_ROOT'] || process.cwd();
	var projectRoot = new io(rootPath);

	this.root = projectRoot;
	var self = this;

	var configDir = '.dataflows';
	var varDir    = '.dataflows';

	this.loadConfig (configDir, varDir);
};

module.exports = Project;

var EventEmitter = require ('events').EventEmitter;

util.inherits (Project, EventEmitter);

Project.prototype.loadConfig = function (configDir, varDir) {

	var self = this;

	this.root.fileIO (path.join(configDir, 'project')).readFile (function (err, data) {
		if (err) {
			console.error ("can't access "+configDir+"/project file. create one and define project id");
			// process.kill ();
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
				console.log ('WARNING: project config cannot parsed');
				throw e;
			}

			// TODO: read config fixup
		} else {
			console.error (
				'parser ' + parser + ' unknown in '+configDir+'/project; '
				+ 'we analyze parser using first string of file; '
				+ 'you must put in first string comment with file format, like "// json"');
			// process.kill ();
			return;
		}


		self.id     = config.id;

		self.loadIncludes(config, function (err, config) {
			if (err) {
				console.error(err);
				console.warn("Couldn't load includes.");
				self.emit ('ready');
				return;
			}

			self.config = config;

			self.root.fileIO ('var/instance').readFile (function (err, data) {

				if (err) {
					console.error ("PROBABLY HARMFUL: can't access var/instance: "+err);
					self.emit ('ready');
					return;
				}

				var instance = (""+data).split (/\n/)[0];

				self.instance = instance;

				console.log ('instance is: ', instance);

				self.root.fileIO (path.join(configDir, instance, 'fixup')).readFile (function (err, data) {
					if (err) {
						console.error ("PROBABLY HARMFUL: can't access "+path.join(configDir, instance, 'fixup')+" file. "
									   + "create one and define local configuration fixup. "
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

					// console.log ('parsing etc/' + instance + '/fixup using "' + fixupParser + '" parser');
					// TODO: error handling

					if (fixupParser == 'json') {
						var config = JSON.parse (fixupData[0]);

						util.extend (true, self.config, config);
					} else {
						console.error (
							'parser ' + fixupParser + ' unknown in etc/' + instance + 'fixup; '
							+ 'we analyze parser using first string of file; '
							+ 'you must put in first string comment with file format, like "// json"');

						// process.kill ();
						return;
					}

					console.log ('project ready');

					self.emit ('ready');
				});
			});
		}, 'projectRoot');
	});
}


Project.prototype.connectors = {};
Project.prototype.connections = {};

Project.prototype.getModule = function (type, name, optional) {
	optional = optional || false;
	var mod;
	var taskFound = [
		path.join('dataflo.ws', type, name),
		path.resolve(this.root.path, type, name),
		path.resolve(this.root.path, 'node_modules', type, name),
		name
	].some (function (path) {
		try {
			mod = require(path);
			return true;
		} catch (e) {
			// assuming format: Error: Cannot find module 'csv2array' {"code":"MODULE_NOT_FOUND"}
			if (e.toString().indexOf(name + '\'') > 0 && e.code == "MODULE_NOT_FOUND") {
				return false;
			} else {
				console.error ('when require \"' + path + '\": ' + e.toString());
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
	return this.getModule('node_modules', name, optional) ||
		this.getModule('', name, optional);
}

var configCache = {};

Project.prototype.loadIncludes = function (config, cb, level) {
	var self = this;

	var DEFAULT_ROOT = 'etc/',
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
		console.log('[WARNING] Level:', level, 'is not correct.\nError:', err);
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

				var path = match[1];

				if (0 !== path.indexOf('/')) {
					path = DEFAULT_ROOT + path;
				}

				if (path in levelHash) {
					//console.error('\n\n\nError: on level "' + level + '" key "' + key + '" linked to "' + value + '" in node:\n', node);
					throw new Error('circular linking');
				}

				delete node[key];

				if (configCache[path]) {

					node[key] = util.clone(configCache[path]);
					onLoad();

				} else {

					self.root.fileIO(path).readFile(function (err, data) {
						if (err) {

							onError(err);

						} else {

							self.loadIncludes(JSON.parse(data), function(tree, includeConfig) {

								configCache[path] = includeConfig;

								node[key] = util.clone(configCache[path]);
								onLoad();
							}, level + DELIMITER + path);

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
