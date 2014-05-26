Project configuration, dataflows-style
==========

Goals
----------

1. Easy to use
Common format, you can set up a location of configuration files. If you already have one, you do not need to change files location for each project, you can just point this location (set up environment) for all needed projects.

2. Scalable
Hierarchical, any section can live in a separate file, easy access to frequently changing sections.

3. Easy deployment
Configuration actually is splitted to the project configuration and instance fixup. You can have as many fixups as you want, not only development and production.

4. Persistent
Current configuration snapshot is always on disk and in vcs. No code allowed within configuration. Tools never change project config, only fixup allowed to change.

Those is not acceptable:

1. `require ('config.json')` — 1, 2, 3;
2. nconf - 4 (require code to load includes)
3. node-convict - 2 (no access to frequently chnging sections), 3 (no separation beween project config and instance fixup)
4. dotenv - 2, 4 (recommended not to commit config)
5. node-config - 1 (cannot change location), 4 (instance name not stored on disk)

Implementation
---------------

dataflows configuration is located within `.dataflows` directory in project root. Main configuration file named `project`, fixup directories located at same level as the `project` file.

1. `project` file is loaded and parsed. For now, only `json` format supported;
2. `project` contents is scanned against includes in form `"<include-file-name>"`;
3. when all includes is loaded, config tree is scanned for variables (`"<$config.path.variable>"`) and placeholders (`"<#please fix me>"`, `"<#optional:please fix me>"`, `"<#default:127.0.0.1>"`);
4. `fixup` file loaded and checked, whether all variables and placeholders fulfilled;
5. if resulting config is fulfilled, project emits `ready` event; otherwise, `error` event emitted.

Caveats
-----------

1. config format is guessed at launch
most popular config formats (json and xml) can be parsed automatically (json can be detected by first chars - `{[`, xml must contains `<?xml version encoding?>`), another formats can have comment with format description on first line ("; ini")

2. Configuration must be separated from dataflows project and have no external dependencies.

Environment variables to drive config (don't like it at all)
------------
PROJECT_ROOT absolute path
PROJECT_CONF (relative to project root, dir name to search for "project" file)
PROJECT_VAR  (relative to project root, dir name to search for "instance" file)
PROJECT_INSTANCE string
techdebt: if PROJECT_ROOT is file path, then assume to load `project` config from that file and treat parent directory as project root.
techdebt: if PROJECT_INSTANCE is file path, then assume to load `fixup` contents from that file.


Links
---------------
http://thejeffchao.com/blog/2013/09/26/an-alternative-node-dot-js-configuration-management-pattern/
http://metaduck.com/03-konphyg.html
https://github.com/mozilla/node-convict
https://github.com/scottmotte/dotenv
