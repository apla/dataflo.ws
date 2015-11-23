"use strict";

var path   = require ('path'),
	fs     = require ('fs'),
	os     = require ('os'),
	util   = require ('util'),
	common = require ('./common'),
	paint  = require ('paintbrush'),
	DF     = require ('./index'),
	io     = require ('fsobject'),
	confFu = require ('conf-fu');

var MODULE_NAME = 'dataflo.ws';
var INITIATOR_PATH = 'initiator';

paint.error     = paint.bind (paint, "red+white_bg");
paint.path      = paint.cyan.bind (paint);
paint.dataflows = paint.green.bind (paint, "dataflows");

function NodeDF () {

}

util.inherits (NodeDF, DF);

for (var staticFn in DF) {
	if (DF.hasOwnProperty(staticFn)) {
		NodeDF[staticFn] = DF[staticFn];
	}
}

NodeDF.color = DF.color = paint;

NodeDF.registry = DF.registry;

NodeDF.nodePlatform = true;

NodeDF.global = function () {return global;}

NodeDF.main = function () {return require.main.exports;}

DF.instanceTypes.forEach (function (instanceType) {
	// NodeDF.registry[instanceType] = {};
	NodeDF[instanceType] = function (instanceName) {
		return registryLookup (instanceType, instanceName);
	};
});

module.exports = NodeDF;

function registryLookup (instanceType, instanceName) {
	var instanceClass = DF.registry[instanceType] &&
		DF.registry[instanceType][instanceName];

	if (instanceClass) {
		return instanceClass;
	}

		var fixedName = instanceName;
		if (instanceType == 'initiator') {
			fixedName = instanceName.replace(/d$/, '');
			if (fixedName !== instanceName) {
				console.warn(
		'[DEPRECATED] Remove trailing "d" from "%s" in your initiator config',
					instanceName
				);
			}
		} else if (instanceType == 'task') {
			fixedName = instanceName.replace(/^(dataflo\.ws\/)?task\//, '');
			if (fixedName !== instanceName) {
				console.warn(
		'[DEPRECATED] Remove preceding "task/" from "%s" in your task config',
					instanceName
				);
			}
		}

	var project = global.project;
	var project_root;

	if (common.getProject)
		project = common.getProject();

	if (project)
		project_root = project.root;

	instanceClass = getModule (instanceType, fixedName, false, project_root);

	DF.registry[instanceType][instanceName] = instanceClass;

	return instanceClass;
};

var getModule = NodeDF.getModule = function (type, name, optional, root) {
	optional = optional || false;
	var mod;

	if (!root) {
		if (typeof project !== "undefined") {
			root = project.root;
		} else {
			root = new io ('./'); // path.dirname (require.main.filename)
		}
	}

	var paths = [
		path.join(['dataflows', type, name].join ('-')),
		path.join('dataflo.ws', type, name), // dataflo.ws => dataflows
	];

	if (name.match (/^\./)) {
		paths = [];
	 } else {
		if (root) {
			var rootPath = root.path ? root.path : root;
			paths.push (path.resolve (rootPath, 'node_modules', ['dataflows', type, name].join ('-')));
			paths.push (path.resolve (rootPath, 'node_modules', type, name));
			paths.push (path.resolve (rootPath, type, name));
		}
	}

	paths.push (name);

	var taskFound = paths.some (function (modPath) {
		try {
			mod = require(modPath);
			return true;
		} catch (e) {
			// assume format: Error: Cannot find module 'csv2array' {"code":"MODULE_NOT_FOUND"}
			if (e.toString().indexOf(name + '\'') > 0 && e.code == "MODULE_NOT_FOUND") {
				return false;
			} else {
				console.error (
					'requirement failed:',
					paint.error (e.toString()),
					root
						? "in " + paint.path (root.relative (modPath).match (/^\.\./) ? modPath : root.path)
						: ""
				);
				return true;
			}
		}
	});

	if (!mod && !optional)
		console.error ("module " + type + " " + name + " cannot be used, cwd: "+process.cwd() + ", paths: " + paths.join (", "));

	return mod;

}

