var util   = require ('util');
var common = require ('./common');

var addedColors = {
	"black_bg": 40,
	"red_bg": 41,
	"green_bg": 42,
	"yellow_bg": 43,
	"blue_bg": 44,
	"magenta_bg": 45,
	"cyan_bg": 46,
	"white_bg": 47
};

for (var colorAdd in addedColors) {
	util.inspect.colors[colorAdd] = [addedColors[colorAdd], 0];
}

function color (color) {
	if (!color || $isClientSide)
		return str;
	var color_attrs = color.split("+");
	var ansi_str = "";
	for (var i=0, attr; attr = color_attrs[i]; i++) {
		ansi_str += "\033[" + util.inspect.colors[attr][0] + "m";
	}

	var args = [].slice.apply (arguments);
	args.shift();
	var str = args.join (' ');

	ansi_str += str + "\033[" + 0 + "m";
	return ansi_str;
}

'black red green yellow blue magenta cyan white'.split (' ').forEach (function (colorName) {
	color[colorName] = color.bind (color, colorName);
});

var log = {};

log.c = log.color = color;

log.dataflows = log.c.yellow.bind (log.c, 'dataflows');
log.path   = log.c.cyan;
log.errMsg = color.bind (color, 'red+white_bg');

module.exports = log;