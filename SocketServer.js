'use strict';
var os = require('os'),
    net = require('net'),
    shortID = require('shortid'),
    config = require('./Config'),
    dai = require('./DAI').dai,
    bodyParser = require('body-parser'),
    json_body_parser = bodyParser.json(),
    express = require('express'),
    api = express(),
    sendCmdSem = require('semaphore')(1),
    mqtt = require('mqtt'),
    mqttClient = mqtt.connect('mqtt://127.0.0.1'),
    JsonDB = require('node-json-db'),
    db = new JsonDB("MorSocketDeviceDB", true, true);

api.use(json_body_parser);

// publish
const deviceInfoTopic = "DeviceInfo";
const devicesInfoTopic = "DevicesInfo";
// subscribe
const setupDeviceRoomTopic = "SetupDeviceRoom";
const syncDeviceInfoTopic = "SyncDeviceInfo";
const switchTopic = "Switch";
const aliasTopic = "Alias";


var clientArray = [];
var integerToHexString = function (d) {
    return ((d < 16) ? ('0') : '') + (d.toString(16)).slice(-2).toUpperCase();
};

var hexToBytes = function(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;

};

var sendOnOffCommand = function(socketIndex, state, client){
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

    command = op + integerToHexString(gid) + integerToHexString(rw)
        + integerToHexString(state) + integerToHexString(channel);

    cmdByteArr = hexToBytes(command);

    buffer = new Buffer(cmdByteArr);
    sendCmdSem.take(function () {
        console.log('sendOnOffCommand: ' + command);
        client.write(buffer);
        sendCmdSem.leave();
    });


};
var sendReadStateCommand = function(gid, client){

    var op = config.OPCode[0],
        state = 0,
        channel = 0,
        rw = 0,
        buffer,
        command,
        cmdByteArr;

    command = op + integerToHexString(gid) + integerToHexString(rw)
        + integerToHexString(state) + integerToHexString(channel);

    cmdByteArr = hexToBytes(command);

    buffer = new Buffer(cmdByteArr);

    sendCmdSem.take(function () {
        console.log('sendReadStateCommand: ' + command);
        client.write(buffer);
        sendCmdSem.leave();
    });
};

var socketServer;
mqttClient.on('connect',function(){

    /********for testing****************************************/
    // var dan = require("./DAN").dan();
    // setInterval(function(){
    //     dan.init(function(){}, config.IoTtalkIP , shortID.generate(), {
    //         'dm_name': 'MorSocket',
    //         'd_name' : shortID.generate()+'.MorSocket',
    //         'u_name': 'yb',
    //         'is_sim': false,
    //         'df_list': ['Socket1']
    //     },function(result){
    //         console.log('register:', result);
    //     })
    // },5);
    // process.on('uncaughtException', function (err) {
    //     console.log('Caught exception: ' + err);
    // });

    // var client = {};
    // clientArray.push(client);
    // console.log(clientArray.length);
    // client.id = "f119d466";
    // try {
    //     client.room = db.getData("/room_" + client.id);
    // }catch(error){
    //     client.room = "Others";
    // }
    // /* init socketStateTable table */
    // client.socketStateTable = new Array(config.maxSocketGroups);
    // for(var i = 0; i < config.maxSocketGroups; i++)
    //     client.socketStateTable[i] = new Array(config.socketStateBits).fill(-1);
    // client.socketStateTable[0][0] = 1;
    // client.socketStateTable[0][1] = 1;
    // client.socketStateTable[1][0] = 0;
    // client.socketStateTable[1][1] = 0;
    // client.socketStateTable[2][0] = 0;
    // client.socketStateTable[2][1] = 0;
    // client.socketStateTable[3][0] = 0;
    // client.socketStateTable[3][1] = 0;
    // try {
    //     client.socketAliasTable = db.getData("/"+client.id);
    //     console.log(socketAliasTable);
    // }
    // catch (error){
    //     client.socketAliasTable = new Array(config.maxSocketGroups);
    //     for(var i = 0; i < config.maxSocketGroups; i++)
    //         client.socketAliasTable[i] = new Array(config.socketStateBits).fill(null);
    // }
    // mqttClient.publish(deviceInfoTopic, JSON.stringify({
    //     id:client.id,
    //     room:client.room,
    //     sockets:[{
    //         index:1,
    //         state:true,
    //         alias:client.socketAliasTable[0][0]
    //     },{
    //         index:2,
    //         state:true,
    //         alias:client.socketAliasTable[0][1]
    //     },{
    //         index:3,
    //         state:false,
    //         alias:client.socketAliasTable[1][0]
    //     },{
    //         index:4,
    //         state:false,
    //         alias:client.socketAliasTable[1][1]
    //     },{
    //         index:5,
    //         state:false,
    //         alias:client.socketAliasTable[2][0]
    //     },{
    //         index:6,
    //         state:false,
    //         alias:client.socketAliasTable[2][1]
    //     },{
    //         index:7,
    //         state:false,
    //         alias:client.socketAliasTable[3][0]
    //     },{
    //         index:8,
    //         state:false,
    //         alias:client.socketAliasTable[3][1]
    //     }]
    // }));
    // client.dai = dai(client);
    // client.dai.register();
    // return;
    /********for testing************************************/

    mqttClient.subscribe(syncDeviceInfoTopic);
    mqttClient.subscribe(switchTopic);
    mqttClient.subscribe(aliasTopic);

    socketServer = (function () {

        var tcpServer = net.createServer(function (client) {

            /* debug message */
            console.log('connected: ' + client.remoteAddress + ':' + client.remotePort);
            clientArray.push(client);
            console.log(clientArray.length);

            /* will retrieve from client in later version */
            // client.id = shortID.generate();
            client.id = "f119d466";
            /* mqttPublisher will be use to publish data to MorSocket APP when register */
            client.mqttClient = mqttClient;

            /* init socketStateTable table */
            client.socketStateTable = new Array(config.maxSocketGroups);
            for(var i = 0; i < config.maxSocketGroups; i++)
                client.socketStateTable[i] = new Array(config.socketStateBits).fill(-1);
            /* init socketAliasTable table */
            try {
                client.socketAliasTable = db.getData("/"+client.id);
            }
            catch (error){
                client.socketAliasTable = new Array(config.maxSocketGroups);
                for(var i = 0; i < config.maxSocketGroups; i++)
                    client.socketAliasTable[i] = new Array(config.socketStateBits).fill(null);
            }
            /* setup socket room */
            try {
                client.room = db.getData("/room_"+client.id);
            }
            catch (error){
                client.room = "Others";
            }
            /* construct sendOnOffCommand function for this client */
            client.sendOnOffCommand = function(socketIndex, state){
                sendOnOffCommand(socketIndex, state, client);
            };

            /* init DAI of the client */
            client.dai = dai(client);

            /* current polling gid */
            var currentGid = 0;

            /* use to indicate whether socketStateTable has been changed */
            var triggerRegister = false;

            /* start polling socket state */
            sendReadStateCommand(currentGid, client);

            /* command received */
            client.on('data', function(cmd){
                cmd = cmd.toString('hex').toUpperCase();
                var op = cmd.substring(0, 2);
                console.log(op);
                switch(op){

                    case config.OPCode[1]: //B3

                        /* client state has changed, trigger register */
                        if(client.socketStateTable[currentGid][0] == -1)
                            triggerRegister = true;

                        /* update socketStateTable of client */
                        var cmdGid = parseInt(cmd.substring(2, 4), 16), // should be equal to currentGid
                            cmdState = parseInt(cmd.substring(4, 6), 16).toString(2).split('').reverse();
                        for(var i = 0; i < config.socketStateBits; i++)
                            client.socketStateTable[cmdGid][i] = (cmdState.length > i) ?
                                cmdState[i] : 0;
                        console.log(currentGid);
                        break;

                    case config.OPCode[2]: //E1
                        ///console.log(currentGid);
                        /* client state has changed, trigger register */
                        if(client.socketStateTable[currentGid][0] != -1)
                            triggerRegister = true;

                        /* update socketStateTable of client */
                        for(var i = 0; i < config.socketStateBits; i++)
                            client.socketStateTable[currentGid][i] = -1;
                        break;

                    default:
                        console.log('from client: ' + client.remoteAddress + 'gid: ' +
                            currentGid + ' reply unknow cmd: ' + cmd);
                        break;

                }
                if(currentGid == cmdGid || cmdGid == undefined) {
                    if (currentGid == config.maxSocketGroups - 1) {
                        if (triggerRegister)
                            client.dai.register();
                        /* start over again */
                        currentGid = -1;
                        triggerRegister = false;
                        console.log(client.socketStateTable);
                        //sendCmdSem.leave();
                        //return;
                    }
                    //setTimeout(function () {
                    sendReadStateCommand(++currentGid, client);
                    //},2000);
                    //console.log('client:' + client.remoteAddress + ' receive:' + cmd);
                }
                //sendCmdSem.leave();
            });
            /*client.setTimeout(10000);
             client.on('timeout', function(){
             console.log('socket timeout');
             client.end();
             var removeIndex = -1;
             for(var i = 0; i < clientArray.length; i++){
             if(this.id == clientArray[i].id){
             removeIndex = i;
             }
             }
             if(removeIndex != -1)
             clientArray.splice(removeIndex, 1);
             console.log('disconnected');
             });*/

        });
        tcpServer.listen(config.socketServerPort, '0.0.0.0');
    })();
});
var findClientByID = function(clientID){
    var client = null;
    for(var i = 0; i < clientArray.length; i++){
        if(clientArray[i].id == clientID){
            client = clientArray[i];
        }
    }
    return client;
};
mqttClient.on('message', function (topic, message) {
    if(topic == syncDeviceInfoTopic){
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
                        sockets.push(socket);
                    }
                }
            }
            var device = {
                id: clientArray[i].id,
                room: clientArray[i].room,
                sockets:sockets
            };
            devices.push(device);
        }
        mqttClient.publish(devicesInfoTopic, JSON.stringify({
            devices: devices
        }));
        console.log(JSON.stringify(devices));
    }
    else if(topic == switchTopic){
        var data = JSON.parse(message);
        console.log(data);
        var client = findClientByID(data["id"]);
        if(client){
            console.log(data["index"]+ " " + data["state"]);
            client.sendOnOffCommand(data["index"], data["state"]);
        }
        else{
            console.log("device not exist!");
        }
    }
    else if(topic == aliasTopic){
        var data = JSON.parse(message);
        /*{
            id: string,
            index: num,
            alias: string
          }
         */
        var client = findClientByID(data["id"]);
        if(client){
            console.log(data["index"]+ " " + data["alias"]);
            var index = parseInt(data["index"])-1,
                gid = Math.floor(index / config.socketStateBits),
                pos = index % config.socketStateBits;
            console.log(gid + " " + pos);
            client.socketAliasTable[gid][pos] = data["alias"];
            db.push("/"+client.id, client.socketAliasTable, true);
        }
        else{
            console.log("device not exist!");
        }
    }

});
api.listen(config.webServerPort);
api.post('/' + setupDeviceRoomTopic, function (req, res) {
    var data = req.body;
    /*{
        id: string,
        location: string
      }
    */
    console.log(data);
    db.push("/room_"+data["id"], data["location"], true);
    res.end("ok");
});




exports.socketServer = socketServer;
