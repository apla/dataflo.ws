"use strict";

var path = require ('path');
var fs   = require ('fs');
var util = require ('util');

var EventEmitter = require ('events').EventEmitter;

var dataflows = require ('./index');
var io        = require ('./io/easy');
var paint     = require ('./color');
var common    = require ('./common');

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
	this.root = new io (rootPath || process.env.PROJECT_ROOT || process.cwd());

	this.configDir = process.env.PROJECT_CONF || '.dataflows';
	this.varDir    = process.env.PROJECT_VAR  || '.dataflows';

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

util.inherits (Project, EventEmitter);

Project.prototype.checkLegacy = function (cb) {
	var self = this;
	this.root.fileIO ('etc/project').stat(function (err, stats) {
		if (!err && stats && stats.isFile()) {
			console.error (paint.error ('project has legacy configuration layout. you can migrate by running those commands:'));
			console.error ("\n\tcd "+self.root.path);
			console.error ("\tmv etc .dataflows");

			// console.warn ("in", paint.dataflows ("@0.60.0"), "we have changed configuration layout. please run", paint.path("dataflows doctor"));
			self.configDir = 'etc';
			self.varDir    = 'var';
			self.legacy    = true;
		}
		self.emit ('legacy-checked');
	});
};

Project.prototype.checkConfig = function (cb) {
	var self = this;
	if (self.legacy) {
		self.emit ('config-checked');
		return;
	}

	// search for config root
	var guessedRoot = this.root;
	guessedRoot.findUp (this.configDir, function (foundConfigDir) {
		var detectedRoot = foundConfigDir.parent();
		if (self.root.path !== detectedRoot.path) {
			console.log (paint.dataflows (), 'using', paint.path (detectedRoot.path), 'as project root');
		}
		self.root = detectedRoot;
		self.emit ('config-checked');
		return true;
	}, function () {
		self.emit ('error', 'no project config');
	});
};


Project.prototype.readInstance = function () {
	var self = this;
	this.instance = process.env.PROJECT_INSTANCE;
	if (this.instance) {
		console.log (paint.dataflows(), 'instance is:', paint.path (instance));
		self.emit ('instantiated');
		return;
	}
	var instanceFile = this.root.fileIO (path.join (this.varDir, 'instance'));

	instanceFile.readFile (function (err, data) {

		if (err) {
			var instanceName = process.env.USER + '@' + process.env.HOSTNAME;
			// it is ok to have instance name defined and have no instance
			// or fixup file because fixup is empty
			self.instance = instanceName;
			self.root.fileIO (path.join (self.varDir, instanceName)).mkdir ();
			instanceFile.writeFile (instanceName);
			self.emit ('instantiated');
			return;
		}

		// assume .dataflows dir always correct
		// if (err && self.varDir != '.dataflows') {
			// console.error ("PROBABLY HARMFUL: can't access "+self.varDir+"/instance: "+err);
			// console.warn (paint.dataflows(), 'instance not defined');
		// } else {

			var instance = (""+data).split (/\n/)[0];
			self.instance = instance == "undefined" ? null : instance;
			var args = [paint.dataflows(), 'instance is:', paint.path (instance)];
			if (err) {
				args.push ('(' + paint.error (err) + ')');
			} else if (self.legacy) {
				console.error ("\tmv var/instance .dataflows/");
			}
			if (self.legacy) console.log ();
			console.log.apply (console, args);
		// }

		self.emit ('instantiated');
	});
};

Project.prototype.logUnpopulated = function(varPaths) {
	console.error ("those config variables is unpopulated:");
	for (var varPath in varPaths) {
		var value = varPaths[varPath][0];
		console.log ("\t", paint.path(varPath), '=', value);
		varPaths[varPath] = value || "<#undefined>";
	}
	console.error (
		"you can run",
		paint.dataflows ("config set <variable> <value>"),
		"to define individual variable\nor edit",
		paint.path (".dataflows/"+this.instance+"/fixup"),
		"to define all those vars at once"
	);
	// console.log (this.logUnpopulated.list);
};

Project.prototype.setVariables = function (fixupVars, force) {
	var self = this;
	// ensure fixup is defined
	if (!this.instance) {
		console.log ('Cannot write to the fixup file with undefined instance. Please run', paint.dataflows('init'));
		process.kill ();
	}

	if (!self.fixupConfig)
		self.fixupConfig = {};

	// apply patch to fixup config
	Object.keys (fixupVars).forEach (function (varPath) {
		var pathChunks = [];
		var root = self.fixupConfig;
		varPath.split ('.').forEach (function (chunk, index, chunks) {
			pathChunks[index] = chunk;
			var newRoot = root[chunk];
			if (index === chunks.length - 1) {
				if (force || !(chunk in root)) {
					root[chunk] = fixupVars[varPath][0] || "<#undefined>";
				}
			} else if (!newRoot) {
				root[chunk] = {};
				newRoot = root[chunk];
			}
			root = newRoot;
		});
	});

	// wrote config to the fixup file
	fs.writeFileSync (
		this.fixupFile,
		JSON.stringify (this.fixupConfig, null, "\t")
	);
};

Project.prototype.formats = [{
	type: "json",
	check: /(\/\/\s*json[ \t\n\r]*)?[\{\[]/,
	parse: function (match, configData) {
		try {
			var config = JSON.parse ((""+configData).substr (match[0].length - 1));
			return {object: config};
		} catch (e) {
			return {object: null, error: e};
		}
	},
	stringify: JSON.stringify.bind (JSON),
}, {
	type: "ini",
	check: /^;\s*ini/,
	require: "ini",
	parse: function () {

	},
	stringify: function () {

	}
}];


Project.prototype.parseConfig = function (configData, configFile) {
	var self = this;
	var result;
	this.formats.some (function (format) {
		var match = (""+configData).match (format.check);
		if (match) {
			result = format.parse (match, configData);
			result.type = format.type;
			return true;
		}
	});
	if (!result) {
		var message =
			'Unknown file format in '+(configFile.path || configFile)+'; '
			+ 'for now only JSON supported. You can add new formats using Project.prototype.formats.';
		console.error (paint.error (message));
		self.emit ('error', message);
	}
	return result;
}

Project.prototype.interpolateVars = function (error) {
	// var variables = {};
	var self = this;

	function iterateNode (node, key, depth) {
		var value = node[key];
		var fullKey = depth.join ('.');
		var match;

		if (self.variables[fullKey]) {
			self.variables[fullKey][1] = value;
		}

		if ('string' !== typeof value)
			return;

		var enchanted = self.isEnchantedValue (value);
		if (!enchanted) {
			// WTF???
			if (self.variables[fullKey]) {
				self.variables[fullKey][1] = value.toString ? value.toString() : value;
			}

			return;
		}
		if ("placeholder" in enchanted) {
			// this is a placeholder, not filled in fixup
			self.variables[fullKey] = [value];
			if (enchanted.optional) {
				self.variables[fullKey][1] = null;
				node[key] = null;
			} else if (enchanted.default) {
				self.variables[fullKey][1] = enchanted.default;
				node[key] = enchanted.default;
			}
			return;
		}
		if ("variable" in enchanted) {
			// this is a variable, we must fill it now
			// current match is a variable path
			// we must write both variable path and a key,
			// containing it to the fixup

			var varValue = self.getKeyDesc (enchanted.variable.substr (1));
			if (varValue.enchanted !== undefined) {
				if ("variable" in varValue.enchanted) {
					console.error (
						"variable value cannot contains another variables. used variable",
						paint.path(enchanted.variable),
						"which resolves to",
						paint.path (varValue.value),
						"in key",
						paint.path(fullKey)
					);
					process.kill ();
				}
				self.variables[fullKey] = [value];
			} else if (varValue.value !== undefined) {
				node[key] = value.interpolate (self.config, {start: '<', end: '>'});
				self.variables[fullKey] = [value, node[key]];
			} else {
				self.variables[fullKey] = [value];
			}

			return;
		}
		// this cannot happens, but i can use those checks for assertions
		if ("error" in enchanted || "include" in enchanted) {
			// throw ("this value must be populated: \"" + value + "\"");
		}
	}

	self.iterateTree (self.config, iterateNode, []);

	var unpopulatedVars = {};

	var varNames = Object.keys (self.variables);
	varNames.forEach (function (varName) {
		if (self.variables[varName][1] !== undefined) {

		} else {
			unpopulatedVars[varName] = self.variables[varName];
		}
	});

	this.setVariables (self.variables);

	// any other error take precendence over unpopulated vars
	if (Object.keys(unpopulatedVars).length || error) {
		if (unpopulatedVars) {
			self.logUnpopulated(unpopulatedVars);
		}
		self.emit ('error', error || 'unpopulated variables');
		return;
	}

	// console.log ('project ready');

	self.emit ('ready');


}

Project.prototype.loadConfig = function () {

	var self = this;

	var configFile = this.root.fileIO (path.join(this.configDir, 'project'))
	configFile.readFile (function (err, data) {
		if (err) {
			var message = "Can't access "+self.configDir+"/project file. Create one and define project id";
			console.error (paint.dataflows(), paint.error (message));
			// process.kill ();
			self.emit ('error', message);
			return;
		}

		var config;
		var parsed = self.parseConfig (data, configFile);
		if (parsed.object) {
			config = parsed.object;
		} else {
			var message = 'Project config cannot be parsed:';
			console.error (message, paint.error (parsed.error));
			self.emit ('error', message + ' ' + parsed.error.toString());
			process.kill ();
		}

		self.id = config.id;

		// TODO: load includes after fixup is loaded
		self.loadIncludes(config, 'projectRoot', function (err, config, variables, placeholders) {

			self.variables    = variables;
			self.placeholders = placeholders;

			if (err) {
				console.error (err);
				console.warn ("Couldn't load includes.");
				// actually, failure when loading includes is a warning, not an error
				self.interpolateVars();
				return;
			}

			self.config = config;

			if (!self.instance) {
				self.interpolateVars ();
				return;
			}

			self.fixupFile = path.join(self.configDir, self.instance, 'fixup');

			self.root.fileIO (self.fixupFile).readFile (function (err, data) {
				var fixupConfig = {};
				if (err) {
					console.error (
						"Config fixup file unavailable ("+paint.path (path.join(self.configDir, self.instance, 'fixup'))+")",
						"Please run", paint.dataflows ('init')
					);
				} else {
					var parsedFixup = self.parseConfig (data, self.fixupFile);
					if (parsedFixup.object) {
						self.fixupConfig = fixupConfig = parsedFixup.object;
					} else {
						var message = 'Config fixup cannot be parsed:';
						console.error (message, paint.error (parsedFixup.error));
						self.emit ('error', message + ' ' + parsedFixup.error.toString());
						process.kill ();
					}
				}

				util.extend (true, self.config, fixupConfig);

				self.interpolateVars ();

			});
		});
	});
};

function Config () {

}

Config.prototype.getValueByKey = function (key) {
	// TODO: techdebt to remove such dep
	var value = common.getByPath (key, this);
	if (this.isEnchanted (value)) {
		return null;
	}
	return value;
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
				console.error ('requirement failed:', paint.error (e.toString()), "in", paint.path (self.root.relative (modPath)));
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
};

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
			step (tree[key], key, tree);
		});
	}
};

Project.prototype.getKeyDesc = function (key) {
	var result = {};
	var value = common.getByPath (key, this.config);
	result.value = value.value;
	result.enchanted = this.isEnchantedValue (result.value);
	// if value is enchanted, then it definitely a string
	if (result.enchanted && "variable" in result.enchanted) {
		result.interpolated = result.value.interpolate();
		return result;
	}
	return result;
}


Project.prototype.getValue = function (key) {
	var value = common.getByPath (key, this.config).value;
	if (value === undefined)
		return;
	var enchanted = this.isEnchantedValue (value);
	// if value is enchanted, then it definitely a string
	if (enchanted && "variable" in enchanted) {
		var result = new String (value.interpolate());
		result.rawValue = value;
		return result;
	}
	return value;
}

Project.prototype.isEnchantedValue = function (value) {

	var tagRe = /<(([\$\#]*)((optional|default):)?([^>]+))>/;
	var result;

	if ('string' !== typeof value) {
		return;
	}
	var check = value.match (tagRe);
	if (check) {
		if (check[2] === "$") {
			return {"variable": check[1]};
		} else if (check[2] === "#") {
			result = {"placeholder": check[1]};
			if (check[4]) result[check[4]] = check[5];
			return result;
		} else if (check[0].length === value.length) {
			return {"include": check[1]};
		} else {
			return {"error": true};
		}
	}
}


Project.prototype.loadIncludes = function (config, level, cb) {
	var self = this;

	var DEFAULT_ROOT = this.configDir,
		DELIMITER = ' > ',
		cnt = 0,
		len = 0;

	var levelHash = {};

	var variables = {};
	var placeholders = {};

	level.split(DELIMITER).forEach(function(key) {
		levelHash[key] = true;
	});

	function onLoad() {
		cnt += 1;
		if (cnt >= len) {
			cb(null, config, variables, placeholders);
		}
	}

	function onError(err) {
		console.log('[WARNING] Level:', level, 'is not correct.\nError:', paint.error (err));
		cb(err, config, variables, placeholders);
	}

	function iterateNode (node, key, depth) {
		var value = node[key];

		if ('string' !== typeof value)
			return;

		var enchanted = self.isEnchantedValue (value);
		if (!enchanted)
			return;
		if ("variable" in enchanted) {
			variables[depth.join ('.')] = [value];
			return;
		}
		if ("placeholder" in enchanted) {
			variables[depth.join ('.')] = [value];
			return;
		}
		if ("error" in enchanted) {
			console.error ('bad include tag:', "\"" + value + "\"");
			onError();
			return;
		}
		if ("include" in enchanted) {
			len ++;
			var incPath = enchanted.include;

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
				return;

			}

			self.root.fileIO(incPath).readFile(function (err, data) {
				if (err) {
					onError(err);
					return;
				}

				self.loadIncludes(JSON.parse(data), path.join(level, DELIMITER, incPath), function(tree, includeConfig) {
					configCache[incPath] = includeConfig;

					node[key] = util.clone(configCache[incPath]);
					onLoad();
				});
			});

		}
	}

	this.iterateTree(config, iterateNode, []);

//	console.log('including:', level, config);

	!len && cb(null, config, variables, placeholders);
};
