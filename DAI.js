
var config = require('./Config'),
    utils = require('./Utils'),
    mqttTopic = require('./MqttTopic');
var dai = function (morSocket, IoTtalkIP) {

    var dan = require('./DAN').dan();
    var deregister = function(){
        dan.deregister();
    };
    var register = function(){
        var macAddress = morSocket.id;
        var odfList = utils.makeOdfList(morSocket);

        var setAliases = function(){
            for(var i = 0; i < odfList.length; i++){
                var index = parseInt(odfList[i].replace("Socket", ""))-1,
                    gid = Math.floor(index / config.socketStateBits),
                    pos = index % config.socketStateBits;
                console.log(gid+" "+pos+" "+morSocket.socketAliasTable[gid][pos]);
                if(morSocket.socketAliasTable[gid][pos] == null)
                    dan.set_alias(odfList[i], (index+1));
                else
                    dan.set_alias(odfList[i], (index+1) + ":" + morSocket.socketAliasTable[gid][pos]);
            }
        };
        var pull = function (odfName, data) {
            console.log(odfName + ':' + data);
            if(odfName.startsWith('Socket')){
                var socketIndex = odfName.replace('Socket','');
                morSocket.sendOnOffCommand(socketIndex, data);
            }
            else if(odfName == "Control"){
                if(data[0] == "SET_DF_STATUS"){
                    setAliases();
                }
            }
        };

        console.log(odfList);
        if(odfList.length == 0) {
            //dan.deregister();
            return;
        }
        console.log('mac address:' + macAddress);

        IoTtalkIP = (IoTtalkIP == undefined) ? config.IoTtalkIP : IoTtalkIP;
        dan.init(pull, IoTtalkIP , macAddress, {
            'dm_name': 'MorSocket',
            'd_name' : macAddress,
            'u_name': 'yb',
            'is_sim': false,
            'df_list': odfList

        }, function (result) {
            console.log('register:', result);
            setTimeout(setAliases, 1500);

            morSocket.mqttClient.publish(mqttTopic.deviceInfoTopic, JSON.stringify({
                id: morSocket.id,
                room: morSocket.room,
                sockets: utils.makeSocketObjectList(morSocket)
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
