'use strict';

var http = require('http'),
    concat = require('concat-stream');

var patterns = {
  hasScope: /^@/,
  isPublish: /^\/[\w\-\.]+$/
};

/**
 * function
 * @param {Object} opts - options to create mock registry
 * @param {function} callback
 * Creates a new mock registry server with
 * the `opts` supplied.
 */
module.exports = function (opts, callback) {
  var registry = new Registry(opts);

  registry.listen(function (err) {
    return !err
      ? callback(null, registry)
      : callback(err);
  });
};

//
// Expose the Registry for debugging purposes
//
module.exports.Registry = Registry;

/**
 * @constructor Registry
 * @param {Object} opts - Options for registry
 * Represents a mock npm Registry server which is used
 * to assert responses received on certain routes.
 */
function Registry(opts) {
  this.server = http.createServer(this.handler.bind(this));
  this.cache = {};
  this.port = opts.http;
};

/**
 * @function Handler
 *  @param {Request} req - Request object
 *  @param {Response} res - Response object
 * Handles incoming requests based on a simple decision
 * - All requests with X-FETCH-CACHE header respond
 *   with the last request body received for that route
 *   and clears that cache.
 * - All other requests are cached for future assertion
 *   and the response is given from the JSON parsed
 *   X-SEND-RESPONSE header:
 *
 *    {
 *      "body": { an: 'unstringified JSON object' },
 *      "status": 200
 *    }
 */
Registry.prototype.handler = function (req, res) {
  if (req.headers['x-fetch-cache'] || ~req.url.indexOf('.tgz')) {
    return this.serveCache(req, res);
  }

  this.cacheRequest(req, res);
};

/**
 * @function serveCache
 *  @param {Request} req - Incoming request
 *  @param {Response} res - Outgoing response
 * Serves the cached request data for the specified
 * `req.url` if it exists.
 */
Registry.prototype.serveCache = function (req, res) {
  if (this.cache[req.url]) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(this.cache[req.url]);
    if (req.headers['x-clear-cache']) {
      this.cache[req.url] = null;
    }

    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ message: req.url + ' not found.' }));
};

/**
 * @function cacheRequest
 *  @param {Request} req - Incoming Request
 *  @param {Response} res - Outgoing Response
 * Caches the req data and serves up any data from
 * the X-SEND-RESPONSE request header.
 */
Registry.prototype.cacheRequest = function (req, res) {
  if (this.cache[req.url]) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Cache exists for ' + req.url }));
    return;
  }

  /**
   * @function parseResponse
   * Attempts to get the respond to send.
   */
  function parseResponse() {
    var response;
    var defaults = {
      body: { message: 'Cached data for: ' + req.url },
      status: 201
    };

    if (req.headers['x-send-response']) {
      try {
        response = JSON.parse(req.headers['x-send-response']);
      } catch (ex) {
        response = defaults;
      }
    }

    return (response || defaults);
  }

  /**
   * @function cacheTarball
   * JSON parses the data and caches the corresponding
   * tarball at the URL the registry would fetch it from
   */
  function cacheTarball(data) {
    var parsed = JSON.parse(data);
    var name = req.url.substr(1);
    var file = name + '-' + parsed['dist-tags'].latest + '.tgz';

    if (patterns.hasScope.test(name)) {
      file = file.replace('%2F', '/');
    }

    self.cache[req.url + '/-/' + file] = new Buffer(
      parsed._attachments[file].data,
      'base64'
    );
  }

  var self = this;
  req.pipe(concat({ encoding: 'string' }, function (data) {
    //
    // Cache the raw response at the URL.
    //
    self.cache[req.url] = data;

    //
    // Optionally cache the tarball of the publish payload.
    //
    if (req.method === 'PUT' && patterns.isPublish.test(req.url)) {
      cacheTarball(data);
    }

    var send = parseResponse();
    res.writeHead(send.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(send.body));
  }));
};

/**
 * @function listen
 *  @param {function} callback - Continuation function
 * Begins listening on the internal HTTP server
 * associated with this instance.
 */
Registry.prototype.listen = function (callback) {
  this.server.listen(this.port, callback);
};

/**
 * @function close
 *  @param {function} callback - Continuation function
 * Stops listening on the internal HTTP server
 * associated with this instance.
 */
Registry.prototype.close = function (callback) {
  this.server.close(callback);
};
