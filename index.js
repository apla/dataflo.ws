var path = require('path');
var fs = require('fs');

var MODULE_NAME = 'dataflo.ws',
	INITIATOR_PATH = 'initiator',

	common = require(path.join(MODULE_NAME, 'common')),
	instanceTypes = [ 'initiator', 'task' ],
	registry = {};

// - - -

instanceTypes.forEach(function(instanceType) {
	registry[instanceType] = {};
});

// - - -

module.exports = {

	/**
	 * Makes symlinks from modules to base dataflo.ws directory.
	 */

	install: function (moduleName) {

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

	},

	/**
	 * Register base entities for dataflo.ws processing.
	 */

	register: function(instanceType, instanceName, instanceClass) {

		if (!registry[instanceType]) {

			console.warn(
				'Unexpected instance type. Predefined types [' +
				instanceTypes.join(', ') +
				']'
			);

			return;
		}

		registry[instanceType][instanceName] = instanceClass;

	},

	/**
	 * Get base entities for dataflo.ws processing from reqister or FS.
	 */

	getEntityClass: function(instanceType, instanceName) {

		var instanceClass = registry[instanceType] && registry[instanceType][instanceName];

		if (!instanceClass) {

			// get from symlink
			try {

				instanceClass = require(
					path.join(MODULE_NAME, instanceType, instanceName
				));

			} catch (e) {

				// FIXME later: legacy initiator names
				var fixedName = instanceName.replace(/d$/, '');

				if (fixedName !== instanceName) {

					console.warn(
						'[DEPRECATED] Remove trailing "d" from "%s" in your initiator config',
						instanceName
					);
				}

				throw e;

			}
		}

		return instanceClass;

	},

	common: common
};
