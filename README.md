websrv - real-time web playground
=================================

You can build a web and websocket test environment very fast.
websrv is built on top of the well known npm modules express and ws.

Set up server
-------------

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

Define routes
-------------

```js
srv.routes(function(routes){

    routes.all('/', function(req, res) {
        res.render('index');
    });
});
```

Handle WebSockets
-----------------

```js
srv.sockets(function(sockets){

    sockets.on('opened', function(socket) {
        console.log('OPENED');
    });

    sockets.on('closed', function(socket) {
        console.log('CLOSED');
    });
});
```

