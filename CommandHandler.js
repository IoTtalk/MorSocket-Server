/**
 * Created by kuan on 2017/11/22.
 */

var config = require('./Config');

var CommandHandler = function(sendCmdSem){
    this.sendCmdSem = sendCmdSem;
};

CommandHandler.prototype.integerToHexString = function (d) {
    return ((d < 16) ? ('0') : '') + (d.toString(16)).slice(-2).toUpperCase();
};

CommandHandler.prototype.hexToBytes = function(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;

};

CommandHandler.prototype.sendOnOffCommand = function(socketIndex, state, client){
    socketIndex = parseInt(socketIndex);
    socketIndex--;

    var op = config.OPCode[0],
        gid = Math.floor(socketIndex / config.socketStateBits),

        /*  socket position
         0 represent right: 00000001
         1 represent left:00000010
         */
        pos = socketIndex % config.socketStateBits,
        channel = 0,
        rw = 1,
        buffer,
        command,
        cmdByteArr;

    /* offline, command not send*/
    if(client.socketStateTable[gid][pos] == -1){
        console.log('offline command not send!');
        return;
    }

    var posArr = client.socketStateTable[gid].slice();
    posArr[pos] = Number(state);
    //client.socketStateTable[gid][pos] = Number(state);
    state = parseInt(posArr.reverse().join(''), 2);

    command = op + this.integerToHexString(gid) + this.integerToHexString(rw)
        + this.integerToHexString(state) + this.integerToHexString(channel);

    cmdByteArr = this.hexToBytes(command);

    buffer = new Buffer(cmdByteArr);
    var sendCmdSem = this.sendCmdSem;
    sendCmdSem.take(function () {
        console.log('sendOnOffCommand: ' + command);
        client.write(buffer);
        sendCmdSem.leave();
    });

};

CommandHandler.prototype.sendReadStateCommand = function(gid, client){

    var op = config.OPCode[0],
        state = 0,
        channel = 0,
        rw = 0,
        buffer,
        command,
        cmdByteArr;

    command = op + this.integerToHexString(gid) + this.integerToHexString(rw)
        + this.integerToHexString(state) + this.integerToHexString(channel);

    cmdByteArr = this.hexToBytes(command);

    buffer = new Buffer(cmdByteArr);
    var sendCmdSem = this.sendCmdSem;
    sendCmdSem.take(function () {
        console.log('sendReadStateCommand: ' + command);
        client.write(buffer);
        sendCmdSem.leave();
    });
};

exports.CommandHandler = CommandHandler;