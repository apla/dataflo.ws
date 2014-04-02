// usage:
/*
	<script src="require-browser.js"></script> <!-- sync loading -->
	<script>
		preloadAssets ();
	</script>
*/

require.alias("apla-dataflo.ws/common.js", "common.js");

var events = require ('events');
events.EventEmitter = events;

var eventsPath = require.resolve ('events');

require.alias(eventsPath, "apla-dataflo.ws/deps/events.js");
require.alias(eventsPath, "elmobro/deps/events.js");


util = {};

module = {
	exports: {}
};
