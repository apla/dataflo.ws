var repl   = require("repl");
var common = require ("./common");

repl.start({
  prompt: "node via stdin> ",
  input: process.stdin,
  output: process.stdout
}).context.project = global.project;
