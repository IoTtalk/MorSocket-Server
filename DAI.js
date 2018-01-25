
var config = require("./Config"),
    mqttTopic = require('./MqttTopic');
var dai = function (morSocket, IoTtalkIP) {

    var dan = require("./DAN").dan();
    var deregister = function(){
        dan.deregister();
    };
    var register = function(){
        var macAddr = morSocket.id;
        var odf_list = [];
        var s_list = [];

        console.log('mac address:' + macAddr);
        var setAliases = function(){
            for(var i = 0; i < odf_list.length; i++){
                var index = parseInt(odf_list[i].replace("Socket", ""))-1,
                    gid = Math.floor(index / config.socketStateBits),
                    pos = index % config.socketStateBits;
                console.log(gid+" "+pos+" "+morSocket.socketAliasTable[gid][pos]);
                if(morSocket.socketAliasTable[gid][pos] == null)
                    dan.set_alias(odf_list[i], (index+1));
                else
                    dan.set_alias(odf_list[i], (index+1) + ":" + morSocket.socketAliasTable[gid][pos]);
            }
        };
        var pull = function (odf_name, data) {
            console.log(odf_name + ':' + data);
            if(odf_name.startsWith('Socket')){
                var socketIndex = odf_name.replace('Socket','');
                morSocket.sendOnOffCommand(socketIndex, data);
            }
            else if(odf_name == "Control"){
                if(data[0] == "SET_DF_STATUS"){
                    setAliases();
                }
            }
        };
        for(var i = 0; i < morSocket.socketStateTable.length; i++){
            var states = morSocket.socketStateTable[i].length;
            for(var j = 0; j < states; j++){
                if(morSocket.socketStateTable[i][j] >= 0){
                    odf_list.push('Socket' + (i*states+(j+1)));
                    s_list.push((i*states+(j+1) >= 10) ? (i*states+(j+1)).toString() : "0" + (i*states+(j+1)).toString());
                }
                else if(morSocket.socketStateTable[i][j] == -2){
                    s_list.push((i*states+(j+1) >= 10) ? (i*states+(j+1)).toString() : "0" + (i*states+(j+1)).toString());
                }   
            }
        }

        console.log(odf_list);
        if(odf_list.length == 0) {
            dan.deregister();
            return;
        }
        IoTtalkIP = (IoTtalkIP == undefined) ? config.IoTtalkIP : IoTtalkIP;
        dan.init(pull, IoTtalkIP , macAddr, {
            'dm_name': 'MorSocket',
            'd_name' : macAddr,
            'u_name': 'yb',
            'is_sim': false,
            'df_list': odf_list

        }, function (result) {
            console.log('register:', result);
            setAliases();
            var list = [];
            for(var i = 0; i < s_list.length; i++){
                var index = parseInt(s_list[i])-1;
                var gid = Math.floor(index / config.socketStateBits);
                var pos = index % config.socketStateBits;
                var s = {
                    index: parseInt(s_list[i]),
                    state: (morSocket.socketStateTable[gid][pos] == 1),
                    alias: morSocket.socketAliasTable[gid][pos],
                    disable: (morSocket.socketStateTable[gid][pos] == -2)
                };
                list.push(s);
            }

            morSocket.mqttClient.publish(mqttTopic.deviceInfoTopic, JSON.stringify({
                id:morSocket.id,
                room: morSocket.room,
                sockets:list
            }));

            //deregister when app is closing
            process.on('exit', dan.deregister);
            //catches ctrl+c event
            process.on('SIGINT', function(){
                dan.deregister(function(){
                    process.exit(1);
                });
            });
            //catches uncaught exceptions
            process.on('uncaughtException', dan.deregister);
        });
    };
    return {
        'register': register,
        'deregister': deregister
    }

};

exports.dai = dai;
