var
	task        = require('task/base'),
	util        = require('util'),
	path			= require('path'),
	nodemailer	= require('nodemailer'),
	emailTemplates	= require('email-templates'),
	EventEmitter = require('events').EventEmitter;

var
	mailConfig = project.config.consumerConfig.mail,
	transport = nodemailer.createTransport("SMTP", mailConfig.SMTP),
	templatesDir = 'templates/email'; //path.resolve(__dirname, '..', 'templates/email');

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

		/*
			email : {
				from: "info@sample.com", // optional, defaults to consumerConfig value
				to: "name@something.com", // can be also named email
				cc: "",
				bcc: "",
				subject: "",
				text: "",
				html : "",
			},
			template : "" // name of template

			// template OR text OR html OR subject MUST be provided
			// template generates Text and HTML

			recepients = ["<email>", "<email>",...]
			recepients = [{
				email: "", // can be named "to" substitutes email.to
				// name,... other fields used in template
			}]

			email.to OR recepients MUST be provided

		*/

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

			self.emit('log', 'Starting email job');
			console.log('Template ', template, ' Recepients ', recepients);

			self._prepareRender(
				template,
				function () {
					self.emit('log', 'Render ready');
					self._batchSend(email, recepients);
				},
				self._err
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
		
		self.emit('log', 'Preparing render');
		if (!templateName) {
			self._render = render.simple;
			self.emit('log', 'Render simple. Emiting ready.');
			callback && callback();
		} else {
			emailTemplates(templatesDir, function (err, template) {
				if (typeof(template) !== 'function') err = 'Incorrect template' + template;
				if (err) errback && errback(err);
					else {
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

		for (var i = 0; i < recepients.length; i++) {
			var recepient = recepients[i];
			email.to = recepient[emailField] || recepient.email || recepient.to;
			self._render(email, recepient, function (err, email) { self._sendMail(err, email); });
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