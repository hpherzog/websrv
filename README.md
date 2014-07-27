websrv
======

node.js web server based on express and ws

```js
var websrv = require('websrv');

var srv = new websrv.Server({
    port: 8080,
    sslPort: 8443,
    sslKeyPath: cwd + '/ssl/test.key',
    sslCertPath: cwd + '/ssl/test.crt'
});
```