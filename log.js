var color;

try {
	ansiColor = require("ansi-color").set;
	color = function (color) {
		var args = [].slice.apply (arguments);
		args.shift();
		var msg = args.join (' ');
		return ansiColor (msg, color);
	}
} catch (e) {
	color = function (color) {
		var args = [].slice.apply (arguments);
		args.shift();
		var msg = args.join (' ');
		return msg;
	}
} finally {
	'black red green yellow blue magenta cyan white'.split (' ').forEach (function (colorName) {
		color[colorName] = color.bind (color, colorName);
	});
}

var log = {};

log.c = log.color = color;

log.dataflows = log.c.yellow.bind (log.c, 'dataflows');
log.path   = log.c.cyan;
log.errMsg = color.bind (color, 'red+white_bg');

module.exports = log;