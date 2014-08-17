
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var http = require('http');
var https = require('https');
var util = require('util');
var events = require('events');

var express = require('express');
var coookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var timeout = require('connect-timeout');

var logging = require(__dirname + "/logging.js");
var wss = require(__dirname + "/wss.js");


/**
 * Rapid development web server.
 * @param [options]
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

    this.basePath = _.isString(options.basePath)?
        options.basePath : process.cwd();

    this.expressApp = null;

    this.httpServer = null;

    this.httpsServer = null;

    this.wssServer = null;

    this.defaultLoggerName = "Websrv";

    if(options.logger === void(0)) {
        options.logger = logging.getLogger(this.defaultLoggerName);
        logging.setLevel(this.defaultLoggerName, "info");
    }

    this.logger = options.logger;

    this.routeDefinitions = [];

    this.socketDefinitions = [];

    this.appMiddleware = [];

    this.publicDirectory = _.isString(options.publicDirectory)?
        options.publicDirectory : path.normalize(this.basePath + '/public');

    this.cookieSecret = options.cookieSecret;

    this.viewEngine = options.viewEngine !== void(0)?
        options.viewEngine : 'jade';

    this.viewPath = _.isString(options.basePath)?
        options.viewPath : path.normalize(this.basePath + '/views');
};

util.inherits(Server,
    events.EventEmitter);

Server.prototype.createExpressApp = function() {

    var self = this;

    self.expressApp = express();

    self.expressApp.set('view engine', self.viewEngine);
    self.expressApp.set('views', self.viewPath);

    if(self.proxy) {
        self.expressApp.enable('trust proxy');
    }

    self.expressApp.disable('x-powered-by');

    self.expressApp.use(timeout(self.timeout));
    self.expressApp.use(self.getRequestLogger());

    if(self.sslForced) {
        self.expressApp.use(self.getSslRedirector());
    }

    self.expressApp.use(coookieParser(self.cookieSecret));
    self.expressApp.use(bodyParser.urlencoded({extended: true}));
    self.expressApp.use(methodOverride('X-HTTP-Method'));
    self.expressApp.use(methodOverride('X-HTTP-Method-Override'));
    self.expressApp.use(methodOverride('X-Method-Override'));
    self.expressApp.use(methodOverride('_method'));
    self.expressApp.use(express.static(self.publicDirectory));

    for(var i in self.appMiddleware) {
        self.expressApp.use(self.appMiddleware[i]);
    }

    for(var i in self.routeDefinitions) {
        self.routeDefinitions[i](self.expressApp);
    };

    self.expressApp.use(self.getNotFoundHandler());
    self.expressApp.use(self.getServerErrorHandler());
};

Server.prototype.start = function start() {

    var self = this;

    self.on("started", self.getStartHandler());
    self.on('error', self.getErrorHandler());

    this.createExpressApp();

    async.waterfall([

        function(cb) {
            self.httpServer = http.createServer(self.expressApp);
            self.httpServer.listen(self.port, cb);
        },

        function(cb) {

            if(_.isEmpty(self.sslOptions)) {
                self.sslOptions = {};
            }

            if(!fs.existsSync(self.sslKeyPath)) {
                cb(new Error('Ssl key file ' + self.sslKeyPath + ' not found!'));

            } else if(!fs.existsSync(self.sslCertPath)) {
                cb(new Error('Ssl crt file ' + self.sslCertPath + ' not found!'));

            } else {

                self.sslOptions.key = fs.readFileSync(self.sslKeyPath);
                self.sslOptions.cert = fs.readFileSync(self.sslCertPath);

                self.httpsServer = https.createServer(
                    self.sslOptions, self.expressApp);
                self.httpsServer.listen(self.sslPort, cb);
            }
        },

        function(cb) {

            self.wssServer = new wss.WebSocketServer({
                server: self.httpsServer,
                logger: self.logger
            });

            for(var i in self.socketDefinitions) {
                self.socketDefinitions[i](self.wssServer);
            };

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
        self.logger.info('PublicDirectory: ' + self.publicDirectory);
        self.logger.info('ViewEngine: ' + self.viewEngine);
        self.logger.info('ViewPath: ' + self.viewPath);

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
        self.logger.error(err.stack);
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

            var redirectUrl = 'https://' + hostname + req.originalUrl;
            self.logger.info('Redirect to ' + redirectUrl);
            res.redirect(301, redirectUrl);
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

Server.prototype.routes = function routes(definition) {
    this.routeDefinitions.push(definition);
};

Server.prototype.sockets = function sockets(definition) {
    this.socketDefinitions.push(definition);
};

Server.prototype.use = function use(middleware) {
    this.appMiddleware.push(middleware);
};

module.exports.Server = Server;