*dataflo.ws*: dataflow processing for javascript
=============================================

[![build](https://travis-ci.org/apla/dataflo.ws.svg)](https://travis-ci.org/apla/dataflo.ws)
[![NPM Version](http://img.shields.io/npm/v/dataflo.ws.svg?style=flat)](https://www.npmjs.org/package/dataflo.ws)
[![codecov.io](https://codecov.io/github/apla/dataflo.ws/coverage.svg?branch=master)](https://codecov.io/github/apla/dataflo.ws?branch=master)

example
-------------------------------

you can see a working example by running

	npm install -g dataflo.ws
	cd $NODE_PATH/dataflo.ws/example/yql/ # example project directory
	dataflows daemon yql

abstract
-------------------------------

every application is based on series of dataflows. if your dataflow is written
in a program code, you have a problem. people don't want to screw up, but
they do. `dataflo.ws` is an abstract async processing framework for describing
dataflows in simple configuration.

you can use a dataflow for description of programmatic dataflows. or real life ones.

add DSL by your own taste.

quick start
-------------------------------

install dataflows:

`npm install -g dataflo.ws`

create dataflows project

```
DFPROJECT=my-project-name
mkdir $DFPROJECT
cd $DFPROJECT
dataflows init
```

create an dataflows script

`dataflows create script my-script-name`

create a dataflows task class

`dataflows create class my-class-name`

