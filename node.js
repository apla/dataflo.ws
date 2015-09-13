var MODULE_NAME = 'dataflo.ws';
var INITIATOR_PATH = 'initiator';

var path   = require ('path'),
	fs     = require ('fs'),
	util   = require ('util'),
	common = require ('./common'),
	color  = require ('./color'),
	DF     = require ('./index'),
	io     = require ('./io/easy');


color.error     = color.bind (color, "red+white_bg");
color.path      = color.cyan.bind (color);
color.dataflows = color.green.bind (color, "dataflows");

var util   = require ('util');

try {
	util.clone = require('node-v8-clone').clone;
} catch (e) {
	console.log (
		color.dataflows(),
		color.path ('node-v8-clone'),
		'recommended to install to fasten clone operations'
	);
}

function NodeDF () {

}

util.inherits (NodeDF, DF);

for (var staticFn in DF) {
	if (DF.hasOwnProperty(staticFn)) {
		NodeDF[staticFn] = DF[staticFn];
	}
}

NodeDF.color  = color;

NodeDF.registry = DF.registry;

DF.instanceTypes.forEach (function (instanceType) {
	// NodeDF.registry[instanceType] = {};
	NodeDF[instanceType] = function (instanceName) {
		return registryLookup (instanceType, instanceName);
	};
});

module.exports = NodeDF;

function registryLookup (instanceType, instanceName) {
	var instanceClass = DF.registry[instanceType] &&
		DF.registry[instanceType][instanceName];

	if (instanceClass) {
		return instanceClass;
	}

	// TODO: remove
	if ($isClientSide) {
			console.error (
				'you need to run dataflows.register ("'
				+instanceType+'", "'+instanceName
				+'", instance) before using this task'
			);
			return;
		}


		var fixedName = instanceName;
		if (instanceType == 'initiator') {
			fixedName = instanceName.replace(/d$/, '');
			if (fixedName !== instanceName) {
				console.warn(
		'[DEPRECATED] Remove trailing "d" from "%s" in your initiator config',
					instanceName
				);
			}
		} else if (instanceType == 'task') {
			fixedName = instanceName.replace(/^(dataflo\.ws\/)?task\//, '');
			if (fixedName !== instanceName) {
				console.warn(
		'[DEPRECATED] Remove preceding "task/" from "%s" in your task config',
					instanceName
				);
			}
		}

		var project;
		var project_root;

		if (common.getProject)
			project = common.getProject();

		if (project)
			project_root = project.root;

		instanceClass = getModule (instanceType, fixedName, false, project_root);

	DF.registry[instanceType][instanceName] = instanceClass;

	return instanceClass;
};

function getModule (type, name, optional, root) {
	optional = optional || false;
	var mod;

	if (!root) {
		if (typeof project !== "undefined") {
			root = project.root;
		} else {
			root = new io (path.dirname (require.main.filename));
		}
	}

	var paths = [
		path.join('dataflo.ws', type, name)
	];

	if (name.match (/^\./)) {
		paths.unshift (name);
	}

	if (root) {
		paths.push (path.resolve(root.path ? root.path : root, type, name));
		paths.push (path.resolve(root.path ? root.path : root, 'node_modules', type, name));
	}

	paths.push (name);

	var taskFound = paths.some (function (modPath) {
		try {
			mod = require(modPath);
			return true;
		} catch (e) {
			// assume format: Error: Cannot find module 'csv2array' {"code":"MODULE_NOT_FOUND"}
			if (e.toString().indexOf(name + '\'') > 0 && e.code == "MODULE_NOT_FOUND") {
				return false;
			} else {
				console.error (
					'requirement failed:',
					color.error (e.toString()),
					root
						? "in " + color.path (root.relative (modPath).match (/^\.\./) ? modPath : root.path)
						: ""
				);
				return true;
			}
		}
	});

	if (!mod && !optional)
		console.error ("module " + type + " " + name + " cannot be used");

	return mod;

}

// - - -

/**
 * Makes symlinks from modules to base dataflo.ws directory.
 */
module.exports.install = function (moduleName) {
	var baseDir = path.dirname(require.resolve(MODULE_NAME));
	var nodePath = path.dirname(baseDir);
	var moduleDir = path.join(nodePath, moduleName);

	instanceTypes.forEach(function (dir) {
		var srcDir = path.join(moduleDir, dir);
		var destDir = path.join(baseDir, dir);

		if (fs.existsSync(srcDir)) {
			var files = fs.readdirSync(srcDir);
			files.forEach(function (fileName) {
				var srcPath = path.join(srcDir, fileName);
				var destPath = path.join(destDir, fileName);
				if (!fs.existsSync(destPath)) {
					fs.symlinkSync(srcPath, destPath);
				}
			});
		}
	});
};
