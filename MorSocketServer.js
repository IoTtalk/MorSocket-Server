'use strict';
var /* For create tcp server */
    net = require('net'),
    /* For generate MorSocket ID */
    shortID = require('shortid'),
    /* Load configure constant */
    config = require('./Config'),
    /* Load IoTtalk  module */
    dai = require('./DAI').dai,
    csmapi = require('./CSMAPI').csmapi,
    /* For HTTP RESTful API*/
    bodyParser = require('body-parser'),
    json_body_parser = bodyParser.json(),
    express = require('express'),
    api = express(),
    /* For MQTT API */
    mqttTopic = require('./MqttTopic'),
    mqtt = require('mqtt'),
    mqttClient = mqtt.connect(config.MQTTIP),
    /* For socket server local database */
    JsonDB = require('node-json-db'),
    db = new JsonDB("MorSocketDeviceDB", true, true),
    /* For send commands and make commands mutual exclusive */
    semaphore = require('semaphore'),
    commandHandler = require('./CommandHandler').CommandHandler,
    /* Record all connected MorSocket clients */
    clientArray = [];

var findClientByID = function(clientID){
    var client = null;
    for(var i = 0; i < clientArray.length; i++){
        if(clientArray[i].id == clientID){
            client = clientArray[i];
            break;
        }
    }
    return client;
};
var findClientIndexByID = function(clientID){
    var index = -1;
    for(var i = 0; i < clientArray.length; i++){
        if(clientArray[i].id == clientID){
            index = i;
            break;
        }
    }
    return index;
};
var makeDevicesArray = function(){
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
    console.log(JSON.stringify(devices));
    return devices;
};

mqttClient.on('connect',function(){

    /********For testing****************************************/
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
    /********For testing************************************/

    mqttClient.subscribe(mqttTopic.syncDeviceInfoTopic);
    mqttClient.subscribe(mqttTopic.switchTopic);
    mqttClient.subscribe(mqttTopic.aliasTopic);

    /* socket server start */
    try {
        (function () {

            var tcpServer = net.createServer(function (client) {

                var sendCmdSem = semaphore(1),
                    cmdHandler = new commandHandler(sendCmdSem);

                /* Debug message */
                console.log('connected: ' + client.remoteAddress + ':' + client.remotePort);
                clientArray.push(client);
                console.log(clientArray.length);

                /* Will retrieve from client in later version */
                // client.id = shortID.generate();
                client.id = "f119d466";
                /* MqttPublisher will be use to publish data to MorSocket APP when register */
                client.mqttClient = mqttClient;

                /* Init socketStateTable table */
                client.socketStateTable = new Array(config.maxSocketGroups);
                for (var i = 0; i < config.maxSocketGroups; i++)
                    client.socketStateTable[i] = new Array(config.socketStateBits).fill(-1);
                /* Init socketAliasTable table */
                try {
                    client.socketAliasTable = db.getData("/" + client.id);
                }
                catch (error) {
                    client.socketAliasTable = new Array(config.maxSocketGroups);
                    for (var i = 0; i < config.maxSocketGroups; i++)
                        client.socketAliasTable[i] = new Array(config.socketStateBits).fill(null);
                }
                /* Setup socket room */
                try {
                    client.room = db.getData("/room_" + client.id);
                }
                catch (error) {
                    client.room = "Others";
                }
                /* Construct sendOnOffCommand function for this client */
                client.sendOnOffCommand = function (socketIndex, state) {
                    cmdHandler.sendOnOffCommand(socketIndex, state, client);
                };

                /* Init DAI of the client */
                client.dai = dai(client);

                /* Current polling gid */
                var currentGid = 0;

                /* Use to indicate whether socketStateTable has been changed */
                var triggerRegister = false;

                /* Start polling socket state */
                cmdHandler.sendReadStateCommand(currentGid, client);

                /* Command received */
                client.on('data', function (cmd) {
                    cmd = cmd.toString('hex').toUpperCase();
                    var op = cmd.substring(0, 2);
                    console.log(op);
                    switch (op) {

                        case config.OPCode[1]: //B3

                            /* Client state has changed, trigger register */
                            if (client.socketStateTable[currentGid][0] == -1)
                                triggerRegister = true;

                            /* Update socketStateTable of client */
                            var cmdGid = parseInt(cmd.substring(2, 4), 16), // should be equal to currentGid
                                cmdState = parseInt(cmd.substring(4, 6), 16).toString(2).split('').reverse();
                            for (var i = 0; i < config.socketStateBits; i++)
                                client.socketStateTable[currentGid][i] = (cmdState.length > i) ?
                                    cmdState[i] : 0;
                            console.log(currentGid);
                            break;

                        case config.OPCode[2]: //E1
                            /* Client state has changed, trigger register */
                            if (client.socketStateTable[currentGid][0] != -1)
                                triggerRegister = true;

                            /* Update socketStateTable of client */
                            for (var i = 0; i < config.socketStateBits; i++)
                                client.socketStateTable[currentGid][i] = -1;
                            break;

                        default:
                            console.log('from client: ' + client.remoteAddress + 'gid: ' +
                                currentGid + ' reply unknow cmd: ' + cmd);
                            break;

                    }
                    if (currentGid == cmdGid || cmdGid == undefined) {
                        if (currentGid == config.maxSocketGroups - 1) {
                            if (triggerRegister)
                                client.dai.register();
                            /* Start over again */
                            currentGid = -1;
                            triggerRegister = false;
                            console.log(client.socketStateTable);
                        }
                        //setTimeout(function(){cmdHandler.sendReadStateCommand(++currentGid, client);}, 2000);
                        cmdHandler.sendReadStateCommand(++currentGid, client);
                    }
                });
                /* Timeout event for detect MorSocket power off */
                client.setTimeout(5000);
                client.on('timeout', function () {
                    console.log('timeout');
                    clientArray.splice(findClientIndexByID(client.id), 1);
                    client.dai.deregister();
                    client.end();
                    /* publish devicesInfoTopic */
                    mqttClient.publish(mqttTopic.devicesInfoTopic, JSON.stringify({
                        devices: makeDevicesArray()
                    }));
                });
                /* Catch socket error */
                client.on("error", function (err) {
                    console.log("Caught socket error: ")
                    console.log(err.stack)
                });
            });
            tcpServer.listen(config.socketServerPort, '0.0.0.0');
        })();
    }catch (error){
        console.log(error);
    }

});


/* MorSocket Server MQTT API */
mqttClient.on('message', function (topic, message) {
    if(topic == mqttTopic.syncDeviceInfoTopic){
        mqttClient.publish(mqttTopic.devicesInfoTopic, JSON.stringify({
            devices: makeDevicesArray()
        }));
    }
    else if(topic == mqttTopic.switchTopic){
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
    else if(topic == mqttTopic.aliasTopic){
        var data = JSON.parse(message);
        var client = findClientByID(data["id"]);
        if(client){
            console.log(data["index"]+ " " + data["alias"]);
            var index = parseInt(data["index"])-1,
                gid = Math.floor(index / config.socketStateBits),
                pos = index % config.socketStateBits;
            console.log(gid + " " + pos);
            client.socketAliasTable[gid][pos] = data["alias"];
            db.push("/"+client.id, client.socketAliasTable, true);
            var df_name = "Socket" + (index+1);
            console.log(df_name);
            csmapi.set_alias(client.id, df_name, (index+1) + ":" + data["alias"]);
        }
        else{
            console.log("device not exist!");
        }
    }


});

/* MorSocket Server RESTful API */
api.use(json_body_parser);
api.listen(config.webServerPort);
api.post('/' + mqttTopic.setupDeviceRoomTopic, function (req, res) {
    var data = req.body;
    console.log(data);
    db.push("/room_"+data["id"], data["location"], true);
    res.end("ok");
});
