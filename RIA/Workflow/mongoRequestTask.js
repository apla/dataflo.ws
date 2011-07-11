var EventEmitter = require ('events').EventEmitter,
	common       = require ('common'),
	crypto       = require ('crypto'),
	task         = require ('RIA/Workflow/Task'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	spawn        = require('child_process').spawn;



var mongoRequestTask = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (mongoRequestTask, task);

common.extend (mongoRequestTask.prototype, {
	
	run: function () {

		var self = this;

		
		self.emit ('log', 'requested '+this.searchString);
		
		project.mongo.collection (this.tagsCollection, function(err, collection) {
			
			self.mongoResponse(collection, self.searchString);
			
		});
	},
	
	mongoResponse: function(tagColl, text) {

		var result = [];
		var self = this;
		
		tagColl.count(function(err, count) 
		{
			tagColl.find(function(err, cursor) 
			{

				cursor.each(function(err, item) {
					if (item != null) {
						if(item[self.matchField]) {
							var _name = item[self.matchField].toString();

							if(text == _name.substr(0, text.length)) 
							{
								result.push(item);
							}
						}
					} else {

						searchResult = JSON.stringify({records: result});
						self.completed ({records: result, position: self.position, text: self.searchString, type: self.dataType});
					}
				});
			});
			
		});
		
//		return result;
	},
	
	emitError: function (e) {
		if (e) {
			this.state = 5;
			this.emit('error', e);
			this.cancel();
			return true;
		} else {
			return false;
		}
	}
});
