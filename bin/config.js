var dataflows = require('dataflo.ws');
var minimist  = require('minimist');
var fs        = require('fs');

var log = dataflows.log;

module.exports = {
	launchContext: function () {
		return {
			method:   process.argv[3],
			varPath:  process.argv[4],
			value:    process.argv[5]
		};
	},
	setAnyway: function (conf, project) {
		var context = this.launchContext();
		var pathChunks = [];
		if (!project.instance) {
			console.log ('instance is undefined, please run', log.dataflows('init'));
			process.kill ();
		}
		var root = project.fixupConfig;
		context.varPath.split ('.').forEach (function (chunk, index, chunks) {
			pathChunks[index] = chunk;
			var newRoot = root[chunk];
			if (!newRoot) {
				root[chunk] = {};
				newRoot = root[chunk];
			}
			if (index == chunks.length - 1) {
				root[chunk] = context.value;
			}
			root = newRoot;
		});

		fs.writeFileSync (
			project.fixupFile,
			"// json\n" + JSON.stringify (project.fixupConfig, null, "\t")
		);
	},
	vars: function (conf, project) {
		for (var k in project.variables) {
			console.log (log.path (k), "\t", project.variables[k][1]);
		}

	}
}
