# registry-mock

A simple mock npm registry.

## Usage

``` js
var registryMock = require('registry-mock');
registryMock({ http: 8080 }, (err, registry) => {
  if (err) { /* handle me */ }

  console.log('Mock npm registry listening on 8080');
});
```

`registry-mock` is designed to be a generic caching HTTP server for asserting that proxied
`npm` registry HTTP calls send the correct payloads and/or headers to the target registry.
In order to test some npm-specific routes (such as publish) it is necessary to cache tarballs
and later serve them.

### HTTP & cache conventions

The response to incoming requests can be summarized based on a few simple rules:

1. All requests to `/.*tgz` or those with the `X-FETCH-CACHE` header
respond with the last request body received for that route.
  - If there is no cache for that route a `404` is served.
  - If `X-CLEAR-CACHE` is provided to a cache hit request, then
    the cache is cleared for that route.

- All other requests are cached for future assertion
  and the response is given from the JSON parsed
  `X-SEND-RESPONSE` header:
``` js
   {
     "body": { an: 'unstringified JSON object' },
     "status": 200
   }
```
  - npm publish `PUT /:pkg` splits out the tarball and makes
    the cache for `/:pkg/-/:pkg-:version.tgz` available for
    download.

### Using `npm-registry-echo`

This package also ships a binary named `npm-registry-echo` this program runs a simple
`registry-mock` server and then fetches the cache immediately after all requests. This
allows for simple introspection of the payloads that are sent from the `npm` CLI.

e.g. **Viewing `npm publish` payloads**

##### 1. Running `npm-registry-echo`
```
$ npm i -g registry-mock
$ npm-registry-echo
npm-registry-echo listening on 3676
```

#### 2. Add garbage nerf darts to your `~/.npmrc`
```
//localhost:3676/:_password=garbage!!password
//localhost:3676/:username=garbage!!user
//localhost:3676/:email=anyvalid@email.com
//localhost:3676/:always-auth=false
```

#### 3. Run `npm publish` against your echo
```
npm publish --reg=http://localhost:3676 --loglevel=http
npm http request PUT http://localhost:3676/test-publish03
npm http 201 http://localhost:3676/test-publish03
+ test-publish03@1.0.0
```

#### 4. See the output
```
PUT /test-publish03 {"_id":"test-publish03","name":"test-publish03","description":"Just a test","dist-tags":{"latest":"1.0.0"},"versions":{"1.0.0":{"name":"test-publish03","version":"1.0.0","description":"Just a test","main":"index.js","scripts":{"test":"echo \"Error: no test specified\" && exit 1"},"author":"","license":"ISC","readme":"ERROR: No README data found!","_id":"test-publish03@1.0.0","_shasum":"6e78734fff0347a9596abb5d3b0360fda6f1a899","_from":".","_npmVersion":"3.7.1","_nodeVersion":"4.2.2","_npmUser":{"name":"garbage!!user","email":"anyvalid@email.com"},"maintainers":[{"name":"garbage!!user","email":"anyvalid@email.com"}],"dist":{"shasum":"6e78734fff0347a9596abb5d3b0360fda6f1a899","tarball":"http://localhost:3676/test-publish03/-/test-publish03-1.0.0.tgz"}}},"readme":"ERROR: No README data found!","maintainers":[{"name":"garbage!!user","email":"anyvalid@email.com"}],"_attachments":{"test-publish03-1.0.0.tgz":{"content_type":"application/octet-stream","data":"{{BIG-BASE64-TARBALL}}","length":568}}}
```

##### License MIT
##### Authors: [Charlie Robbins](https://github.com/indexzero), [Jarrett Cruger](https://github.com/jcrugzz)
