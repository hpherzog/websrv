
var _ = require('underscore');
var util = require('util');
var events = require('events');
var ws = require('ws');
var uuid = require('node-uuid');
var logging = require(__dirname + "/logging.js");

/**
 * Web socket states
 * @readonly
 * @enum {number}
 */
var WebSocketState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
};


/**
 * Web socket wrapper
 * @param options {*}
 * @constructor
 */
function WebSocket (options) {

    /**
     * Web socket identifier
     */
    this.id = WebSocket.createId();

    this.socket = options.socket;
    this.socket.on('close', this.getCloseHandler());
    this.socket.on('error', this.getErrorHandler());
    this.socket.on('message', this.getMessageHandler());

    this.closeTimer = null;

    this.closeTimeout = 6000;

    this.closeFired = false;

    this.logger = options.logger;
};

util.inherits(WebSocket,
    events.EventEmitter);

WebSocket.createId = function createId() {
    return uuid.v4();
};

WebSocket.prototype.getCloseHandler = function() {

    var self = this;
    return function() {
        if(!self.closeFired) {
            self.closeFired = true;
            self.emit('close');
        }
    };
};

WebSocket.prototype.getMessageHandler = function() {

    var self = this;
    return function(message) {
        self.logger.debug('Received message from ' + self.id);
        self.logger.debug(message);
        self.startCloseTimer();
        self.emit('message', message);
    }
};

WebSocket.prototype.getErrorHandler = function() {

    var self = this;
    return function(err) {
        self.logger.error(err.stack);
        self.emit('error', err);
    }
};

WebSocket.prototype.stopCloseTimer = function stopCloseTimer() {

    if(!_.isEmpty(this.closeTimer)) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }
};

WebSocket.prototype.startCloseTimer = function startCloseTimer() {

    var self = this;
    self.stopCloseTimer();
    self.closeTimer = setTimeout(function() {
            self.close();
        },
        self.closeTimeout);
};

WebSocket.prototype.close = function() {

    if(this.socket.readyState === WebSocketState.OPEN) {
        this.socket.close();
    } else {
        this.socket.terminate();
    }

    if(!this.closeFired) {
        this.closeFired = true;
        this.emit('close');
    }

};

WebSocket.prototype.send = function send(message, done) {
    this.socket.send(message, done);
};


function WebSocketServer (options) {

    this.webSocketServer = new ws.Server({
        server: options.server
    });

    this.webSocketServer.on('connection',
        this.getConnectionHandler());

    this.webSockets = {};

    this.defaultLoggerName = 'Wss';

    if(options.logger === void(0)) {
        options.logger = logging.getLogger(this.defaultLoggerName);
        logging.setLevel(this.defaultLoggerName, "info");
    }

    this.logger = options.logger;
};

util.inherits(WebSocketServer,
    events.EventEmitter);

WebSocketServer.prototype.getConnectionHandler = function getConnectionHandler() {

    var self = this;
    return function(socket) {

        var webSocket = new WebSocket({
            socket: socket,
            logger: self.logger
        });
        webSocket.startCloseTimer();
        webSocket.on('close', self.getCloseHandler(webSocket));
        self.webSockets[webSocket.id] = webSocket;
        self.logger.debug('Added web socket ' + webSocket.id);
        self.emit('connection', webSocket);
    };
};

/**
 * Handles the close event of a single web socket.
 * @param webSocket
 * @returns {Function}
 */
WebSocketServer.prototype.getCloseHandler = function getCloseHandler(webSocket) {

    var self = this;
    return function() {
        delete self.webSockets[webSocket.id];
        self.logger.debug('Removed web socket ' + webSocket.id);
    };
};

WebSocketServer.prototype.getErrorHandler = function getErrorHandler() {

    var self = this;
    return function(err) {
        self.logger.error(err.stack);
        self.emit('error', err);
    }
};

module.exports.WebSocket = WebSocket;
module.exports.WebSocketServer = WebSocketServer;
module.exports.WebSocketState = WebSocketState;