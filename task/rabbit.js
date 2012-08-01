var task = require('task/base'),
	util = require('util'),
	amqp = require('node-amqp/amqp.js');

var rabbitConfig = project.config.consumerConfig.rabbit,
	url = rabbitConfig.url,
	defaultExchangeName = rabbitConfig.defaultExchangeName;


var rabbit = module.exports = function (config) {
	this.init (config);	
};

util.inherits(rabbit, task);

util.extend(rabbit.prototype, {
	run: function () {
		this.failed('use method [publish|subsribe]');
	},

	publish: function () {
		var self = this,
			queue = self.queue,
			data = self.data;

		var connection = amqp.createConnection(
			{url: url},
			{defaultExchangeName: defaultExchangeName}
		);

		connection.on('ready', function () {
			connection.publish(queue, data);
			self.completed({
				ok: true,
				msg: 'Message sent'
			});
		});
		
		connection.on('drain', function(){
			connection.end();
		});
		
		connection.on('error', function(e){
			console.log('connection.error ' + e, e.stack);
			self.failed({
				ok: false,
				msg: 'Rabbit connection error!'
			});
		});
	}
});
