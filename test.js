var makeCounter = function (x) {
	return function () {
		return (x += 1);
	};
};

var counter = makeCounter(0);
