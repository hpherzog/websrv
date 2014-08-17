
var websrv = require("../..");

var cwd = process.cwd();

var srv = new websrv.Server({
    port: 8080,
    sslPort: 8433,
    sslKeyPath: cwd + '/ssl/websrv.key',
    sslCertPath: cwd + '/ssl/websrv.crt',
    cookieSecret: '***',
    viewEngine: 'jade'
});

srv.routes(function(routes){

    routes.all('/', function(req, res) {
        res.render('index');
    });
});

srv.sockets(function(sockets){

    sockets.on('opened', function(socket) {
        console.log('OPENED');
    });

    sockets.on('closed', function(socket) {
        console.log('CLOSED');
    });
});

srv.start();