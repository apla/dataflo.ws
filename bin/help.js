var dataflows = require('dataflo.ws');
var minimist  = require('commop/lib/minimist');

var paint = dataflows.color;

module.exports = {
	launchContext: function () {
		return {
			token:    process.argv[3],
			param:    process.argv[4],
			args:     minimist(process.argv.slice(4))
		};
	},
	launchAnyway: function (conf) {
		console.log (paint.dataflows ('is cli for projects, based on dataflo.ws framework'));
		console.log ('available commands:');
		console.log ("\t", paint.path ('init [dir]'), "\t", 'initialize dataflo.ws project');
		console.log ("\t", paint.path ('daemon [name]'), "\t", 'run preconfigured daemon');
		console.log ("\t", paint.path ('flow name'), "\t", 'run flow from initiator', paint.path ('callback'));
		console.log ("\t", paint.path ('test'), "\t\t", '(internal) run release tests for dataflo.ws');
	}
}
