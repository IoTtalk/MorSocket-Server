var express = require("express"),
    app = express(),
    webServer = require("http").createServer(app),
    pageGen = require("./PageGen"),
    config = require("./Config");

app.use(express.static("./webapp"));

app.get("/ssctl", function (req, res) {
    pageGen.Page.getSsCtlPage(req,res,macAddr,config.IoTtalkIP.split(":")[0]+":7788");
});
webServer.listen((process.env.PORT || config.webServerPort), '0.0.0.0');