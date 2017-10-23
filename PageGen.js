var fs = require('fs'),
    ejs = require('ejs'),
    ssCtlDir = __dirname + "/webapp/html/SmartSwitchController.ejs";
    //IDFList = require("./ShareVariables").IDFList;

var Page = function () {};

Page.prototype = {
    getSsCtlPage : function (req, res,macAddr,iottalkIP) {

        fs.readFile(ssCtlDir,
            function (err, contents) {
                if (err) {
                    console.log(err);
                }
                else {
                    contents = contents.toString('utf8');
                    res.writeHead(200, {"Content-Type": "text/html"});
                    res.end(ejs.render(contents, {macAddr:macAddr,iottalkIP:iottalkIP}));
                }
            }
        );
    }
};

exports.Page = new Page();