var
	task        = require('task/base'),
	util        = require('util'),
	path			= require('path'),
	nodemailer	= require('nodemailer'),
	emailTemplates	= require('email-templates');

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
 * with template/contents or recepients list.
 *
 *
 *	@cfg {Object} email - basic email data, may be fully or partially generated from template
 * and list of recepients
 *
 * email = {
 *		from: {String}, // optional, defaults to consumerConfig value : sender OR SMTP.auth.user
 *		to: {String}, // can be also named "email"
 *		cc: {String},
 *		bcc: {String},
 *		subject: {String},
 *		text: {String},
 *		html : {String},
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
 * @cfg {Array} recepients - list for batch sending
 *
 *	recepients = ["<email>", "<email>",...]
 *	recepients = [{
 *		email: {String}, // can be named "to" or otherwise (see below) substitutes email.to
 *		// name,... - other fields used in template
 *	}]
 *
 * @cfg {String} emailField - if present recepients[emailField] whill be taken as email.to
 *
 *	! email.to OR recepients MUST be provided
 *
*/


var
	mailConfig = project.config.consumerConfig.mail,
	transport = nodemailer.createTransport("SMTP", mailConfig.SMTP),
	templatesDir = 'templates/email';

var
	render = {
		simple :  function (email, recepient, callback) {
			callback && callback(null, email);
		},
		template : function (template, templateName) {
			return function (email, recepient, callback) {
				template(templateName, recepient, function(err, html, text) {
					if (!err) {
						util.extend(email, {
							text: text,
							html: html
						});
						callback && callback(null, email);
					} else callback(err);
				});
			};
		}
	};


var mailTask = module.exports = function (config) {

	this.request = config.request;
	this.init(config);

};

util.inherits (mailTask, task);

util.extend (mailTask.prototype, {
	run: function () {

		var self = this;

		var
			err = false;
			email = self.email,
			recepients = self.recepients,
			template = self.template;

		if (!email && !template) {

			return self._err('Neither email object nor template not provided');

		} else {

			if (!email) {
				email = {
					to: null,
					from: null,
					subject: ""
				};
			}

			email.to = email.to || email.email;
			email.sender = email.sender || email.from;

			if (!email.to && !recepients) return self._err('email.to OR recepients MUST be provided');
			if (!email.subject && !email.text && !template)	return self._err('email.subject OR email.text OR template MUST be provided');
			if (!email.sender) email.sender = mailConfig.sender || mailConfig.from|| mailConfig.SMTP.auth.user;

			// normalize recepients
			if (!recepients) {
				recepients = [{
					email : email.to
				}];
			} else {
				if (!recepients.push) recepients = [recepients];
				recepients = recepients.map(function (item) {
					if (typeof(item) !== 'object') item = {
						email : item
					};
					return item;
				});
			}

			if (self.verbose) self.emit('log', 'Starting email job');
			console.log('Template ', template, ' Recepients ', recepients);

			self._prepareRender(
				template,
				function () {
					if (self.verbose) self.emit('log', 'Render ready');
					self._batchSend(email, recepients);
				}
			);
		}
	},

	_err : function (msg, type) {
		var self = this;
		type = type || 'error';

		self.emit('warn', msg);

		if (self.type === 'error')
			if (self.important) self.failed(msg);	else self.skipped(msg);

	},

	_prepareRender : function (templateName, callback, errback) {
		var self = this;

		if (self.verbose) self.emit('log', 'Preparing render');
		if (!templateName) {
			self._render = render.simple;
			if (self.verbose) self.emit('log', 'Render simple');
			callback && callback();
		} else {
			if (self.verbose) self.emit('log', 'Render template - getting');
			emailTemplates(templatesDir, function (err, template) {
				if (typeof(template) !== 'function') err = 'Incorrect template' + template;
				if (err) self._err(err);
					else {
						if (self.verbose) self.emit('log', 'Render template - OK');
						self._render = render.template(template, templateName);
						callback && callback();
					}
			});
		}
	},

	_batchSend : function (email, recepients) {
		var self = this,
			emailField = self.emailField || "email";

		console.log('Email setup:', email);
		console.log('SMTP setup:', mailConfig.SMTP);

		var sendMail = function (err, email) { self._sendMail(err, email); };

		for (var i = 0; i < recepients.length; i++) {
			var recepient = recepients[i];
			email.to = recepient[emailField] || recepient.email || recepient.to;
			if (!email.to || email.length < 6 || email.to.indexOf('@')<0) continue; // ugly skip bad emails
			self._render(email, recepient, sendMail);
		}

		// TODO: track individual mail delivery if needed, for example if 'important' flag is set

		self.emit('log', 'Emails sent to transport. Actual sending not guaranteed. See further log.');
		self.completed(true);

	},

	_sendMail : function (err, email) {
		var self = this;

		if (err) return self._err(err, 'warning');

		self.emit('log', 'Sending email to ' + email.to);
		transport.sendMail(email, function (error, response) {
			if (error) self._err(error, 'warning');
				else self.emit('log', 'OK: Email sent to ' + email.to);
		});
	}

});