var task         = require ('./base'),
	util         = require ('util');


var rabbitAck = module.exports = function (config) {

	this.message = config.message;
	this.init (config);

};

util.inherits (rabbitAck, task);

util.extend (rabbitAck.prototype, {

	run: function () {
		this.message.acknowledge();
	}
});
