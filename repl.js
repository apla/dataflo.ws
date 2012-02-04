var repl   = require("repl");
var common = require ("./common");

repl.start().context.project = global.project;
