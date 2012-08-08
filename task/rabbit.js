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
			routingKey = self.routingKey,
			data = self.data;

		var connection = amqp.createConnection(
			{'url': url},
			{'defaultExchangeName': defaultExchangeName}
		);

		connection.on('ready', function () {
			var exchange = connection.exchange(
				exchangeName,
                {type: 'topic',passive: true},
                function (exchange) {
                        // Exchange is open and ready
                        exchange.publish(routingKey, data);
                }
			);
			self.completed({
				ok: true,
				msg: 'Message sent'
			});
		});
		
		/*connection.on('drain', function(){
			connection.end();
		});*/
		
		connection.on('error', function(e){
			console.log('connection.error ' + e, e.stack);
			self.failed({
				ok: false,
				msg: 'Rabbit connection error!'
			});
		});
	}
});
