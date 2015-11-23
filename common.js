var util = require ('util');

var confFu = require ('conf-fu');

Object.PLATFORM_NATIVE_TYPES = {
	// Buffer seems to be the only custom type in the Node core
	'Buffer': true
};

Object.lookUpCustomType = function (obj) {
	var name = obj && obj.constructor && obj.constructor.name;
	if (name && name in Object.PLATFORM_NATIVE_TYPES) {
		return name;
	}
};
/**
 * Get the type of any object.
 * Usage:
 *     Object.typeOf([ 1, 2, 3 ]);    // 'Array'
 *     Object.typeOf(null);           // 'Null'
 *     Object.typeOf(new Buffer('')); // 'Buffer'
 */
Object.typeOf = function (obj) {
	return Object.lookUpCustomType(obj) ||
		Object.prototype.toString.call(obj).slice(8, -1);
};

/**
 * Safe and universal type check.
 * Usage:
 *     Object.is('Number', 4);            // true
 *     Object.is('Undefined', undefined); // true
 */
Object.is = function (type, obj) {
	return type == Object.typeOf(obj);
};

var isEmpty = confFu.isEmpty;

if (!util.extend) {
util.extend = function extend () {
	var hasOwnProperty = Object.prototype.hasOwnProperty;

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
		if (!obj || !Object.is('Object', obj) || obj.nodeType || obj.setInterval)
			return false;
		var has_own_constructor = hasOwnProperty.call(obj, "constructor");
		var has_is_property_of_method;
		if (obj.constructor)
			has_is_property_of_method = hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf");
		// Not own constructor property must be Object
		if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
			return false;
		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		var last_key;
		for (var key in obj)
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
}

if (!util.shallowMerge) {
	util.shallowMerge = function (dest, src, filter) {
		Object.keys(src).forEach(function (key) {
			if ((!filter || -1 != filter.indexOf(key)) && null == dest[key]) {
				dest[key] = src[key];
			}
		});
		return dest;
	};
}

if (!util.clone) {
	util.clone = function(object) {

		var result;

		if (object.constructor === Array) {
			result = object.map(function(item) {
				return util.clone(item);
			});
		} else if (object.constructor === Object) {
			result = {};
			util.extend(result, object);
		} else {
			result = object;
		}

		return result;

	}
}

// overwrite subject with values from object (merge object with subject)
var mergeObjects = module.exports.mergeObjects = function (object, subjectParent, subjectKey) {
	// subject parent here for js's lack of pass by reference

	if (subjectParent[subjectKey] === void 0)
		subjectParent[subjectKey] = {};
	var subject = subjectParent[subjectKey];
	for (var objectField in object) {
		subject[objectField] = object[objectField];
	}
};

var getByPath = module.exports.getByPath = function (path, origin) {
	var value = origin;
	var scope, key;
	var validPath = path.split('.').every(function (prop) {
		scope = value;
		key = prop;
		if (null == scope) {
			// break
			return false;
		} else {
			value = scope[key];
			return true;
		}
	});
	return validPath && { value: value, scope: scope, key: key };
};

var pathToVal = module.exports.pathToVal = confFu.pathToVal;

String.prototype.interpolate = function (dict, marks) {
	if (!marks)
		marks = {};
	marks.start    = marks.start || '{';
	marks.end      = marks.end   || '}';
	marks.path     = marks.path  || '.';
	marks.typeSafe = marks.typeSafe || '$';
	marks.typeRaw  = marks.typeRaw  || '*';

	// TODO: escape character range delims
	var re = new RegExp([
		'[', marks.start, ']',
		'([', marks.typeSafe, marks.typeRaw, '])',
		'([^', marks.end, ']+)',
		'[', marks.end, ']'
	].join(''), 'g');

	var startRe = new RegExp([
		'[', marks.start, ']',
		'([', marks.typeSafe, marks.typeRaw, '])'
	].join(''), 'g');

	var values = [];

	var replacedStr = this.replace(re, function (_, varType, varPath) {
		if (varPath.indexOf(marks.path) > -1) {
			var value = pathToVal(dict, varPath);
		} else {
			value = dict[varPath];
		}

		if (isEmpty(value) && varType == marks.typeSafe) {
			value = undefined;
		}

		values.push(value);

		return value;
	});

	if (values.some(function (v) { return (typeof v === "undefined"); })) {
		return undefined;
	}

	if (values.length === 1 && (values[0] + '') === replacedStr) {
		return values[0];
	}

	return replacedStr;
};

/**
 * [waitAll wait all events to complete]
 * @param  {[type]}   events   array of event arrays: [[subject, eventName, description]]
 * @param  {Function} callback called after all events handled
 * @return {[type]}            [description]
 */
module.exports.waitAll = function waitAll (events, callback) {
	var remaining = [];
	function _listener (eventName) {
		remaining.some (function (remainingName, idx) {
			if (remainingName == eventName) {
				remaining.splice (idx, 1);
				return true;
			}
		})
		// console.log ("wait for " + remaining.length + " more: " + remaining.join (', '));
		if (!remaining.length)
			callback();
	}
	events.forEach (function (event) {
		var subject   = event[0];
		var eventName = event[1];
		var eventLogName = eventName + ' ' + event[2];
		remaining.push (eventLogName);
		if (typeof subject === "function") {
			subject (_listener.bind (dataflows.global (), eventLogName));
		} else {
			if (subject.addEventListener) {
				subject.addEventListener (eventName, _listener.bind (subject, eventLogName), false);
			} else {
				subject.on (eventName, _listener.bind (subject, eventLogName), false);
			}

		}

	});
}

function pad(n) {
	return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

function formattedDate (lowRes) {
	var time = [
		pad(lowRes.getHours()),
		pad(lowRes.getMinutes()),
		pad(lowRes.getSeconds())
	].join(':');
	var date = [
		lowRes.getFullYear(),
		pad(lowRes.getMonth() + 1),
		pad(lowRes.getDate())
	].join ('-');
	return [date, time].join(' ')
}


// one second low resolution timer
// test: http://jsperf.com/low-res-timer

function lowResTimer () {
	lowResTimer.refCount ++;
	//	console.log ('low res timer refcount++', lowResTimer.refCount);
	lowResTimer.dateString = formattedDate (
		lowResTimer.date = new Date ()
	);

	lowResTimer.interval = setInterval (function () {
		lowResTimer.dateString = formattedDate (
			lowResTimer.date = new Date ()
		);
	}, 10);
	// Probably bug in nodejs
	if (lowResTimer.interval.unref)
		lowResTimer.interval.unref();
}

lowResTimer.refCount = 0;

lowResTimer.free = function () {
	lowResTimer.refCount --;
	//	console.log ('low res timer refcount--', lowResTimer.refCount);
	if (lowResTimer.refCount < 1) {
		delete lowResTimer.date;
		delete lowResTimer.dateString;
		clearInterval (lowResTimer.interval);
	}
}

lowResTimer.getDateString = function () {
	return lowResTimer.dateString || formattedDate (new Date ());
}

lowResTimer.getDate = function () {
	return lowResTimer.date || new Date ();
}

module.exports.lowResTimer = lowResTimer;

module.exports.isEmpty = isEmpty;
