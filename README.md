webSrv - real-time web playground
=================================

You can build a web and WebSocket test environment very fast.
webSrv is built on top of the well known npm modules express and ws.

Set up Server
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
```

Define Routes
-------------

```js
srv.routes(function(routes){

    routes.get('/users', function(req, res) {
        res.render('users/list');
    });
    
    routes.post('/users', function(req, res) {
        res.render('users/add');
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

Start Server
------------
```js
srv.start();
```
