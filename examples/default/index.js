
var websrv = require("../..");

var cwd = process.cwd();

var srv = new websrv.Server({
    port: 8080,
    sslPort: 8433,
    sslKeyPath: cwd + '/ssl/websrv.key',
    sslCertPath: cwd + '/ssl/websrv.crt',
    cookieSecret: '14fff00895822c08013d750a41c8f024',
    viewEngine: 'ejs',
    viewPath: './views'
});

srv.app.get('/', function(req, res) {
    res.render('index');
});

srv.start();