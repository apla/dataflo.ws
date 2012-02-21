'use strict'

var urlUtils     = require('url')
var BaseTask     = require('task/base')
var RequestModel = require('model/from-url')

function HttpClientRequest(config) {
	this.constructor = HttpClientRequest

	this.init(config)
}

HttpClientRequest.prototype = Object.create(BaseTask.prototype)

HttpClientRequest.prototype.JSON_TYPE = 'json'
HttpClientRequest.prototype.ASIS_TYPE = 'asis'

HttpClientRequest.prototype.mergeUrlParams = function (url, params) {
	var parsedUrl = urlUtils.parse(url)
	Object.keys(params).forEach(function (p) {
		parsedUrl[p] = params[p]
	})
	return parsedUrl
}

HttpClientRequest.prototype.produceData = function () {
	var data = this.buffer.data

	if (this.JSON_TYPE === this.dataType) {
		try {
			data = JSON.parse(data)
		} catch (e) {
			console.error(new Error('JSON parse error.'))
			console.error(e)
			data = {}
		}
	}

	return this.completed({ fields: data })
}

HttpClientRequest.prototype.run = function () {
	if (!this.requestUrl && !this.urlParams) {
		this.failed(new Error('No request URL provided.'))
		return
	}

	this.buffer = {}

	var urlParams = this.mergeUrlParams(
		this.requestUrl, this.urlParams
	)

	var model = new RequestModel(urlParams)
	model.on('end', this.produceData.bind(this))
	model.fetch({ to: this.buffer })
}

module.exports = HttpClientRequest