var util    = require ('util');
var uColors = util.inspect.colors;

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
	if (!colorNames)
		return str;

	var color_attrs = colorNames.split("+");
	var strPrefix = "", strPostfix = "";
	for (var i = 0, attr; attr = color_attrs[i]; i++) {
		strPrefix  += "\033[" + uColors[attr][0] + "m";
		strPostfix += "\033[" + uColors[attr][1] + "m";
	}
	var ansi_str = strPrefix + str + strPostfix;

	return ansi_str;
}

var colorList = "black|red|green|yellow|blue|magenta|cyan|white";

colorList.split ('|').forEach (function (colorName) {
	if (isNode ()) {
		uColors[colorName+'_bg'] = [uColors[colorName][0] + 10, 49];
	}
	color[colorName] = color.bind (color, colorName);
});

module.exports = color;
