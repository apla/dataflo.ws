#!/usr/bin/env node

var MODULE_NAME = 'dataflo.ws';
var INITIATOR_PATH = 'initiator';
var DEFAULT_REQUIRE = 'main';

var dataflows = require('../');
var common    = dataflows.common;
var paint     = dataflows.color;

var path      = require('path');

var minimist  = require ('commop/lib/minimist');

var $global   = dataflows.global ();

var Project = require (MODULE_NAME + '/project');

var project;

common.getProject = function (rootPath) {
	if (!project) {
		project = new Project (rootPath);
	}
	return project;
};

$global.project = common.getProject(); // used by initiators

function launchScript (conf, err) {
	var scriptName = process.argv[2];

	if (!scriptName)
		scriptName = "help";

	if (err) {
		if (err === "no project config" && !scriptName.match (/^(help|init)$/)) {
			console.error (
				'no', paint.dataflows(),
				'project config found. please run',
				paint.path ('dataflows help'), 'or', paint.path ('dataflows init')
			);
		}
		if (conf && scriptName !== "config") {
			conf = null;
		}
	}

	var scriptClass;
	try {
		scriptClass = require (project.root.fileIO ('bin', scriptName).path);
	} catch (e) {
		try {
			// console.log (path.join (MODULE_NAME, 'script', scriptName));
			scriptClass = require (path.join (MODULE_NAME, 'bin', scriptName));
		} catch (e) {
			console.error (e);
		}
	}

	if (!scriptClass) {
		// TODO: list all available scripts with descriptions
		console.error('sorry, there is no such script "%s"', scriptName);
		process.exit();
	}

	var scriptMethod = 'launch';
	var launchContext;

	if (typeof scriptClass.launchContext === 'function') {
		launchContext = scriptClass.launchContext() || {};
		if (launchContext.method) {
			scriptMethod = launchContext.method;
		}
	}

	scriptClass.command = launchContext.command || process.argv[2];
	scriptClass.args    = launchContext.args || minimist(process.argv.slice(3));

	// scriptClass.args =

	if (!err && typeof scriptClass[scriptMethod] === 'function') {
		scriptClass[scriptMethod](conf, project);
	} else if (typeof scriptClass[scriptMethod + 'Anyway'] === 'function') {
		scriptClass[scriptMethod + 'Anyway'](conf, project);
	} else {
		console.error(
			'missing method "%s" for script "%s"',
			scriptMethod, scriptName
		);
		process.exit();
	}

}

var mainModule = dataflows.main ();

project.on ('ready', function () {
	var conf = project.config;

	// load local modules
	var requires = conf.requires || [ DEFAULT_REQUIRE ];
	if (!Object.is('Array', requires)) {
		requires = [ requires ];
	}

	requires.forEach(function (modName) {
		var mod = project.require (modName, true);

		// exporting everything to mainModule,
		// be careful about name conflicts
		if (mod) {
			Object.keys(mod).forEach(function (key) {
				mainModule[key] = mod[key];
			});
		} else {
			// console.warn('Module %s not found', modName);
		}
	});

	// now we can launch script;
	// script require postponed until project get prepared

	launchScript(conf);
});

project.on ('failed', function (err) {
	// if (err === 'unpopulated variables')
	// 	return;
	// now we can launch script;
	// script require postponed until project get prepared

	launchScript (project.config, err);
});

