var task         = require ('task/base'),
	util         = require ('util');

var cookieRender = module.exports = function (config) {

	this.init (config);

};

util.inherits (cookieRender, task);

util.extend (cookieRender.prototype, {

	run: function () {

		var self = this;

		self.output.statusCode = 303;
		self.output.setHeader('Location', self.url);
		self.output.end('Redirecting to ' + self.url);

		self.completed ();
	}

});
