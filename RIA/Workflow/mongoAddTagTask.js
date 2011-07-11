var EventEmitter = require ('events').EventEmitter,
	common       = require ('common'),
	crypto       = require ('crypto'),
	task         = require ('RIA/Workflow/Task'),
	util         = require ('util'),
	urlUtil      = require ('url'),
	spawn        = require('child_process').spawn;


var mongoAddTagTask = module.exports = function (config) {
	
	this.init (config);
	
};

util.inherits (mongoAddTagTask, task);

common.extend (mongoAddTagTask.prototype, {
	
	run: function () {

		var self = this;

		project.mongo.collection (this.collectionName, function(err, collection) {
			
			self.addTagsToMongo(collection);
			
		});
	},
	
	addTagsToMongo: function(cl) {
		
		var self = this;
		var count = 0;
		var searchObject  = {};
		var result = [];
		
		self.tagsToAdd.map (function (name) {
			
			searchObject = {};
			searchObject[self.matchField] = name;
		
			cl.findOne(searchObject, function(err, cursor) {
		
				count ++;

				if(typeof cursor !== 'undefined' ) {
				
					console.log("Tag with name", name ,"was alredy added",cursor);
				} else {
				
					console.log("Tag with name", name ,"is added");
					if(name.length > 0) {
						ob = {};
						ob[self.matchField] = name;
						cl.insert(ob);
						result.push(ob);
					}
				}
				
				if(count == self.tagsToAdd.length) {
					if(self.returnAll = false) {
						searchResult = JSON.stringify({records: result});
						self.completed ({records: result});
					} else {
						self.returnAllItems(cl);
					}
				}
			});
		});
			
	
	
	},
	
	returnAllItems: function(collect) {
	
		var result = [];
		var self = this;
		collect.count(function(err, count) {
		
			collect.find(function(err, cursor) {
				cursor.each(function(err, item) {

					if (item != null) {
						result.push(item);
//						sys.puts(sys.inspect(item));
					} else {
						searchResult = JSON.stringify({records: result});
						self.completed ({records: result});
					}
				});
			});
		});
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
