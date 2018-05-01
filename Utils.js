var config = require('./Config.js');
var findClientByID = function(clientArray, clientID){
    var client = null;
    for(var i = 0; i < clientArray.length; i++){
        if(clientArray[i].id == clientID){
            client = clientArray[i];
            break;
        }
    }
    return client;
};
var findClientIndexByID = function(clientArray, clientID){
    var index = -1;
    for(var i = 0; i < clientArray.length; i++){
        if(clientArray[i].id == clientID){
            index = i;
            break;
        }
    }
    return index;
};
var makeDeviceObjectList = function(morSocketArray){
    var devices = [];
    for(var i = 0; i < morSocketArray.length; i++){
        var sockets = [];
        for(var j = 0; j < config.maxSocketGroups; j++){
            for(var k = 0; k < config.socketStateBits; k++){
                if(morSocketArray[i].socketStateTable[j][k] != -1){
                    var socket = {};
                    socket["index"] = (j*config.socketStateBits+k+1);
                    socket["state"] = (morSocketArray[i].socketStateTable[j][k] == 1);
                    socket["alias"] = morSocketArray[i].socketAliasTable[j][k];
                    socket["disable"] = (morSocketArray[i].socketStateTable[j][k] == -2);
                    sockets.push(socket);
                }
            }
        }
        if(morSocketArray[i].id != undefined){
            devices.push({
                id: morSocketArray[i].id,
                room: morSocketArray[i].room,
                sockets:sockets
            });
        }
    }
    console.log(JSON.stringify(devices));
    return devices;
};
var makeSocketObjectList = function(morSocket){
    var socketList = [];
    for(var i = 0; i < morSocket.socketStateTable.length; i++){
        var states = morSocket.socketStateTable[i].length;
        for(var j = 0; j < states; j++){
            if(morSocket.socketStateTable[i][j] != -1)
                socketList.push((i*states+(j+1) >= 10) ? (i*states+(j+1)).toString() : "0" + (i*states+(j+1)).toString());
        }
    }
    var socketObjectList = [];
    for(var i = 0; i < socketList.length; i++){
        var index = parseInt(socketList[i])-1,
            gid = Math.floor(index / config.socketStateBits),
            pos = index % config.socketStateBits,
            s = {
                index: parseInt(socketList[i]),
                state: (morSocket.socketStateTable[gid][pos] == 1),
                alias: morSocket.socketAliasTable[gid][pos],
                disable: (morSocket.socketStateTable[gid][pos] == -2)
            };
        socketObjectList.push(s);
    }
    return socketObjectList;
};
var makeSocketObject = function(morSocket, i){
    var index = parseInt(i) -1,
        gid = Math.floor(index / config.socketStateBits),
        pos = index % config.socketStateBits,
        socketObject = {
            index: parseInt(i),
            state: (morSocket.socketStateTable[gid][pos] == 1),
            alias: morSocket.socketAliasTable[gid][pos],
            disable: (morSocket.socketStateTable[gid][pos] == -2)
        };
    return [socketObject];
}
var makeOdfList = function(morSocket){
    var odfList = [];
    for(var i = 0; i < morSocket.socketStateTable.length; i++){
        var states = morSocket.socketStateTable[i].length;
        for(var j = 0; j < states; j++){
            if(morSocket.socketStateTable[i][j] >= 0)
                odfList.push('Socket' + (i*states+(j+1)));
        }
    }
    return odfList;
};

exports.findClientByID = findClientByID;
exports.findClientIndexByID = findClientIndexByID;
exports.makeDeviceObjectList= makeDeviceObjectList;
exports.makeOdfList = makeOdfList;
exports.makeSocketObject = makeSocketObject;
exports.makeSocketObjectList = makeSocketObjectList;
