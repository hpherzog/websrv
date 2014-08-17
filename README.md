websrv
======

node.js web server based on express and ws

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