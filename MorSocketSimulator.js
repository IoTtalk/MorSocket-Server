var net = require('net');
var HOST = '140.113.215.17';
var PORT = 7654;


var client = new net.Socket();
client.connect(PORT, HOST, function() {
    console.log('CONNECTED TO: ' + HOST + ':' + PORT);
});
var hexToBytes = function(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;

};
var i = 0;
client.on('data', function(data) {
	var cmd = data.toString('hex').toUpperCase();
    var op = cmd.substring(0, 2);
    console.log(op);
    if(op == "C2"){
    	var command;
    	if(i&1)
    		command = "B3"+cmd.substring(2,4)+"03";
    	else
    		command ="E1";
    	i++;
    	var cmdByteArr = hexToBytes(command);

    	buffer = new Buffer(cmdByteArr);
		client.write(buffer);
	}
});