var util = require ('util');

Object.PLATFORM_NATIVE_TYPES = {
	// Buffer seems to be the only custom type in the Node core
	'Buffer': true
};

Object.lookUpCustomType = function (obj) {
	var name = obj && obj.constructor && obj.constructor.name;
	if (name && name in Object.PLATFORM_NATIVE_TYPES) {
		return name;
	}
};
/**
 * Get the type of any object.
 * Usage:
 *     Object.typeOf([ 1, 2, 3 ]);    // 'Array'
 *     Object.typeOf(null);           // 'Null'
 *     Object.typeOf(new Buffer('')); // 'Buffer'
 */
Object.typeOf = function (obj) {
	return Object.lookUpCustomType(obj) ||
		Object.prototype.toString.call(obj).slice(8, -1);
};

/**
 * Safe and universal type check.
 * Usage:
 *     Object.is('Number', 4);            // true
 *     Object.is('Undefined', undefined); // true
 */
Object.is = function (type, obj) {
	return type == Object.typeOf(obj);
};

function isEmpty(obj) {
	var type = Object.typeOf(obj);
	return (
		('Undefined' == type)                              ||
		('Null'      == type)                              ||
		('Boolean'   == type && false === obj)             ||
		('Number'    == type && (0 === obj || isNaN(obj))) ||
		('String'    == type && 0 == obj.length)           ||
		('Array'     == type && 0 == obj.length)           ||
		('Object'    == type && 0 == Object.keys(obj).length)
	);
}

console.print = function () {
	var BLUE = '';
	var RESET = '';
	var line = '============================================================';

	if ($isServerSide) {
		BLUE = '\033[34m';
		RESET = '\033[0m';
	}

	var err = new Error();
	var stack = err.stack.split('\n');
	var lastFunc = stack[2];
	var msg = [];
	msg.push.apply(msg, arguments);

	var start = BLUE + line + '\n' + lastFunc + RESET + '\n';
	var end ='\n' + BLUE + line + RESET;

	if (Object.is('String', msg[0])) {
		msg[0] = start + msg[0];
	} else {
		msg.unshift(start);
	}
	msg.push(end);

	return console.log.apply(console, msg);
};

var Project;
var projectRoot;
var projectInstance;

if (!util.inherits) {
	util.inherits = function (ctor, superCtor) {
		ctor.super_ = superCtor;
		ctor.prototype = Object.create (superCtor.prototype, {
			constructor: {
			value: ctor,
			enumerable: false,
			writable: true,
			configurable: true
		}});
	};
}

if (!util.extend) {
util.extend = function extend () {
	var hasOwnProperty = Object.prototype.hasOwnProperty;

	// copy reference to target object
	var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;
	// Handle a deep copy situation
	if (typeof target === "boolean") {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}
	// Handle case when target is a string or something (possible in deep copy)
	if (typeof target !== "object" && !typeof target === 'function')
		target = {};
	var isPlainObject = function(obj) {
		// Must be an Object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window objects don't pass through, as well
		if (!obj || !Object.is('Object', obj) || obj.nodeType || obj.setInterval)
			return false;
		var has_own_constructor = hasOwnProperty.call(obj, "constructor");
		var has_is_property_of_method = hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf");
		// Not own constructor property must be Object
		if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
			return false;
		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		var last_key;
		for (var key in obj)
			last_key = key;
		return typeof last_key === "undefined" || hasOwnProperty.call(obj, last_key);
	};
	for (; i < length; i++) {
		// Only deal with non-null/undefined values
		if ((options = arguments[i]) !== null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];
				// Prevent never-ending loop
				if (target === copy)
					continue;
				// Recurse if we're merging object literal values or arrays
				if (deep && copy && (isPlainObject(copy) || Array.isArray(copy))) {
					var clone = src && (isPlainObject(src) || Array.isArray(src)) ? src : Array.isArray(copy) ? [] : {};
					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);
					// Don't bring in undefined values
				} else if (typeof copy !== "undefined")
					target[name] = copy;
			}
		}
	}
	// Return the modified object
	return target;
}
}

if (!util.shallowMerge) {
	util.shallowMerge = function (dest, src, filter) {
		Object.keys(src).forEach(function (key) {
			if ((!filter || -1 != filter.indexOf(key)) && null == dest[key]) {
				dest[key] = src[key];
			}
		});
		return dest;
	};
}

if (!util.clone) {
	util.clone = function(object) {

		var result;

		if (object.constructor === Array) {
			result = object.map(function(item) {
				return util.clone(item);
			});
		} else if (object.constructor === Object) {
			result = {};
			util.extend(result, object);
		} else {
			result = object;
		}

		return result;

	}
}

try {
	if (process.pid) {
		global.$isClientSide = false;
		global.$isServerSide = true;
		global.$mainModule   = process.mainModule;
		global.$scope        = 'process.mainModule';
		global.$stash        = {};
		global.$isPhoneGap   = false;
		global.$global       = global;
	} else {
		throw 'WTF?';
	}
} catch (e) {
	window.$isClientSide = true;
	window.$isServerSide = false;
	window.$mainModule   = window;
	window.$scope        = 'window';
	window.$stash        = {};
	window.$global       = window;
	try {
		if (window.PhoneGap || window.Cordova || window.cordova) window.$isPhoneGap = true;
	} catch (e) {
		console.log (e);
		window.$isPhoneGap = false;
	}
}

Number.prototype.hours = Number.prototype.hour
	= function () {return this * 60 * 60 * 1e3}
Number.prototype.minutes = Number.prototype.minute
	= function () {return this * 60 * 1e3}
Number.prototype.seconds = Number.prototype.second
	= function () {return this * 1e3}

Number.prototype.times = function (cb) {
	var a = [];
	for (var i = 0; i < this; i++)
		a[i] = cb (i);
	return a;
}

module.exports.$global = $global;

// overwrite subject with values from object (merge object with subject)
var mergeObjects = module.exports.mergeObjects = function (object, subjectParent, subjectKey) {
	// subject parent here for js's lack of pass by reference

	if (subjectParent[subjectKey] === void 0)
		subjectParent[subjectKey] = {};
	var subject = subjectParent[subjectKey];
	for (var objectField in object) {
		subject[objectField] = object[objectField];
	}
};

var getByPath = module.exports.getByPath = function (path, origin) {
	var value = origin || $global;
	var scope, key;
	var validPath = path.split('.').every(function (prop) {
		scope = value;
		key = prop;
		if (null == scope) {
			// break
			return false;
		} else {
			value = scope[key];
			return true;
		}
	});
	return validPath && { value: value, scope: scope, key: key };
};

var pathToVal = module.exports.pathToVal = function (dict, path, value, method) {
	var chunks = 'string' == typeof path ? path.split('.') : path;
	var chunk = chunks[0];
	var rest = chunks.slice(1);
	if (chunks.length == 1) {
		var oldValue = dict[chunk];
		if (value !== undefined) {
			if (method !== undefined) {
				method(value, dict, chunk);
			} else {
				dict[chunk] = value;
			}
		}
		return oldValue;
	}
	return pathToVal(dict[chunk], rest, value, method);
};

// - - -

var configCache = {};

function loadIncludes(config, cb, level) {

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

					projectRoot.fileIO(path).readFile(function (err, data) {
						if (err) {

							onError(err);

						} else {

							loadIncludes(JSON.parse(data), function(tree, includeConfig) {

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

var define;
if (typeof define === "undefined")
	define = function () {};
var _exports = module.exports;
define (function (require, exports, module) {
	return _exports;
});


String.prototype.interpolate = function (dict, marks) {
	if (!marks) {
		marks = {
			start: '{', end: '}',
			path: '.',
			typeSafe: '$',
			typeRaw: '*'
		};
	}

	// TODO: escape character range delims
	var re = new RegExp([
		'[', marks.start, ']',
		'([', marks.typeSafe, marks.typeRaw, '])',
		'([^', marks.end, ']+)',
		'[', marks.end, ']'
	].join(''), 'g');

	var startRe = new RegExp([
		'[', marks.start, ']',
		'([', marks.typeSafe, marks.typeRaw, '])'
	].join(''), 'g');

	var values = [];

	var replacedStr = this.replace(re, function (_, varType, varPath) {
		if (varPath.indexOf(marks.path) > -1) {
			var value = pathToVal(dict, varPath);
		} else {
			value = dict[varPath];
		}

		if (isEmpty(value) && varType == marks.typeSafe) {
			value = undefined;
		}

		values.push(value);

		return value;
	});

	if (values.some(function (v) { return (typeof v === "undefined"); })) {
		return undefined;
	}

	if (values.length === 1 && (values[0] + '') === replacedStr) {
		return values[0];
	}

	return replacedStr;
};

if ($isServerSide) {

	var path = require ('path');

	var io = require ('./io/easy');

	Project = function (rootPath) {
		rootPath = rootPath || process.env['PROJECT_ROOT'] || process.cwd();
		projectRoot = new io(rootPath);

		this.root = projectRoot;
		var self = this;

		projectRoot.fileIO ('etc/project').readFile (function (err, data) {
			if (err) {
				console.error ("can't access etc/project file. create one and define project id");
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
					'parser ' + parser + ' unknown in etc/project; '
					+ 'we analyze parser using first string of file; '
					+ 'you must put in first string comment with file format, like "// json"');
				// process.kill ();
				return;
			}


			self.id     = config.id;

			loadIncludes(config, function (err, config) {
				if (err) {
					console.error(err);
					console.warn("Couldn't load inlcudes.");
					self.emit ('ready');
					return;
				}

				self.config = config;

				projectRoot.fileIO ('var/instance').readFile (function (err, data) {

					if (err) {
						console.error ("PROBABLY HARMFUL: can't access var/instance: "+err);
						self.emit ('ready');
						return;
					}

					var instance = (""+data).split (/\n/)[0];

					self.instance = instance;

					console.log ('instance is: ', instance);

					projectRoot.fileIO ('etc/' + instance + '/fixup').readFile (function (err, data) {
						if (err) {
							console.error ("PROBABLY HARMFUL: can't access "+'etc/' + instance + '/fixup'+" file. "
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
	};

	var EventEmitter = require ('events').EventEmitter;

	util.inherits (Project, EventEmitter);

	util.extend (Project.prototype, {
		connectors:  {},
		connections: {},

		getModule: function (type, name, optional) {
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
		},

		getInitiator: function (name) {
			return this.getModule('initiator', name);
		},

		getTask: function (name) {
			return this.getModule('task', name);
		},

		require: function (name, optional) {
			return this.getModule('node_modules', name, optional) ||
				this.getModule('', name, optional);
		}
	});
}

module.exports.getProject = function (rootPath) {
	if (!projectInstance) {
		projectInstance = new Project(rootPath);
	}
	return projectInstance;
};

module.exports.isEmpty = isEmpty;
