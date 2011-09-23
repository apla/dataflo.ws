var HTTPClient		= require ('http'),
	util			= require ('util'),
	fs				= require ('fs')
	querystring		= require ('querystring');

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

var httpModel = module.exports = function (modelBase) {
		
	var self = this;
	
	modelBase.url.host = modelBase.url.hostname;
	modelBase.url.path = modelBase.url.pathname;
	
	util.extend (this, modelBase.url);
		
	this.fetch = function (target) {
		
		console.log (modelBase.url);
	
		var isStream = target.to instanceof fs.WriteStream;
		if (!isStream) target.to.data = '';
		
		var progress = new pipeProgress ({
			writer: target.to
		});
				
		var req = self.req = HTTPClient.request(this, function (res) {
						
			self.res = res;
			
			if (res.statusCode != 200) {
				modelBase.emit ('error', 'statusCode = '+res.statusCode);
				return;
			}
			
			if (!isStream) res.setEncoding('utf8');
			
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
				modelBase.emit ('error', 'res : '+exception);
			});
			
			res.on ('data', function (chunk) {
				if (!isStream) target.to.data += chunk;
				modelBase.emit ('data', chunk);
			});
			
			res.on ('end', function () {
				modelBase.emit ('end');
			});
		});
		
		req.on('error', function(e) {
			modelBase.emit ('error', 'req : '+e);
		});
				
		req.end();
		
		return progress;
	}
	
	this.stop = function () {
		if (this.req) this.req.abort();
		if (this.res) this.res.destroy();
	}
	
}

httpModel.prototype = {
	
	method: 'GET',
	port: 80
	
};