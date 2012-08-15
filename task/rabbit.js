var task = require('task/base'),
	util = require('util'),
	amqp = require('node-amqp/amqp'),
	rabbitManager = require('rabbit-manager/rabbit-manager');

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
		rabbitManager.getOrCreate(
			rabbitConfig,
			this.onPublishConnect.bind(this),
			this.onError.bind(this)
		);
	},
	
	subscribe: function () {
		rabbitManager.getOrCreate(
			rabbitConfig,
			this.onSubscribeConnect.bind(this),
			this.onError.bind(this)
		);
	},
	
	onError: function (connection) {
		console.log('rabbit connection.error');
		this.failed({
			ok: false,
			msg: 'Rabbit connection error!'
		});
	},
	
	onPublishConnect: function (connection) {
		var messages = this.data;
		var exchange = connection.exchange(
			exchangeName,
			{ type: 'topic', passive: false },
			function (exchange) {
				messages.forEach(function (message) {
					exchange.publish(
						message.queue,
						message.data
					);
				});
			}
		);

		this.completed({
			ok: true,
			msg: 'Message sent'
		});
	},
	
	onSubscribeConnect: function (conn) {
		var self = this;
		var queueName = this.queueName;

		console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->', queueName);

		var exchange = conn.exchange(
			exchangeName,
			{type: 'topic'},
			function (exchange) {
				conn.queue(
					queueName,
					{ durable: true },
					function (q) {
						q.bind(exchangeName, queueName);
						q.subscribe(
							{ ack: false },
							self.onMessage.bind(self)
						);
					}
				);
			}
		);
		
		this.completed({
			ok: true,
			msg: 'Subscribed to queue'
		});

	},
	
	onMessage: function (message) {
		console.log(
			'onSubscribeConnect EMIT ------>',
			message
		);

		this.socket.emit('message', message);

		this.completed({
			ok: true,
			msg: message
		});
	}
});
