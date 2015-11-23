var fs     = require ('fs');
var assert = require ('assert');

var dfProject = require ('../project');

describe ("008-project search", function () {

	describe ("configured project", function () {

		before (function () {
			fs.writeFileSync ('.dataflows/instance', 'apla@tina');
		});

		it ("should find project", function (done) {
			var dfp = new dfProject();

			dfp.on ("ready", function () {
				done ();
			})

			dfp.on ("failed", function () {
				assert (false);
			});
		});

	});


	describe ("bare project", function () {

		before (function () {
			fs.unlinkSync ('.dataflows/instance');
		});

		it ("should find project ", function (done) {
			var dfp = new dfProject();

			dfp.on ("ready", function () {
				assert (false);
			});

			dfp.on ("failed", function () {
				done ();
			});
		});

		after (function () {
			fs.writeFileSync ('.dataflows/instance', 'apla@tina');
		});

	});

});
