var define;
if (typeof define === "undefined") {
	define = function (classInstance) {
		classInstance (require, exports, module);
	};
}

define (function (require, exports, module) {

	var MODULE_NAME = 'dataflo.ws';
	var INITIATOR_PATH = 'initiator';

	var common = require ('./common'),
		color  = {};

	color.error     = function (message) {return message}
	color.path      = function (message) {return message}
	color.dataflows = function (message) {return message}

	function DF () {

	}

	module.exports = DF;

	DF.registry = {};

	DF.common = common;
	DF.color  = color;

	DF.browserPlatform = true;
	DF.cordovaPlatform = (typeof window !== "undefined") && (window.PhoneGap || window.Cordova || window.cordova) && true;

//	var flow  = require ('./flow');
//	DF.flow   = flow;

	DF.main = function () {
		return window;
	}

	DF.global = function () {
		return window;
	}

	DF.instanceTypes = [ 'initiator', 'task' ];

	function registryLookup (instanceType, instanceName) {
		var instanceClass = DF.registry[instanceType] &&
			DF.registry[instanceType][instanceName];

//			console.error (
//				'you need to run dataflows.register ("'
//				+instanceType+'", "'+instanceName
//				+'", instance) before using this task'
//			);

		var error;
		if (!instanceClass) {
			error = new Error ("instance class not found for " + [instanceType, instanceName].join ("/"));
			throw error;
		}

		return instanceClass;
	}

	DF.instanceTypes.forEach (function (instanceType) {
		DF.registry[instanceType] = {};
		DF[instanceType] = function (instanceName) {
			return registryLookup (instanceType, instanceName);
		};
	});

	/**
	* Register base entities for dataflo.ws processing.
	*/
	DF.register = function (instanceType, instanceName, instanceClass) {
		if (!DF.registry[instanceType]) {
			console.warn(
				'Unexpected instance type. Predefined types is: ['+instanceTypes.join(', ')+']'
			);
			return;
		}

		DF.registry[instanceType][instanceName] = instanceClass;
	};

});
