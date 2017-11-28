/**
 * Created by kuan on 2017/11/22.
 */

var config = require('./Config');

var CommandHandler = function(sendCmdSem){
    /* mutual exclusive the request commands */
    this.sendCmdSem = sendCmdSem;
    /* use to record current request command gid */
    this.requestGid = -1;
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
        cmdByteArr,
        parent = this;

    parent.sendCmdSem.take(function () {
        /* offline, command not send*/
        if(client.socketStateTable[gid][pos] == -1){
            console.log('offline command not send!');
            return;
        }
        var posArr = client.socketStateTable[gid].slice();
        posArr[pos] = (Number(state) != 0) ? 1 : 0;
        state = parseInt(posArr.reverse().join(''), 2);
        command = op + parent.integerToHexString(gid) + parent.integerToHexString(rw)
            + parent.integerToHexString(state) + parent.integerToHexString(channel);
        cmdByteArr = parent.hexToBytes(command);
        buffer = new Buffer(cmdByteArr);
        parent.requestGid = gid;
        console.log('sendOnOffCommand: ' + command);
        client.write(buffer);
    });

};

CommandHandler.prototype.sendReadStateCommand = function(gid, client){

    var op = config.OPCode[0],
        state = 0,
        channel = 0,
        rw = 0,
        buffer,
        command,
        cmdByteArr,
        parent = this;
    parent.sendCmdSem.take(function () {
        command = op + parent.integerToHexString(gid) + parent.integerToHexString(rw)
            + parent.integerToHexString(state) + parent.integerToHexString(channel);
        cmdByteArr = parent.hexToBytes(command);
        buffer = new Buffer(cmdByteArr);
        console.log('sendReadStateCommand: ' + command);
        parent.requestGid = gid;
        client.write(buffer);
    });
};

exports.CommandHandler = CommandHandler;