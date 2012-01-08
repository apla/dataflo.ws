// usage:
/*
	<script src="require-browser.js"></script> <!-- sync loading -->
	<script>
		preloadAssets ();
	</script>
*/

var _required = {
	
};

events = {
	EventEmitter: function () {}
};

// move to event emitter
events.EventEmitter.prototype.on = function (type, cb) {
	if (!this.cb)
		this.cb = {};
	if (!this.cb[type])
		this.cb[type] = [];
	
	this.cb[type].push (cb);
}

// TODO: add un method

events.EventEmitter.prototype.emit = function (type) {
	if (!this.cb)
		return;
	if (!this.cb[type])
		return;
	
	var args = Array.prototype.slice.call(arguments);
	
	args.shift ();
	
	var self = this;
	
	this.cb[type].map (function (item) {
		item.apply (self, args)
	});
}

util = {};

module = {
	exports: {}
};

// here we preload js; module name must match local variable
function applyExports (o) {
	var modulePath = o.src.match (/(.*)\.js/)[1];
//	console.log (modulePath);

//	console.log (document.scripts[document.scripts.length - 1]);
	
	if (typeof module.exports == 'function') {
		
		_required[modulePath] = module.exports;
	} else {
		_required[modulePath] = {};
		for (var k in module.exports) {
			_required[modulePath][k] = module.exports[k];
		}
	}
	module.exports = {};
//	console.log (_required[modulePath]);
}

function require (name) {
	var script = name + '.js';
	// allow emulated things
	if (window[name]) {
		return window[name];
	}
	
	var currentHtmlDir = document.location.href.match (/(.*)\/.*/)[1];
	var currentScriptDir = currentHtmlDir;
	var workflowDir = currentHtmlDir;
	
	if (document.scripts[document.scripts.length - 1].src) {
		var currentScriptDir = document.scripts[document.scripts.length - 1].src.match (/(.*)\/.*/)[1];
	}

	if (window.workflowRelPath) {
		workflowDir += '/' + window.workflowRelPath;
	}
	
	if (_required[encodeURI (currentScriptDir + '/' + name)]) {
		return _required[encodeURI (currentScriptDir + '/' + name)];
	} else if (_required[encodeURI (currentHtmlDir + '/' + name)]) {
		return _required[encodeURI (currentHtmlDir + '/' + name)];
	} else if (_required[encodeURI (workflowDir + '/' + name)]) {
		return _required[encodeURI (workflowDir + '/' + name)];
	} else {
		console.warn ('module not found and \"' + name + '(' + currentScriptDir + '/' + name + ')\" not loaded at '+ document.scripts[document.scripts.length - 1].src);
	}
	
}
