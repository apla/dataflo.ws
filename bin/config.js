var dataflows = require('dataflo.ws');
var minimist  = require('minimist');

var log = dataflows.log;

module.exports = {
	launchContext: function () {
		return {
			method:   process.argv[3]
		};
	},
	launchAnyway: function (conf, project) {

	},
	setAnyway: function (conf, project, callerContext) {
		var context = callerContext || this.launchContext();
		var fixupVars = {};
		this.args._.shift();
		this.args._.forEach (function (item, idx, arr) {
			if (idx % 2)
				return;
			fixupVars[item] = [arr[idx + 1]];
		});
		// console.log (fixupVars);
		// fixupVars[context.varPath] = [context.value];
		project.setVariables (fixupVars, true);
	},
	varsAnyway: function (conf, project) {
		for (var k in project.variables) {
			console.log (log.path (k), "\t", project.variables[k][1]);
		}
		for (k in project.placeholders) {
			console.log (log.path (k), "\t", project.placeholders[k][1]);
		}
	},
	dumpAnyway: function (conf, project) {
		console.log (conf);
	}
}
