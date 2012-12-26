var FS     = require('fs');
var Path   = require('path');

var io = module.exports = function (path) {

	this.path = path;

	// TODO: define setter for path

	this.name = Path.basename (path);

	this.extension = Path.extname (path).substr (1);

}

io.prototype.isFile = function () {
	return this.stats ? this.stats.isFile () : null;
};

io.prototype.isDirectory = function () {
	return this.stats ? this.stats.isDirectory () : null;
}

io.prototype.file_io = function () {
	var p = this.path;
	for (var i = 0; i < arguments.length; i++) {
		p = Path.join (p, arguments[i]);
	}
	return new io (p);
}

io.prototype.chmod = function (mode, cb) {
	var p = this.path;
	FS.chmod (p, mode, function (err) {
		cb (err);
	});
}


io.prototype.writeStream = function (options) {
	return FS.createWriteStream (this.path, options);
}

io.prototype.readStream = function (options, cb) {

	if (arguments.length == 1)
		cb = arguments[0];

	var self = this;

	this.stat (function (err, stats) {

		var readStream = null;

		if (!err && stats.isFile()) {
			readStream = FS.createReadStream (this.path, options);
			readStream.pause();
		}

		cb.call (self, readStream, stats);
	});
}

io.prototype.scanTree = function (cb) {
	var self = this;

	FS.readdir (this.path, function (err, files) {
		// console.log (err, files);
		for (var i = 0; i < files.length; i++) {

			var f = files[i] = new io (Path.join (self.path, files[i]));

			f.stat (self.scanSubTree, cb);
		}
	});
}

io.prototype.scanSubTree = function (err, stats, cb) {
	var scanFurther = 0;
	if (cb)
		scanFurther = cb (this);
//		console.log (scanFurther, this.isDirectory ());
	if (scanFurther && this.isDirectory ())
		this.scanTree (cb);
}

io.prototype.stat = function (cb) {
	var self = this;

	var a = arguments;
	FS.stat (this.path, function (err, stats) {
		self.stats = stats;
//			console.log (self.path);
		if (cb)
			cb.call (self, err, stats, a[1]);
	});
}

io.prototype.parent = function () {
	return new io (Path.dirname (this.path));
}

io.prototype.fileIO = function (path) {
	return new io (Path.join (this.path, path instanceof io ? path.path : path));
}

io.prototype.readFile = function (cb) {
	var self = this;
	FS.readFile(this.path, function (err, data) {
		cb.call (self, err, data);
	});
}

io.prototype.writeFile = function (data, cb) {
	var self = this;
	FS.writeFile(this.path, data, function (err) {
		if (cb)
			cb.call (self, err);
	});
}
