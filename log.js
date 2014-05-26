var util   = require ('util');

function isNode () {
	if (typeof process !== 'undefined' && process.argv[0] === "node")
		return true;
	return false;
}

function color () {
	var args = [].slice.apply (arguments);
	var colorNames = args.shift();
	var str = args.join (' ');
	
	if (!isNode())
		return str;
	if (!colorName)
		return str;
	
	var color_attrs = colorNames.split("+");
	var ansi_str = "";
	var strPrefix = "", strPostfix = "";
	for (var i=0, attr; attr = color_attrs[i]; i++) {
		 strPrefix  += "\033[" + util.inspect.colors[attr][0] + "m";
		 strPostfix += "\033[" + util.inspect.colors[attr][1] + "m";
	}
	var ansi_str = strPrefix + str + strPostfix;

	return ansi_str;
}

var colorList = "black|red|green|yellow|blue|magenta|cyan|white";

colorList.split ('|').forEach (function (colorName) {
	util.inspect.colors[colorName+'_bg'] = [util.inspect.colors[colorName][0] + 10, 49];
	color[colorName] = color.bind (color, colorName);
});

var log = {};

log.c = log.color = color;

module.exports = log;

log.dataflows = log.c.yellow.bind (log.c, 'dataflows');
log.path   = log.c.cyan;
log.errMsg = color.bind (color, 'red+white_bg');
