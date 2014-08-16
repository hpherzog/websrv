


var _ = require('underscore');
var util = require('util');
var events = require('events');
var ws = require('ws');
var uuid = require('node-uuid');
var logging = require(__dirname + "/logging.js");



var WebSocketState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
};



function WebSocket (options) {

    this.id = WebSocket.createId();

    this.socket = options.socket;

    this.socket.on('close',
        this.getCloseHandler());

    this.socket.on('error',
        this.getErrorHandler());

    this.socket.on('message',
        this.getMessageHandler());

    this.keepAliveTimer = null;

    this.keepAliveTimeout = 10000;

    this.keepAliveSendTimer = null;

    this.keepAliveSendTimeout = 6000;

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

        self.destroy();

        if(!self.closeFired) {
            self.closeFired = true;
            self.emit('close');
        }
    };
};

WebSocket.prototype.getMessageHandler = function() {

    var self = this;
    return function(message) {

        if(message === '') {
            self.logger.debug('Received keep alive from %s', self.id);
        } else {
            self.logger.debug('Received message from %s', self.id);
            self.logger.debug('Message: %s', message);
        }

        self.startKeepAliveTimer();
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

WebSocket.prototype.stopKeepAliveTimer =
    function stopKeepAliveTimer() {

        if(!_.isEmpty(this.keepAliveTimer)) {
            clearTimeout(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
};

WebSocket.prototype.startKeepAliveTimer =
    function startKeepAliveTimer() {

        var self = this;
        self.stopKeepAliveTimer();
        self.keepAliveTimer = setTimeout(function() {
                self.close();
            },
            self.keepAliveTimeout);
};

WebSocket.prototype.stopKeepAliveSendTimer =
    function stopKeepAliveSendTimer() {

        if(!_.isEmpty(this.keepAliveSendTimer)) {
            clearTimeout(this.keepAliveSendTimer);
            this.keepAliveSendTimer = null;
        }
};

WebSocket.prototype.startKeepAliveSendTimer =
    function startKeepAliveSendTimer() {

        var self = this;
        self.stopKeepAliveSendTimer();
        self.keepAliveSendTimer = setTimeout(function() {
                self.sendKeepAlive();
            },
            self.keepAliveSendTimeout);
};

WebSocket.prototype.close = function() {

    this.destroy();

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

WebSocket.prototype.destroy = function destroy() {

    this.stopKeepAliveTimer();
    this.stopKeepAliveSendTimer();

    this.socket.removeAllListeners('close');
    this.socket.removeAllListeners('error');
    this.socket.removeAllListeners('message');
};

WebSocket.prototype.sendKeepAlive = function send(done) {
    this.send('', done);
};

WebSocket.prototype.send = function send(message, done) {

    if(this.socket.readyState === WebSocketState.OPEN) {
        this.startKeepAliveSendTimer();
        this.socket.send(message, done);
    } else {
        this.logger.warn('Could not send message to ' + this.id);
    }
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

        webSocket.startKeepAliveTimer();
        webSocket.startKeepAliveSendTimer();
        webSocket.on('close', self.getCloseHandler(webSocket));

        self.webSockets[webSocket.id] = webSocket;
        self.emit('opened', webSocket);

        self.logger.info('Opened web socket ' + webSocket.id);
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
        self.logger.info('Closed web socket ' + webSocket.id);
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