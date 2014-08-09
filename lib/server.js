
var fs = require('fs');
var _ = require('underscore');
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

    this.basePath = _.isString(options.basePath) && options.basePath.length > 0?
        options.basePath : process.cwd();

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

    this.middleware = [];

    this.publicDirectory = !_.isString(options.basePath)?
        process.cwd() + '/public' : options.publicDirectory;
};

util.inherits(Server,
    events.EventEmitter);

Server.prototype.createExpressApp = function() {

    var self = this;

    self.app = express();

    self.app.set('view engine', 'jade');
    self.app.set('views', this.basePath + '/views');

    if(this.proxy) {
        self.app.enable('trust proxy');
    }

    self.app.disable('x-powered-by');

    self.app.use(timeout(self.timeout));
    self.app.use(self.getRequestLogger());

    if(self.sslForced) {
        self.app.use(self.getSslRedirector());
    }

    self.app.use(coookieParser('14fff00895822c08013d750a41c8f024'));
    self.app.use(bodyParser.urlencoded({extended: true}));
    self.app.use(methodOverride('X-HTTP-Method'));
    self.app.use(methodOverride('X-HTTP-Method-Override'));
    self.app.use(methodOverride('X-Method-Override'));
    self.app.use(methodOverride('_method'));
    self.app.use(express.static(self.publicDirectory));

    for(var i in self.middleware) {
        self.app.use(self.middleware[i]);
    }

    self.app.use(self.getNotFoundHandler());
    self.app.use(self.getServerErrorHandler());
};

Server.prototype.start = function start() {

    var self = this;

    self.on("started", self.getStartHandler());
    self.on('error', self.getErrorHandler());

    self.createExpressApp();

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

            if(!fs.existsSync(self.sslKeyPath)) {
                cb(new Error('Ssl key file ' + self.sslKeyPath + ' not found!'));
            } else if(!fs.existsSync(self.sslCertPath)) {
                cb(new Error('Ssl crt file ' + self.sslCertPath + ' not found!'));
            } else {
                self.sslOptions.key = fs.readFileSync(self.sslKeyPath);
                self.sslOptions.cert = fs.readFileSync(self.sslCertPath);

                self.httpsServer = https.createServer(
                    self.sslOptions, self.app);
                self.httpsServer.listen(self.sslPort, cb);
            }
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

Server.prototype.use = function use(middleware) {
    this.middleware.push(middleware);
};

module.exports.Server = Server;