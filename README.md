websrv
======

websrv is built on top of the well known npm modules express and ws. You can build a test or playground environment very fast. 

```js
var websrv = require("websrv");

var cwd = process.cwd();

var srv = new websrv.Server({
    port: 8080,
    sslPort: 8433,
    sslKeyPath: cwd + '/ssl/websrv.key',
    sslCertPath: cwd + '/ssl/websrv.crt',
    cookieSecret: '***',
    viewEngine: 'jade'
});

srv.start();
```