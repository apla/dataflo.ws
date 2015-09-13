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
		flow   = require ('./flow'),
		color  = {};

	color.error     = function (message) {return message}
	color.path      = function (message) {return message}
	color.dataflows = function (message) {return message}

	function DF () {

	}

	DF.registry = {};

	DF.common = common;
	DF.flow   = flow;
	DF.color  = color;

	DF.instanceTypes = [ 'initiator', 'task' ];

	function registryLookup (instanceType, instanceName) {
		var instanceClass = DF.registry[instanceType] &&
			DF.registry[instanceType][instanceName];

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

	module.exports = DF;

});
