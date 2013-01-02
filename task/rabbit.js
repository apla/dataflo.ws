var task = require('base'),
	util = require('util'),
	amqp = require('node-amqp/amqp'),
	rabbitManager = require('rabbit-manager/rabbit-manager');

var rabbitConfig = project.config.consumerConfig.rabbit,
	url = rabbitConfig.url,
	exchangeName = rabbitConfig.exchangeName;


var rabbit = module.exports = function (config) {
	this.init (config);
};

var OpenSockets = {};

util.inherits(rabbit, task);

util.extend(rabbit.prototype, {
	DESTROY_DELAY: 5,//* 60 * 1000,

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
		var self = this;
		var messages = this.data;

		var exchange = connection.exchange(
			exchangeName,
			{ type: 'direct', passive: false },
			function (exchange) {
				var publish = function (message) {
					exchange.publish(message.queue, message.data);
				};

				if (messages.forEach) {
					messages.forEach(publish);
				} else {
					publish(messages);
				}

				self.completed({
					ok: true,
					msg: 'Message sent'
				});
			}
		);
	},

	onSubscribeConnect: function (conn) {
		var self = this;
		var queueName = this.queueName;
		var socket = this.socket;

		console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->', queueName);

		var exchange = conn.exchange(
			exchangeName,
			{ type: 'direct' },
			function (exchange) {
				conn.queue(
					queueName,
					{ autoDelete: false },
					function (q) {
						q.bind(exchangeName, queueName);
						q.subscribe(
							self.onMessage.bind(self)
						).addCallback(function (ok) {
							var ctag = ok.consumerTag;
							self.addSocket(queueName, q, socket, ctag);

							self.completed({
								ok: true,
								msg: 'Subscribed to queue'
							});
						});
					}
				);
			}
		);
	},

	addSocket: function (queueName, q, socket, ctag) {
		OpenSockets[queueName] = OpenSockets[queueName] || [];
		OpenSockets[queueName].push({
			socket: socket,
			ctag: ctag
		});
		OpenSockets[queueName].queue = q;

		socket.on('disconnect', this.onSocketDisconnect.bind(this, socket));
	},

	onSocketDisconnect: function (socket) {
		var sockets = OpenSockets[this.queueName];
		var queue = sockets.queue;

		if (sockets) {
			sockets.forEach(function (obj, index) {
				if (obj.socket == socket) {
					queue.unsubscribe(obj.ctag);
					sockets.splice(index, 1);
				}
			});

			if (sockets.length == 0) {
				this.delayedDestroyQueue();
			}
		}
	},

	delayedDestroyQueue: function () {
		var self = this;
		var sockets = OpenSockets[this.queueName];

		if (!sockets) {
			return;
		}

		if (sockets.destroyTimeout) {
			clearTimeout(sockets.destroyTimeout);
		}

		sockets.destroyTimeout = setTimeout(function () {
			if (!sockets.length) {
				console.log(
					'DESTROY QUEUE DUE TIMEOUT %s',
					sockets.queue.name
				);

				sockets.queue.destroy();
				delete OpenSockets[self.queueName];
			}
		}, this.DESTROY_DELAY);

	},

	onMessage: function (message) {
		//console.log('onSubscribeConnect EMIT %o', message);

		var sockets = OpenSockets[this.queueName];
		sockets && sockets.forEach(function (obj) {
			obj.socket.emit('message', message);
		});
	}
});
