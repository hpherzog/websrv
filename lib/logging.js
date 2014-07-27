
var crypto = require('crypto');
var winston = require('winston');

var loggers = {};

var makeId = function makeId(name) {
    return crypto
        .createHash('sha1')
        .update(name.toLowerCase())
        .digest('hex');
};

module.exports.setLevel = function setOption(label, level) {

    var id = makeId(label);

    if(loggers[id] === void(0)) {
        loggers[id].level = level;
    }
};

module.exports.getLogger = function getLogger(label) {

    var id = makeId(label);

    if(loggers[id] === void(0)) {
        loggers[id] = new winston.Logger({
            transports: [
                new winston.transports.Console({
                    level: 'debug',
                    colorize: 'true',
                    label: label,
                    timestamp: true
                })
            ]
        });
    }

    return loggers[id];
};