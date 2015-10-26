var
	util        = require('util'),
	path        = require('path'),
	nodemailer  = require('nodemailer'),
	// emailTemplates = require('email-templates'),
	task        = require('./base'),
	dataflows   = require ('../');

/**
 * Batch sending of emails
 * - supports templates
 * - doesn't support guaranteed delivery of emails
 * - doesn't support guaranteed sending of emails (sends to smtp transport)
 * however, notifies transport errors to console as warnings.
 *
 * The task is completed as soon as all required fields for email sending are
 * present and all emails are forwarded to smtp transport for sending.
 *
 * The task is failed or skipped (depends on @cfg {Boolean} important) if there are problems
 * with template/contents or recipients list.
 *
 *
 *	@cfg {Object} fields - email fields to send. If we're using recipients list
 *  email fields structure will be used as defaults
 *
 * fields = {
 *		from: {String}, // optional, defaults to consumerConfig value : sender OR SMTP.auth.user
 *		to: {String}, // can be also named "email"
 *		cc: {String},
 *		bcc: {String},
 *		subject: {String},
 *		text: {String}, // text template
 *		html : {String}, // html template
 *  	attachments: {Array}
 *	}
 *
 *
 *	@cfg {String} template - name of template
 *	template is ejs based, generates Text and HTML
 * templates are to be located in <project_root>/templates/email
 * see details: https://github.com/niftylettuce/node-email-templates
 *
 *	! template OR text OR html OR subject MUST be provided
 *
 *
 * @cfg {Array} recipients - list for batch sending
 *
 *	recipients = ["<email>", "<email>",...]
 *	recipients = [{
 *		email: {String}, // can be named "to" or otherwise (see below) substitutes email.to
 *		// name,... - other fields used in template
 *	}]
 *
 * @cfg {String} emailField - if present recipients[emailField] whill be taken as email.to
 *
 *	! email.to OR recipients MUST be provided
 *
*/

// mail task need two things to get configured: transports and templates
// without dataflows project you need to pass whole transport configuration
// in transport key and can use full paths for templates (absolute or within current dir)

var
	mailConfig,
	templatesDir = 'templates/email';

if ('project' in dataflows) {
	// TODO: use pathToVar to avoid try/catch
	mailConfig = dataflows.config.service.mail;
}


function resolveTemplate (transConf) {

}



var mailTask = module.exports = function (config) {

	this.init (config);

};

util.inherits (mailTask, task);

mailTask.prototype.run = function () {

	var
		fields     = this.fields,
		recipients = this.recipients,
		emails     = [];

	if (!recipients || recipients.length === 0) {
		var email = this.checkFields (fields);
		if (!email) {
			return;
		}
		emails.push (email);
	} else {
		for (var recId = 0; recId < recipients.length; recId ++) {
			var email = this.checkFields (recipients[recId], fields);
			if (!email) {
				return;
			}
			emails.push (email);
		}
	}

	var transport = this.resolveTransport (this.transport);
	if (!transport)
		return;

	this.transporter = this.createTransport (transport);

	var sentCount = 0;

	emails.forEach (function (email, idx) {

		this.transporter.use ('compile', this.render.bind (this));

		this.transporter.sendMail (email, function (error, response) {
			if (error)
				return this.failed (error);

			this.emit ('log', 'OK: Email sent to ' + email.to);

			sentCount ++;

			if (sentCount === emails.length) {
				this.completed ();
			}
		}.bind (this));

	}.bind (this));

}

/**
 * Check for all required fields to be present for email
 * @param   {Object|String} fields   envelope fields like from, to and so on; assume `to` if string provided
 * @param   {Object}        defaults envelope template
 * @returns {Object}        envelope with fields
 */
mailTask.prototype.checkFields = function (fields, defaults) {

	var email = {};

	if (fields.constructor === String) {
		fields = {to: fields};
	}

	if (defaults)
	for (var f in defaults) {
		email[f] = defaults[f];
	}

	for (var f in fields) {
		email[f] = fields[f];
	}

	email.to   = email.email  || email.to;
	email.from = email.sender || email.from;

	if (!email.to || !email.from || !email.subject)
		return this.failed ('from, to and subject must be provided');
	if (!email.text && !email.html)
		return this.failed ('text or html template must be provided');

	return email;
}

/**
 * Creating transports for nodemail
 * @param   {String} transport configuration, can be plain
 *                             (like {service: "gmail"}, or for plugin —
 *                             {plugin: "ses", config: <config object>})
 * @returns {Object} transporter
 */
mailTask.prototype.createTransport = function (transport) {
	// TODO: create all needed transports from project config in app start
	// to ensure every plugin will be loaded

	if (transport === "test") {
		return nodemailer.createTransport ({
			name: 'testsend',
			version: '1',
			send: function(data, callback) {
				callback();
			}
		});
	}

	if (transport.plugin) {
		var transPlugin = require (transport.plugin);
		return nodemailer.createTransport (transPlugin (transport.config));
	}

	return nodemailer.createTransport (transport);
}

/**
 * Resolve transport by config key
 * @param   {String|Object} transConf key to resolve transport in config or complete transport configuration
 * @returns {Object}        transport configuration
 */
mailTask.prototype.resolveTransport = function (transConf) {
	// you can use transport string only if dataflows project configuration defined
	if (transConf === "test") {
		return transConf;
	} else if (transConf.constructor === String) {
		if (!mailConfig) {
			return this.failed ("you must supply transport configuration via dataflows.config");
		}

		return mailConfig.transports[transConf];
	}

	return transConf;
}


mailTask.prototype.render = function (mail, done) {

	// TODO: use renderer
	console.log ("STILL NO RENDERER FOR EMAIL");

	if (!mail || !mail.data || !mail.data.html || mail.data.text) {
		return done();
	}

	done();
}

mailTask.prototype._batchSend = function (email, recipients) {
		var self = this,
			emailField = self.emailField || "email";

		console.log('Email setup:', email);
		console.log('SMTP setup:', mailConfig.SMTP);

		var sendMail = function (err, email) { self._sendMail(err, email); };

		for (var i = 0; i < recipients.length; i++) {
			var recipient = recipients[i];
			email.to = recipient[emailField] || recipient.email || recipient.to;
			if (!email.to || email.length < 6 || email.to.indexOf('@')<0) continue; // ugly skip bad emails
			self._render(email, recipient, sendMail);
		}

		// TODO: track individual mail delivery if needed, for example if 'important' flag is set

		self.emit('log', 'Emails sent to transport. Actual sending not guaranteed. See further log.');
		self.completed(true);

	}

mailTask.prototype._sendMail = function (err, email) {
		var self = this;

		if (err) return self._err(err, 'warning');

		self.emit('log', 'Sending email to ' + email.to);
		transport.sendMail(email, function (error, response) {
			if (error) self._err(error, 'warning');
				else self.emit('log', 'OK: Email sent to ' + email.to);
		});
	}

