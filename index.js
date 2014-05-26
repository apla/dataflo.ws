var define;
if (typeof define === "undefined") {
	define = function (classInstance) {
		classInstance (require, exports, module);
	};
}

var registry = {};
define (function (require, exports, module) {

var MODULE_NAME = 'dataflo.ws';
var INITIATOR_PATH = 'initiator';

var path,
	fs,
	common = require ('./common'),
	color  = require ('./color');

if ($isServerSide) {
	path = require ('path');
	fs   = require ('fs');

}


var instanceTypes = [ 'initiator', 'task' ];

// - - -

// TODO: add requirejs loading

function registryLookup (instanceType, instanceName) {
	var instanceClass = registry[instanceType] &&
		registry[instanceType][instanceName];

	if (!instanceClass) {
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

		var project = common.getProject();
		instanceClass = project.getModule (instanceType, fixedName);
	}

	return registry[instanceType][instanceName] = instanceClass;
};

instanceTypes.forEach(function(instanceType) {
	registry[instanceType] = {};
	module.exports[instanceType] = function (instanceName) {
		return registryLookup (instanceType, instanceName);
	};
});

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

/**
 * Register base entities for dataflo.ws processing.
 */
module.exports.register = function (instanceType, instanceName, instanceClass) {
	if (!registry[instanceType]) {
		console.warn(
			'Unexpected instance type. Predefined types is: ['+instanceTypes.join(', ')+']'
		);

		return;
	}

	registry[instanceType][instanceName] = instanceClass;
};

color.error     = color.bind (color, "red+white_bg");
color.path      = color.cyan.bind (color);
color.dataflows = color.green.bind (color, "dataflows");

	
module.exports.common = common;
module.exports.color  = color;
	


});
