var task         = require ('./base'),
	util         = require ('util');

var redirect = module.exports = function (config) {

	this.init (config);

};

util.inherits (redirect, task);

util.extend (redirect.prototype, {

	run: function () {

		var self = this;

		self.output.statusCode = 303;
		self.output.setHeader('Location', self.url);
		// self.output.end('Redirecting to ' + self.url);

		self.completed ();
	}

});
