
var fs = require('fs');
var _ = require('underscore');
var async = require('async');
var http = require('http');
var https = require('https');
var util = require('util');
var events = require('events');

var express = require('express');
var vhost = require('vhost');
var coookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var timeout = require('connect-timeout');

var logging = require(__dirname + "/logging.js");
var wss = require(__dirname + "/wss.js");

/**
 * Virtual host
 * @param host
 * @constructor
 */
function VirtualHost (options) {

    var self = this;

    this.server = options.server;

    this.host = options.host;

    this.publicDirectory =  options.publicDirectory;

    this.define = _.isFunction(options.define)?
        options.define : function(){
        self.server.logger.info('Empty definition for ' + self.host);
    };

    this.app = express();
};


/**
 *
 * @param [options]
 * @class
 * @constructor
 */
function Server (options) {

    options = options !== void(0)?
        options : {};

    events.EventEmitter.call(this);

    this.defaultPort = 80;

    this.defaultSslPort = 443;

    this.timeout = options.timeout !== void(0)?
        options.timeout : '5s';

    this.port = options.port !== void(0)?
        options.port : this.defaultPort;

    this.sslPort = options.sslPort !== void(0)?
        options.sslPort : this.defaultSslPort;

    this.sslKeyPath = options.sslKeyPath !== void(0)?
        options.sslKeyPath : '';

    this.sslCertPath = options.sslCertPath !== void(0)?
        options.sslCertPath : '';

    this.sslOptions = options.sslOptions !== void(0)?
        options.sslOptions : {};

    this.sslForced = options.sslForced !== void(0)?
        options.sslForced : true;

    this.proxy = options.proxy !== void(0)?
        options.proxy : false;

    this.proxySslPort = options.proxySslPort !== void(0)?
        options.proxySslPort : this.defaultSslPort;

    this.basePath = _.isString(options.basePath) && options.basePath.length > 0?
        options.basePath : process.cwd();

    this.virtualHosts = {};

    this.app = null;

    this.httpServer = null;

    this.httpsServer = null;

    this.wssServer = null;

    this.defaultLoggerName = "Https+Wss";

    if(options.logger === void(0)) {
        options.logger = logging.getLogger(this.defaultLoggerName);
        logging.setLevel(this.defaultLoggerName, "info");
    }

    this.logger = options.logger;
};

util.inherits(Server,
    events.EventEmitter);


Server.prototype.start = function start() {

    var self = this;

    this.on("started", self.getStartHandler());
    this.on('error', self.getErrorHandler());

    this.app = express();

    for(var host in this.virtualHosts) {

        var virtualHost = this.virtualHosts[host];

        virtualHost.app.set('view engine', 'jade');
        virtualHost.app.set('views', this.basePath + '/views');

        if(this.proxy) {
            virtualHost.app.enable('trust proxy');
        }

        virtualHost.app.disable('x-powered-by');

        virtualHost.app.use(timeout(self.timeout));
        virtualHost.app.use(self.getRequestLogger());

        if(self.sslForced) {
            virtualHost.app.use(self.getSslRedirector());
        }

        virtualHost.app.use(coookieParser('14fff00895822c08013d750a41c8f024'));
        virtualHost.app.use(bodyParser.urlencoded({extended: true}));
        virtualHost.app.use(methodOverride('X-HTTP-Method'));
        virtualHost.app.use(methodOverride('X-HTTP-Method-Override'));
        virtualHost.app.use(methodOverride('X-Method-Override'));
        virtualHost.app.use(methodOverride('_method'));
        virtualHost.app.use(express.static(virtualHost.publicDirectory));
        virtualHost.define(virtualHost);
        virtualHost.app.use(self.getNotFoundHandler());
        virtualHost.app.use(self.getServerErrorHandler());

        this.app.use(vhost(
            virtualHost.host,
            virtualHost.app
        ));

        self.logger.info('Virtual host ' + virtualHost.host + ' configured');
    }

    async.waterfall([

        function(cb) {
            self.httpServer = http.createServer(self.app);
            self.httpServer.listen(
                self.port, cb);
        },

        function(cb) {

            if(_.isEmpty(self.sslOptions)) {
                self.sslOptions = {};
            }

            self.sslOptions.key = fs.readFileSync(self.sslKeyPath);
            self.sslOptions.cert = fs.readFileSync(self.sslCertPath);

            self.httpsServer = https.createServer(
                self.sslOptions, self.app);
            self.httpsServer.listen(self.sslPort, cb);
        },

        function(cb) {

            self.wssServer = new wss.WebSocketServer({
                server: self.httpsServer,
                logger: self.logger
            });

            cb();
        }

    ], function(err){

        if(err !== void(0) && err !== null) {
            self.emit('error', err);
        } else {
            self.emit("started");
        }
    });
};

Server.prototype.getStartHandler = function getStartHandler() {

    var self = this;
    return function() {

        self.logger.info('Pid: ' + process.pid);
        self.logger.info('Cwd: ' + process.cwd());
        self.logger.info('BasePath: ' + self.basePath);

        var httpStr = self.httpServer.address().family.toLowerCase() + ':' +
            self.httpServer.address().address + ':' +
            self.httpServer.address().port;

        var httpsStr = self.httpsServer.address().family.toLowerCase() + ':' +
            self.httpsServer.address().address + ':' +
            self.httpsServer.address().port;

        self.logger.info('Listening at ' + httpStr);
        self.logger.info('Listening at ' + httpsStr);
        self.logger.info('Server started successfully');
    };
};

Server.prototype.getErrorHandler = function getErrorHandler() {

    var self = this;
    return function(err) {
        self.emit('error', err);
    };
};

Server.prototype.getRequestLogger = function getRequestLogger() {

    var self = this;
    return function(req, res, next) {
        self.logger.info(req.method + ' - ' +req.protocol +
            '://' + req.hostname + req.originalUrl);
        next();
    };
};

Server.prototype.getSslRedirector = function getSslRedirector() {

    var self = this;
    return function(req, res, next){

        if(!req.secure) {

            var hostname = req.hostname;

            if(self.proxy && self.proxySslPort !== self.defaultSslPort) {
                hostname = req.hostname + ':' + self.proxySslPort;
            } else if(!self.proxy && self.httpsServer.address().port !== self.defaultSslPort) {
                hostname = req.hostname + ':' + self.httpsServer.address().port;
            }

            res.redirect(301, 'https://' + hostname + req.originalUrl);
        } else {
            next();
        }
    }
};

Server.prototype.getNotFoundHandler = function getNotFoundHandler() {

    var self = this;
    return function(req, res, next) {
        self.logger.warn('404 Not Found ' +' - ' +req.protocol +
            '://' + req.hostname + req.originalUrl);
        res.status(404);
        res.render('errors/404');
        next();
    }
};

Server.prototype.getServerErrorHandler = function getServerErrorHandler() {

    var self = this;
    return function(err, req, res, next) {

        if(req.timedout) {
            self.logger.warn('Timeout - ' +req.protocol +
                '://' + req.hostname + req.originalUrl);
        } else {
            self.logger.error(err.stack);
        }

        next();
    }
};

Server.prototype.vhost = function vhost(host, define) {

    if(_.isEmpty(this.virtualHosts[host])) {
        this.virtualHosts[host] = new VirtualHost({
            server: this,
            host: host,
            define: define,
            publicDirectory: this.basePath + '/public'
        });
    } else {
       this.logger.warn('Virtual host ' + host + ' already exists');
    }
};

module.exports.Server = Server;