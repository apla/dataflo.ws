context is missing when retry and timeout

2015-05-07 01:38:01 (772429>327245)  2 fs.rename (1) started
2015-05-07 01:38:01 (772429>327245)  2 fs.rename (5)  error:  [ReferenceError: src is not defined] at util.extend.rename (c:\work\kiosk\nodejs\node_modules\dataflo.ws\task\fs.js:154:27)
2015-05-07 01:38:01 (772429>327245)  2 fs.rename (1)  canceled, retries = 2

ReferenceError: src is not defined
    at util.extend.rename (c:\work\kiosk\nodejs\node_modules\dataflo.ws\task\fs.js:154:27)
    at Timer.listOnTimeout [as ontimeout] (timers.js:112:15)
	
	