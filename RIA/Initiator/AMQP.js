var EventEmitter   = require ('events').EventEmitter,
	http           = require ('http'),
	util           = require ('util'),
	common         = require ('common'),
	Workflow       = require ('RIA/Workflow');

var amqp = require ('node-amqp/amqp.js');

var amqpi = module.exports = function (config) {
	// we need to launch amqpi
	
	var self = this;
	
	if (!config.conf)
		throw "you must define 'config' for amqp";
	
	// timeout between connects for each config
	this.shortTimeout = config.shortTimeout ? config.shortTimeout : 2.0.seconds();
	// between each pass on config-array
	this.longTimeout = config.longTimeout ? config.longTimeout : 10.0.seconds();
	// start value for retries
	this.tries = 0;
	
	// get an array of configs
	this.config = (config.conf instanceof Array) ? (config.conf) : ([config.conf]);
	
	this.workflows = config.workflows;
	
	if(this.config) {
		this.listen ();
	}
}

util.inherits (amqpi, EventEmitter);

common.extend (amqpi.prototype, {
	
	ready: function () {
		
		// when connection ready we call this method
		
		var self = this;
		console.log ("connected to " + this.connection.serverProperties.product);
				
		// TODO : get every workflow and subscribeRaw on queue for this config
		
		self.workflows.map(function (workflowParams) {

//			console.log ("--- workflowParams: ", workflowParams);

			var exchange = self.connection.exchange (workflowParams.exchange, {type: 'topic'});
			
			var q = self.connection.queue (workflowParams.queue, function (name, messageCount, consumerCount) {
				console.log ("there are " + messageCount + " messages awaits processing for " + self.config.qName);
			});

			if (workflowParams.routingKey) q.bind (exchange, workflowParams.routingKey);

			q.subscribeRaw (function (m) {
				
//				console.log ("--- contentType: " );

				m.body = '';
			
				var size = 0;
				m.addListener ('data', function (d) {
					m.body += d;
				});

				m.addListener ('end', function () {

					try {
						m.command = JSON.parse (m.body);
					} catch (e) {
						self.emit ('undefined', e, m);
						m.acknowledge ();
						return;
					}

					self.emit ('detected', m);
					
					var workflow = new Workflow (
						common.extend (true, {}, workflowParams),
						{request: m.command}
					);

					workflow.run();
					
//					console.log ('<<<<<<<<<< message, workflowParams', m, workflowParams, '>>>>>>>>>>>');
					
					
				});
				
				
			})
			.addCallback (function () {
				self.emit ('ready');
			});
			
		});
		
	},
	
	listen: function () {
		
		var self = this;
		
		self.resetCancelTimeout();
		
		this.currentConfig = this.getConfig();
		
		console.log ('currentConfig', this.currentConfig.host);
		
		this.setCancelTimeout(function () {
			
			// mark config as failed
			if (!self.currentConfig.failed) {
				self.currentConfig.failTime = new Date().getTime();
				self.currentConfig.failed = 1;
				console.log ('current host ' + self.currentConfig.host + ' is failed (' + self.currentConfig.failTime + ')');
			}
			
			// close current connection
			self.connection.end();
			//reconnect to amqp
			self.listen();
		
		});
		
		this.connection = amqp.createConnection (this.currentConfig);
			
		this.connection.on ('error', function (e) {
			console.log ('connection.error' + e);
			
			if (e.errno == 4)
			{
				self.currentConfig.failTime = new Date().getTime();
				self.currentConfig.failed = 1;
				console.log ('current host ' + self.currentConfig.host + ' is failed (' + self.currentConfig.failTime + ')');
						
				if (self.tries % self.config.length) {
					
					self.resetCancelTimeout();				
					// close current connection
					self.connection.end();
					//reconnect to amqp
					self.listen();
					
				}
			}
		});
		
		this.connection.on ('ready', function() {
			self.resetCancelTimeout();
			self.ready();
		});
		
			
	},
	
	getConfig: function () {
		this.tries++;
		this.config.sort(this.sortConfigs);
		
		var newConfig = this.config[0]
		newConfig.failed = 0;
		
		return newConfig;		
	},
	
	// timeout functions
	
	setCancelTimeout: function (cb) {
		var timeout = (this.tries % this.config.length) ? this.shortTimeout : this.longTimeout;
		this.cancelTimeoutId = setTimeout(cb, timeout);
	},
	
	resetCancelTimeout: function () {
		clearTimeout(this.cancelTimeoutId);
	},
	
	// sort function
	
	sortConfigs: function (aConf, bConf) {
		
		return !aConf.failTime ? -1 : !bConf.failTime ? 1 : aConf.failTime - bConf.failTime;
	}
});