var HTTPClient		= require ('http'),
	util			= require ('util'),
	fs				= require ('fs'),
	urlUtils		= require ('url'),
	bufferTools		= require('buffertools');

var pipeProgress = function (config) {
	this.bytesTotal = 0;
	this.bytesPass  = 0; // because bytes can be read and written
	this.lastLogged = 0;
	util.extend (this, config);
}

pipeProgress.prototype.watch = function () {
	var self = this;
	if (this.reader && this.readerWatch) {
		this.reader.on (this.readerWatch, function (chunk) {
			self.bytesPass += chunk.length;
		});
	} else if (this.writer && this.writerWatch) {
		this.writer.on (this.writerWatch, function (chunk) {
			self.bytesPass += chunk.length;
		});
	}
}

/**
 * @class httpModel
 *
 * Wrapper of HTTPClient for serverside requesting.
 *
 */

var httpModel = module.exports = function (modelBase) {
		
	this.modelBase = modelBase;
	
	this.params = {
		method: 'GET',
		port: 80
	};
	
	util.extend (this.params, modelBase.url);
	
	if (this.params) {
		
		this.headers = {}
		
		if (this.params.auth) {
			this.headers['Authorization'] = 'Basic ' + new Buffer(self.params.auth).toString('base64');
		}
		
		if (this.params.body) {
			this.params.method = 'POST';
			this.postBody = this.params.body;
			delete this.params.body;
		}
		if (this.params.headers) {
			try {
				util.extend(this.headers, this.params.headers);
				delete this.params.headers;
			} catch (e) {
				console.log ('headers is not correct');
			}
		}
	}
}

util.extend (httpModel.prototype, {

	fetch: function (target) {
		
		var self = this;
		
		var isStream = target.to instanceof fs.WriteStream;
		if (!isStream) target.to.data = new Buffer('');
		
		var progress = new pipeProgress ({
			writer: target.to
		});
	  	
		var urlParams = self.getUrlParams();
		
		var req = self.req = HTTPClient.request(urlParams, function (res) {
						
			self.res = res;

			if (res.statusCode != 200) {
				self.modelBase.emit ('error', new Error('statusCode = ' + res.statusCode));
				return;
			}
			
			util.extend (progress, {
				bytesTotal: res.headers['content-length'],
				reader: res,
				readerWatch: "data"
			});
			
			progress.watch ();
		
			if (isStream) {
				self.writeStream = target.to;
				res.pipe(self.writeStream);
			}
			
			res.on ('error', function (exception) {
				self.modelBase.emit ('error', 'res : '+exception);
			});
			
			res.on ('data', function (chunk) {
				if (!isStream) target.to.data = bufferTools.concat(target.to.data, chunk);
				self.modelBase.emit ('data', chunk);
			});
			
			res.on ('end', function () {
				self.modelBase.emit ('end');
			});
		});
		
		req.on('error', function(e) {
			self.modelBase.emit ('error', 'req : '+e);
		});
		
		if (self.headers) {
			for (var key in self.headers) {
				req.setHeader(key, self.headers[key]);
			}
		}
		
		if (self.postBody) req.write(self.postBody);
		
		req.end();
		
		return progress;
	},
	
	stop: function () {
		if (this.req) this.req.abort();
		if (this.res) this.res.destroy();
	},
	
	/**
	 * http.request requires the query part to be appended to the pathname.
	 */
	getUrlParams: function () {
	
		var params = this.params;
		var q = params.query;
		
		if (q && 'object' === typeof q) {
			var queryStr = urlUtils.format({ query: q }),
				newParams = Object.create(params);
			newParams.path += queryStr;
			return newParams
		}
		
		return params;
	}
	
});