
var client = new websrv.Client({
    url: 'wss://websrv:8433'
});

client.on('online', function() {
    console.log('Client online');
});

client.on('connecting', function() {
    console.log('Client connecting');
});

client.on('alive', function() {
    console.log('Client alive');
});

client.on('offline', function() {
    console.log('Client offline');
});

client.on('error', function() {
});

client.open();