var dataflows = require('dataflo.ws');
var minimist  = require('minimist');

var log = dataflows.log;

module.exports = {
	launchContext: function () {
		return {
			method:   process.argv[3],
			varPath:  process.argv[4],
			value:    process.argv[5]
		};
	},
	launchAnyway: function (conf, project) {

	},
	setAnyway: function (conf, project, callerContext) {
		var context = callerContext || this.launchContext();
		var fixupVars = {};
		fixupVars[context.varPath] = context.value;
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
