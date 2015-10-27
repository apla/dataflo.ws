var util    = require ('util');
var uColors = util.inspect.colors;

var isNode = typeof process !== 'undefined'; // && process.argv[0].lastIndexOf ("node") === process.argv[0].length - 4)

function color () {
	var args = [].slice.apply (arguments);
	var colorNames = args.shift();
	var str = args.join (' ');

	if (!isNode)
		return str;
	if (!colorNames)
		return str;

	var color_attrs = colorNames.constructor === Array ? colorNames : colorNames.split("+");
	var strPrefix = "", strPostfix = "";
	for (var i = 0, attr; attr = color_attrs[i]; i++) {
		strPrefix  += "\033[" + uColors[attr][0] + "m";
		strPostfix += "\033[" + uColors[attr][1] + "m";
	}
	var ansi_str = strPrefix + str + strPostfix;

	return ansi_str;
}

for (var colorName in uColors) {
	// real colors like black and red have 39 as second array element
	if (uColors[colorName][1] === 39) {
		if (isNode) {
			uColors[colorName+'_bg'] = [uColors[colorName][0] + 10, 49];
		}
	}
	color[colorName] = color.bind (color, colorName);
}

module.exports = color;
