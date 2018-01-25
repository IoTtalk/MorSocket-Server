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
    clientArray = [],
    /* Get IoTtalkIP from external */
    IoTtalkIP = process.argv[2],
    /* Record setup device room data from setupDeviceRoomTopic */
    setupDeviceRoom = null;

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

mqttClient.on('connect',function(){

    mqttClient.subscribe(mqttTopic.syncDeviceInfoTopic);
    mqttClient.subscribe(mqttTopic.switchTopic);
    mqttClient.subscribe(mqttTopic.switchDisableTopic);
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

                /* Retrieve client BEL MAC address */
                cmdHandler.sendReadBleMacCommand(client);

                /* MqttPublisher will be use to publish data to MorSocket APP when register */
                client.mqttClient = mqttClient;

                /* Init socketStateTable table */
                client.socketStateTable = new Array(config.maxSocketGroups);
                for (var i = 0; i < config.maxSocketGroups; i++)
                    client.socketStateTable[i] = new Array(config.socketStateBits).fill(-1);


                /* Construct sendOnOffCommand function for this client */
                client.sendOnOffCommand = function (socketIndex, state) {
                    cmdHandler.sendOnOffCommand(socketIndex, state, client);
                };

                /* Init DAI of the client */
                client.dai = dai(client, IoTtalkIP);

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
                    var requestGid = cmdHandler.requestGid;
                    console.log(op);
                    switch (op) {

                        case config.OPCode[2]: //B3

                            /* Update socketStateTable of client */
                            var responseGid = parseInt(cmd.substring(2, 4), 16),
                                cmdState = parseInt(cmd.substring(4, 6), 16).toString(2).split('').reverse();
                            if(responseGid != requestGid){
                                console.log('response command Gid is not match request command Gid');
                                return;
                            }
                            /* Client state has changed, trigger register */
                            if (client.socketStateTable[requestGid][0] == -1)
                                triggerRegister = true;
                            for (var i = 0; i < config.socketStateBits; i++){
                                if(client.socketStateTable[requestGid][i] != -2){
									client.socketStateTable[requestGid][i] = (cmdState.length > i) ?
                                    	parseInt(cmdState[i]) : 0;
								}
							}
                            console.log('requestGid: ' + requestGid);
                            break;

                        case config.OPCode[3]: //E1
                            requestGid = cmdHandler.requestGid;
                            /* Client state has changed, trigger register */
                            if (client.socketStateTable[requestGid][0] != -1)
                                triggerRegister = true;

                            /* Update socketStateTable of client */
                            for (var i = 0; i < config.socketStateBits; i++)
                                client.socketStateTable[requestGid][i] = -1;
                            break;

                        case config.OPCode[1]: //C3:
                            client.id = cmd.substring(2, 14);                
                            console.log("MAC address: " + cmd.substring(2,14));
                            if(setupDeviceRoom != null){
                                db.push("/room_" + client.id, setupDeviceRoom["location"], true);
                                setupDeviceRoom = null;
                            }
                            else
                                console.log("setup device room error");

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
                            break;

                        default:
                            console.log('from client: ' + client.remoteAddress + 'gid: ' +
                                requestGid + ' reply unknow cmd: ' + cmd);
                            break;

                    }
                    if (currentGid == requestGid) {
                        if (currentGid == config.maxSocketGroups - 1) {
                            if (triggerRegister)
                                client.dai.register();
                            /* Start over again */
                            currentGid = -1;
                            triggerRegister = false;
                            console.log(client.socketStateTable);
                        }
                        cmdHandler.sendReadStateCommand(++currentGid, client);
                    }
                    else {
                        if (triggerRegister)
                            client.dai.register();
                        /* Continued */
                        triggerRegister = false;
                        console.log(client.socketStateTable);
                    }
                    setTimeout(cmdHandler.sendCmdSem.leave,1000);
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
    else if(topic == mqttTopic.switchDisableTopic){
        var data = JSON.parse(message),
            client = findClientByID(data["id"]),
            index = parseInt(data["index"]) - 1,
            gid = Math.floor(index / config.socketStateBits),
            pos = index % config.socketStateBits;
        console.log(data["index"]+ " disable: " + data["disable"]);
        if(client){
            if(data["disable"]){
                client.socketStateTable[gid][pos] = -2;
				console.log(gid+" " + pos);
				console.log(client.socketStateTable);
			}
            else
                client.socketStateTable[gid][pos] = 0;
            client.dai.register();
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
    setupDeviceRoom = data;
//    db.push("/room_"+data["id"], data["location"], true);
    res.end("ok");
});
