var repl   = require("repl");
var common = require ("./common");

repl.start({
  input: process.stdin,
  output: process.stdout
}).context.project = global.project;
