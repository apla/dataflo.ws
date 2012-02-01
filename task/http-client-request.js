'use strict'

var http = require('http'),
	url  = require('url'),
	task = require('task/base')

function HttpClientRequest(config) {
	this.constructor = HttpClientRequest

	// config
	this.dataType   = config.dataType   || this.PLAIN_TYPE
	this.requestUrl = config.requestUrl || ''
	this.query      = config.query      || ''

	this.init(config)
}

HttpClientRequest.prototype = Object.create(task.prototype)

HttpClientRequest.prototype.JSON_TYPE = 'json'
HttpClientRequest.prototype.PLAIN_TYPE = 'asis'

HttpClientRequest.prototype.run = function () {
	var responceData = []

	var onData = function (chunk) {
		responceData.push(chunk)
	}

	var onFinish = (function (data) {
		data = data.join('')

		if (this.JSON_TYPE === this.dataType) {
			try {
				data = JSON.parse(data)
			} catch (e) {
				console.error(e)
				data = {}
			}
		}

		return this.completed({ fields: data })
	}).bind(this, responceData)

	var onRequest = function (res) {
		res.on('data', onData)
		res.on('end', onFinish)
	}

	var options = url.parse(this.requestUrl)
	options.path += url.format({ query: this.query }) // uh, ugly!

	var req = http.request(options, onRequest)
	req.on('error', console.error)
	req.end()
}

module.exports = HttpClientRequest