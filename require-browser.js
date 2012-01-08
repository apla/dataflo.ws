// usage:
/*
	<script src="require-browser.js"></script> <!-- sync loading -->
	<script>
		preloadAssets ();
	</script>
*/

var _required = {
	
};

define ('util', [], function () {
	var util = {};
	util.inherits = function (ctor, superCtor) {
		ctor.super_ = superCtor;
		ctor.prototype = Object.create (superCtor.prototype, {
			constructor: {
			value: ctor,
			enumerable: false,
			writable: true,
			configurable: true
		}});
	};

	util.extend = function extend () {
		// copy reference to target object
		var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;
		// Handle a deep copy situation
		if (typeof target === "boolean") {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		}
		// Handle case when target is a string or something (possible in deep copy)
		if (typeof target !== "object" && !typeof target === 'function')
			target = {};
		var isPlainObject = function(obj) {
			// Must be an Object.
			// Because of IE, we also have to check the presence of the constructor property.
			// Make sure that DOM nodes and window objects don't pass through, as well
			if (!obj || toString.call(obj) !== "[object Object]" || obj.nodeType || obj.setInterval)
				return false;
			var has_own_constructor = hasOwnProperty.call(obj, "constructor");
			var has_is_property_of_method = hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf");
			// Not own constructor property must be Object
			if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
				return false;
			// Own properties are enumerated firstly, so to speed up,
			// if last one is own, then all properties are own.
			var last_key;
			for (key in obj)
				last_key = key;
			return typeof last_key === "undefined" || hasOwnProperty.call(obj, last_key);
		};
		for (; i < length; i++) {
			// Only deal with non-null/undefined values
			if ((options = arguments[i]) !== null) {
				// Extend the base object
				for (name in options) {
					src = target[name];
					copy = options[name];
					// Prevent never-ending loop
					if (target === copy)
						continue;
					// Recurse if we're merging object literal values or arrays
					if (deep && copy && (isPlainObject(copy) || Array.isArray(copy))) {
						var clone = src && (isPlainObject(src) || Array.isArray(src)) ? src : Array.isArray(copy) ? [] : {};
						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);
						// Don't bring in undefined values
					} else if (typeof copy !== "undefined")
						target[name] = copy;
				}
			}
		}
		// Return the modified object
		return target;
	}
	return util;
});

define ('events', [], function () {
	var events = module.exports = {
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
	
	return events;
	
});


util = {};

module = {
	exports: {}
};

// here we preload js; module name must match local variable
function applyExportsX (o) {
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

function requireX (name) {
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
