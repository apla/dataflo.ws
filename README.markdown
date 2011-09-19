workflow processing for node.js
===============================


abstract
-------------------------------

every application is based on series of workflows. if your workflow is written
in a program code, you have a problem. people don't want to screw up, but
they do. `workflow.nodejs` is an abstract async processing framework for
describing workflows in simple configuration.

you can use workflow for description of programmatic workflows. or
real life ones.

add DSL by your own taste.


terms
------------------------------

### initiator ###

it's an entry point generator. every workflow has one entry point
from one initiator.

for example, initiator can be a http daemon, an amqp listener,
a file system event (file changed), a process signal handler,
a timer or any other external thing.

### entry point ###

it's a trigger for specific workflow. each initiator has its own entry point
description.

for example, entry point for a httpd daemon is an url. httpd may have a simple
url match config or a complex route configuration — you decide which initiator
does handling requests.

### workflow ###

a set of tasks, which leads workflow to success or fail

### task ###

a black processing cube.

every `task` has its own requirements. requirements can be `entry point` data (for
example, query string in case of httpd `initiator`) or another `task` data.
if requirements satisfied, `task` start to execute. after execution `task`
produce dataset.

real life example
-------------------------------

you want to visit a conference. your company doing all dirty work for you. but,
you must make some bureocratic things.

1. receive an approve from your boss.
2. waiting all the needed documents for conference (foreign visa, travel tickets,
hotel booking, conference fee pay)
3. get an travel allowance
4. visit conference and make report for finance department (hotel invoice,
airline tickets, taxi receipt and so on)
5. make a presentation about conference

then tasks looks like:

	conferenceRequest   (
		conferenceInfo
	) -> approve

after approve we can book a hotel

	hotelBookingRequest (
		approve
	) -> hotelBooking

documents for visa must already contain conference info and booking

	visaRequest (
		approve, conferenceInfo, hotelBooking
	) -> visa

we pay for conference and tickets after visa has done

	conferenceFeePay (
		approve, visa
	) -> conferenceFee

	ticketsPay (
		approve, visa
	) -> tickets



synopsis
-------------------------------


	var httpdi  = require ('RIA/Initiator/HTTPD');

	var httpdiConfig = {
		"workflows": [{
			"url": "/save",
			"tasks": [{
				"className": "postTask",
				"request": "{$request}",
				"produce": "data.body"
			}, {
				"className": "renderTask",
				"type": "json",
				"data": "{$data.body}",
				"output": "{$response}"
			}]		
		}, {
			"url": "/entity/tickets/list.json",
			"tasks": [{
				"className":  "mongoRequestTask",
				"connector":  "mongo",
				"collection": "messages",
				"produce":    "data.filter"
			}, {
				"className": "renderTask",
				"type": "json",
				"data": "{$data.filter}",
				"output": "{$response}"
			}]
		}]
	};

	var initiator = new httpdi (httpdiConfig);


implementation details
-----------------------

### initiator ###

initiator make an request object, which contains all basic info about request. basic info means you didn't receive all the data, but you get everything to fetch complete request data.

example: using httpd initiator, you receive all GET data i.e. query string, but in case POST request, you'll need to receive all post data by yourself (using task within workflow)

### task ###

every task has its own state and requirements. all task states:
* scarce - starting task state
* ready - task ready to run (when all task requirements satisfied)
* running - workflow decided to launch this task
* idle - not implemented
* completed - task completed without errors
* error - task completed with errors
* skipped - task skipped, because other execution branch is selected (see below)

### workflow ### 

workflow check for task requirements and switch task state to ready. if any available running slots available, workflow start to run task.


how to write your own task
--------------------------