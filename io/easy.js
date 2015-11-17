var FS     = require('fs');
var Path   = require('path');

var io = module.exports = function () {

	// https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#32-leaking-arguments
	var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}

	// arguments can be mix from io objects and strings
	var lastArg = args[args.length - 1];
	if (args.length > 1 && !(typeof lastArg === "string" || lastArg instanceof String)) {
		this.options = args.pop ();
	} else {
		this.options = {};
	}

	//	console.log (process.cwd (), Path.resolve (process.cwd ()));
	this.options.anchorDir = this.options.anchorDir || Path.resolve (process.cwd ());
	this.setAnchorDir (this.options.anchorDir);

	this.path = Path.join.apply (Path, args.map (function (arg) {
		return arg.path ? arg.path : arg
	}));

	//	console.log (path);

	// TODO: define setter for path

	this.name = Path.basename (this.path);

	this.extname   = Path.extname (this.path);
	this.extension = this.extname.substr (1);

	this.onlyName = Path.basename (this.name, this.extname);
};

// this function is needed when you want to get io object or undefined
io.safe = (function() {
	function F(args) {
		try {
			return io.apply (this, args);
		} catch (e) {
			return {error: true};
		}
	}

	F.prototype = io.prototype;

	return function () {
		var o = new F (arguments);
		if ('error' in o) {
			return;
		} else {
			return o;
		}
	}
})();

io.prototype.relative = function (relPath) {
	return Path.relative (this.path, relPath instanceof io ? relPath.path : relPath);
};

io.prototype.setAnchorDir = function (relPath) {
	this.shortPath = function () {
		var relative = Path.relative (relPath instanceof io ? relPath.path : relPath, this.path);
		var absolute = Path.resolve (this.path);
		if (relative.length < absolute.length && !relative.match (/^\.\./)) {
			return relative;
		} else {
			return absolute;
		}
	}
};


io.prototype.shortPath = function (relPath) {
	return Path.relative (this.path, relPath instanceof io ? relPath.path : relPath);
};


io.prototype.unlink = function (cb) {
	fs.unlink(relPath.path | relPath, cb);
}

io.prototype.isFile = function () {
	return this.stats ? this.stats.isFile () : null;
};

io.prototype.isDirectory = function () {
	return this.stats ? this.stats.isDirectory () : null;
};

io.prototype.fileIO = io.prototype.file_io = function () {
	var path = Path.join.apply(Path, arguments);
	return new io(Path.resolve(this.path, path));
};

io.prototype.chmod = function (mode, cb) {
	var p = this.path;
	FS.chmod (p, mode, function (err) {
		cb (err);
	});
};

io.prototype.mkdir = function (mode, callback) {
	if ("function" === typeof mode && callback === undefined) {
		callback = mode;
		mode = 0777; // node defaults
	}
	return FS.mkdir (this.path, mode, callback);
};

io.prototype.mkpath = function (path, mode, callback) {
	if ("function" === typeof mode && callback === undefined) {
		callback = mode;
		mode = 0777; // node defaults
	}

	if (!path) {
		if (callback) callback ();
		return;
	}

	var self = this;

	var pathChunks = path.split (Path.sep);
	var currentPathChunk = pathChunks.shift ();
	FS.mkdir (Path.join (this.path, currentPathChunk), mode, function (err) {
		if (err && err.code !== 'EEXIST') {
			if (callback) callback (err);
			return;
		}
		if (pathChunks.length === 0) {
			if (callback) callback ();
			return;
		}
		var children = self.fileIO (currentPathChunk);
		children.mkpath (Path.join.apply (Path, pathChunks), mode, callback);
	});
};


io.prototype.writeStream = function (options) {
	return FS.createWriteStream (this.path, options);
};

io.prototype.readStream = function (options, cb) {

	if (arguments.length == 1)
		cb = arguments[0];

	var self = this;

	this.stat (function (err, stats) {

		var readStream = null;

		if (!err && stats.isFile()) {
			readStream = FS.createReadStream (self.path, options);
			readStream.pause();
		}

		cb (readStream, stats);
	});
};

io.prototype.scanTree = function (cb) {
	var self = this;

	FS.readdir (this.path, function (err, files) {
		// console.log (err, files);
		for (var i = 0; i < files.length; i++) {

			var f = files[i] = new io (Path.join (self.path, files[i]));

			f.stat (self.scanSubTree, cb);
		}
	});
};

io.prototype.findUp = function (fileName, cb) {
	var self = this;

	if (!cb || cb.constructor != Function)
		return;

	var fileIO = this.fileIO (fileName);
	fileIO.stat (function (err, stats) {
		if (!err) {
			cb (null, self, stats);
			return;
		}
		if (self.parent().path == self.path) {
			cb (true, self);
			return;
		}

		self.parent().findUp(fileName, cb);
	});
};

io.prototype.scanSubTree = function (err, stats, cb) {
	var scanFurther = 0;
	if (cb)
		scanFurther = cb (this);
	// console.log (scanFurther, this.isDirectory ());
	if (scanFurther && this.isDirectory ())
		this.scanTree (cb);
};

io.prototype.stat = function (cb) {
	var self = this;

	var a = arguments;
	FS.stat (this.path, function (err, stats) {
		self.stats = stats;
		// console.log (self.path);
		if (cb)
			cb (err, stats, a[1]);
	});
};

io.prototype.parent = function () {
	return new io (Path.dirname (this.path));
};

io.prototype.readFile = function (cb) {
	var self = this;
	FS.readFile(this.path, function (err, data) {
		cb (err, data);
	});
};

io.prototype.writeFile = function (data, cb) {
	var self = this;
	FS.writeFile (this.path + '.tmp', data, (function (err) {
		if (err) {
			// console.log ('CANNOT WRITE FILE', err);
			if (cb)
				cb (err);
			return;
		}
		FS.rename(this.path + '.tmp', this.path, function (err) {
			// if (err) console.log ('CANNOT RENAME FILE', err);
			if (cb)
				cb (err);
		});
	}).bind (this));
};
