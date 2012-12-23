var
	/* Relies on npm calais module
	 *	must be modified as per lib/calais/lib/calais.js
	 */

	Calais = require('calais').Calais,
	task = require('task/base'),
	util = require('util');

// - - - static

var calais = new Calais('dcfzrqcmf9caj7ab7ssqrmke');

// - - -

var calaisTask = module.exports = function(config) {

	this.request = config.request;
	this.init (config);

};

util.inherits (calaisTask, task);

util.extend (calaisTask.prototype, {

	run: function() {

		var self = this;
		var content = self.content || '';
		var options = self.options;
		var req = self.request;
		var data = self.data;

		if (req.body.fields.content) content = req.body.fields.content;
		if (data && data.content) content = data.content;

		calais.set('content', content);
		calais.fetch(function(result) {
			self.completed(result);
		}, options);

	}

});