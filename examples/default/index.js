
var websrv = require("../..");

var cwd = process.cwd();

var srv = new websrv.Server({
    port: 8080,
    sslPort: 8433,
    sslKeyPath: cwd + '/ssl/test.key',
    sslCertPath: cwd + '/ssl/test.crt',
    cookieSecret: '14fff00895822c08013d750a41c8f024'
});

srv.app.get('/', function(req, res) {
    res.render('index');
});

srv.start();