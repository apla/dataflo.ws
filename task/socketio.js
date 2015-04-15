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

		connection.send (this.message);

		this.completed ();
	}
});
