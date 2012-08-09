var task = require('task/base'),
	util = require('util'),
	amqp = require('node-amqp/amqp.js');

var rabbitConfig = project.config.consumerConfig.rabbit,
	url = rabbitConfig.url,
	exchangeName = rabbitConfig.exchangeName;


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
			data = self.data,
			mongoResponseSuccess = self.mongoResponse.success;
			
		if(mongoResponseSuccess) {
			var connection = amqp.createConnection(
				{'url': url},
				{'defaultExchangeName': exchangeName}
			);
			connection.on('error', function(e){
				console.log('rabbit connection.error ' + e, e.stack);
				self.failed({
					ok: false,
					msg: 'Rabbit connection error!'
				});
			});
			
			var tags = data.tags;
			var messages = [];
			tags.forEach(function(tag){
				if(tag.type == '@'){
					messages.push({
						"queue": tag._id,
						"data": data.content
					});
				}
			});
			
			connection.on('ready', function () {
				var exchange = connection.exchange(exchangeName,
					{type: 'topic',passive: false},
					function (exchange) {
							messages.forEach(function(message){
								exchange.publish(message.queue, {text:message.data});
							});
					}
				);
				//connection.publish(message.queue, message.data);
				self.completed({
					ok: true,
					msg: 'Message sent'
				});
			});
		} else {
			self.failed({
					ok: false,
					msg: 'mongoResponse failed!'
				});
		}
	}
});
