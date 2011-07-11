var EventEmitter = require ('events').EventEmitter;
var util         = require ('util');
var common       = require ('common');

var barrier = module.exports = function (config) {
	
	var self = this;
	
	config.breakWhen.map (function (item) {
		self.waitingItems++;
		item.o.on (item.emitted, function (result) {
			item.result = result;
			self.checkBroken ();
		});
	});
	
	this.brokenDown = config.brokenDown;
}

util.inherits (barrier, EventEmitter);

common.extend (barrier.prototype, {
	waitingItems: 0,
	checkBroken: function () {
		this.waitingItems--;
		if (this.waitingItems)
			console.log ("waiting for "+this.waitingItems+" more items");
		else {
//			console.log ('!!!!!!!!!!!!!!!!!!! everything ready');
			this.brokenDown ();
		}
	}
});
