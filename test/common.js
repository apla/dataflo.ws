var functions = {
	dfThrowUnlessEqual: function () {
		var msg = arguments[2] || '';
		if (arguments[0] == arguments[1]) {
			console.log (msg, arguments[0], '==', arguments[1]);
			return arguments[0] || true;
		} else {
			console.error (msg, arguments[0], '==', arguments[1]);
			throw ('arguments not equal');
		}
	},
	dfThrowUnlessDefined: function () {
		if (typeof arguments[0] == "undefined")
			throw ('not defined');
	},
	dfThrowNow: function () {
		throw ('defined');
	},
	dfHandleGet: function (params) {
		// http server test:
		// 1) just request, check for User-Agent
		// 2) get request with query string
		// 3) post request
		if (params.cookieAndRedirect) {
			return true;
		}
		// if (checkCookie) {

		// }
	},
	dfGetPromise: function (delay, arg, result) {
		var ayepromise = require ("ayepromise");

		var defer = ayepromise.defer();
		setTimeout (function () {
			if (result) {
				defer.resolve (arg);
			} else {
				defer.reject (arg);
			}
		}, delay);
		return defer.promise;
	},
	dfErrback: function (delay, arg, result) {
		var cb = arguments[arguments.length - 1];
		setTimeout (function () {
			if (result) {
				cb (null, arg);
			} else {
				cb (arg);
			}
		}, delay);
	},
	dfDataObject: function () {
		return {a: ['b', 'c']};
	}
};

for (var fnName in functions) {
	require.main.exports[fnName] = functions[fnName];
}
