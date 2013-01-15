var path = require('path');
var fs = require('fs');

var directories = [ 'initiator', 'task' ];

/**
 * Makes symlinks from modules to base dataflo.ws directory.
 */
module.exports = function (moduleName) {
	var baseDir = path.dirname(require.resolve('dataflo.ws'));
	var nodePath = path.dirname(baseDir);
	var moduleDir = path.join(nodePath, moduleName);

	directories.forEach(function (dir) {
		var srcDir = path.join(moduleDir, dir);
		var destDir = path.join(baseDir, dir);

		if (fs.existsSync(srcDir)) {
			var files = fs.readdirSync(srcDir);
			files.forEach(function (fileName) {
				var srcPath = path.join(srcDir, fileName);
				var destPath = path.join(destDir, fileName);
				fs.symlinkSync(srcPath, destPath);
			});
		}
	});
};
