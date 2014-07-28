
var websrv = require("../..");

var cwd = process.cwd();

var srv = new websrv.Server({
    port: 8080,
    sslPort: 8433,
    sslKeyPath: cwd + '/ssl/test.key',
    sslCertPath: cwd + '/ssl/test.crt'
});

srv.vhost('test1.tld', function(vhost){

    vhost.app.get('/', function(req, res){
        res.render('index');
    });
});

srv.start();