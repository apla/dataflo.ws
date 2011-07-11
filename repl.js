var repl = require("repl"),
	common = require ("common");

repl.start().context.project = global.project;
