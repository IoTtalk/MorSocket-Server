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
var makeDevicesArray = function(clientArray){
    var devices = [];
    for(var i = 0; i < clientArray.length; i++){
        var sockets = [];
        for(var j = 0; j < config.maxSocketGroups; j++){
            for(var k = 0; k < config.socketStateBits; k++){
                if(clientArray[i].socketStateTable[j][k] != -1){
                    var socket = {};
                    socket["index"] = (j*config.socketStateBits+k+1);
                    socket["state"] = (clientArray[i].socketStateTable[j][k] == 1) ? true : false;
                    socket["alias"] = clientArray[i].socketAliasTable[j][k];
                    socket["disable"] = (clientArray[i].socketStateTable[j][k] == -2) ? true :false; 
                    sockets.push(socket);
                }
            }
        }
        if(clientArray[i].id != undefined){
            devices.push({
                id: clientArray[i].id,
                room: clientArray[i].room,
                sockets:sockets
            });
        }
    }
    console.log(JSON.stringify(devices));
    return devices;
};
exports.findClientByID = findClientByID;
exports.findClientIndexByID = findClientIndexByID;
exports.makeDevicesArray = makeDevicesArray;
