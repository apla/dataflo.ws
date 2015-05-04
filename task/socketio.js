var EventEmitter = require ('events').EventEmitter,
	util         = require ('util'),
	task         = require ('./base'),
	dataflows    = require ('../index');

var SocketIOSender = module.exports = function (config) {

	this.init (config);

};

util.inherits (SocketIOSender, task);

util.extend (SocketIOSender.prototype, {

	run: function () {

		var self = this;

		var scope = this.scope;

		var ioInitiator = dataflows.initiator ('socketio', null, project.root);

		var connection = ioInitiator.connections[scope];

		if (this.verbose && !connection) {
			console.log (Object.keys (ioInitiator.connections));
		}

		if (!connection) {
			this.failed ("connection not established for " + scope);
			return;
		}

		var eventName = this.eventName || 'message';
		if (this.broadcast) {
			connection.broadcast.emit (eventName, this.message);
		} else {
			connection.emit (eventName, this.message);
		}

		this.completed (true);
	}
});
