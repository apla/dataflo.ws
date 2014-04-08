var dataflows = require('dataflo.ws');
var minimist  = require('minimist');

var log = dataflows.log;

module.exports = {
	launchContext: function () {
		return {
			token:    process.argv[3],
			param:    process.argv[4],
			args:     minimist(process.argv.slice(4))
		};
	},
	launchAnyway: function (conf) {
		console.log (log.dataflows ('is cli for projects, based on dataflo.ws framework'));
		console.log ('available commands:');
		console.log ("\t", log.path ('init [dir]'), "\t", 'initialize dataflo.ws project');
		console.log ("\t", log.path ('daemon [name]'), "\t", 'run preconfigured daemon');
		console.log ("\t", log.path ('flow name'), "\t", 'run flow from initiator', log.path ('callback'));
		console.log ("\t", log.path ('test'), "\t", '(internal) run release tests for dataflo.ws');
		console.log ("\t", log.path ('test'), "\t", '(internal) run release tests for dataflo.ws');
	}
}
