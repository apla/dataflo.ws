*dataflo.ws*: dataflow processing for node.js
=============================================

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
they do. `dataflo.ws` is an abstract async processing framework for
describing dataflows in simple configuration.

you can use a dataflow for description of programmatic dataflows. or
real life ones.

add DSL by your own taste.

concept
-------------------------------

this project concept is born combining [flow based paradigm](http://en.wikipedia.org/wiki/Flow-based_programming) and
[responsibility driven design](http://en.wikipedia.org/wiki/Responsibility-driven_design).

typically, the dataflo.ws is designed for usage in client-server applications.
an external system (client) makes request and an initiator receives this request.
after parsing request, an initiator makes decision which dataflow is responsible for
this type of request. when decision is made and a dataflow is found, an initiator starts
a dataflow. a dataflow is based on series of tasks. tasks have input parameters and
may have a response value. tasks don't talk one-to-one; instead, output
from a task is delivered to a dataflow (a controlling routine) via event data (a message);
input parameters provided by passing parameters from dataflow.

thus, tasks have [loose coupling](http://en.wikipedia.org/wiki/Coupling_(computer_science))
and can be [distributed](http://en.wikipedia.org/wiki/Distributed_data_flow).

tasks must be designed [functionally cohesed](http://en.wikipedia.org/wiki/Cohesion_(computer_science))
in mind, which leads to a good system design.

terms
------------------------------

### initiator ###

it's an entry point generator. every dataflow has one entry point
from one initiator.

for example, initiator can be a http daemon, an amqp listener,
a file system event (file changed), a process signal handler,
a timer or any other external thing.

### entry point ###

it's a trigger for a specific dataflow. each initiator has its own entry point
description.

for example, an entry point for a httpd daemon is an url. httpd may have a simple
url match config or a complex route configuration — you decide which initiator handles requests.

### dataflow ###

a set of tasks, which leads dataflow to success or fail

### task ###

a black processing cube.

every `task` has its own requirements. requirements can be an `entry point` data (for
example, a query string in case of httpd `initiator`) or another `task` data.
if requirements are met, the `task` starts execution. after execution the `task`
produces a dataset.

real life example
-------------------------------

you want to visit a conference. your company does all dirty bureaucratic work for you. but,
you must make some bureocratic things too.

1.   receive approval from your boss.
2.   wait for all the needed documents for the conference (foreign visa, travel tickets,
hotel booking, the conference fee pay)
3.   get travel allowance
4.   visit the conference and make a report for finance department (a hotel invoice,
airline tickets, a taxi receipt and so on)
5.   make a presentation about the conference

then tasks look like:

	conferenceRequest   (
		conferenceInfo
	) -> approve

after approval we can book a hotel

	hotelBookingRequest (
		approve
	) -> hotelBooking

documents for visa must already contain conference info and booking

	visaRequest (
		approve, conferenceInfo, hotelBooking
	) -> visa

we pay for the conference and tickets after the visa is received

	conferenceFeePay (
		approve, visa
	) -> conferenceFee

	ticketsPay (
		approve, visa
	) -> tickets



synopsis
-------------------------------


	var httpd  = require ('initiator/http');

	var httpdConfig = {
		"dataflows": [{
			"url": "/save",
			"tasks": [{
				"$class": "post",
				"request": "{$request}",
				$set: "data.body"
			}, {
				"$class": "render",
				"type": "json",
				"data": "{$data.body}",
				"output": "{$response}"
			}]
		}, {
			"url": "/entity/tickets/list.json",
			"tasks": [{
				"$class":  "mongoRequest",
				"connector":  "mongo",
				"collection": "messages",
				$set:    "data.filter"
			}, {
				"$class": "render",
				"type": "json",
				"data": "{$data.filter}",
				"output": "{$response}"
			}]
		}]
	};

	var initiator = new httpd (httpdConfig);



implementation details
-----------------------

### initiator ###

an initiator makes a request object, which contains all basic info about particular request. the basic info doesn't mean you received all the data, but everything required to complete the request data.

example: using a httpd initiator, you receive all GET data i.e. a query string, but in case of a POST request, you'll need to receive all the POST data by yourself (using a task within a dataflow)

### task ###

every task has its own state and requirements. all task states:

*   scarce - the task is in initial state; not enough data to fulfill requirements
*   ready - task is ready to run (when all task requirements are met)
*   running - a dataflow has decided to launch this task
*   idle - not implemented
*   completed - the task completed without errors
*   error - the task completed with errors
*   skipped - the task is skipped, because another execution branch is selected (see below)
*   exception - somewhere exception was thrown


### flow ###

the flow module checks for task requirements and switches task state to `ready`.
if any  running slots are available, the flow starts task exectution.


how to write your own task
--------------------------

assume we have a task for checking file stats

first of all, we need to load a task base class along with fs node module:

	var task         = require ('task/base'),
		fs           = require ('fs');

next, we need to write a constructor of our class. a constructor receives all
of task parameters and must call this.init (config) after all preparations.

	var statTask = module.exports = function (config) {
		this.path = config.path;
		this.init (config);
	};

next, we inherit task base class and add some methods to our stat class:

	util.inherits (statTask, task);

	util.extend (statTask.prototype, {

		run: function () {

			var self = this;

			fs.stat (self.path, function (err, stats) {
				if (err) {
					self.emit ('warn', 'stat error for: ' + self.path);
					self.failed (err);
					return;
				}

				self.emit ('log', 'stat done for: ' + self.path);
				self.completed (stats);
			})
		}

	});

in code above i've used these methods:

*   emit - emits message to subscriber
*   failed - a method for indication of the failed task
*   completed - marks the task as completed successfully


see also
---------------------------

[http://docs.constructibl.es/specs/js/]



license
---------------------------

[MIT License](http://opensource.org/licenses/mit-license.html)
