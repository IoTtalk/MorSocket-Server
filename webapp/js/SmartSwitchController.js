
$( document ).ready(function () {
    var updateDeviceFeatureAlias = function(updateInfo){
        //undateInfo {"dfo_id":"Integer","alias_name":"xxx"}
        $.ajax({
            url: 'http://'+iottalkIP +'/update_dfo_alias_name',
            type:'POST',
            data: {"update_info":JSON.stringify(updateInfo)}
        });
    };
    //get device feature object id
    $.ajax({
        url: 'http://'+iottalkIP +'/get_device_feature_object_id',
        type:'POST',
        data: {"mac_addr":macAddr}
    }).done(function(res) {
        res = JSON.parse(res);
        if(res.success){
            console.log(res.data);
            var keys = Object.keys(res.data);
            var df = keys.map(function(v) { return res.data[v]; });
            for(var i in df) {
                var tr = $("<tr>");
                var thDF = $("<th>");
                var thAlias = $("<th>");
                thAlias.attr("dfoId",keys[i]);
                thAlias.attr("class","alias");
                thDF.attr("class","df");
                var d = df[i].split(":");
                var name = d[0];
                var alias = d[1];
                tr.append(thDF.text(name));
                var div = generateDropdownMenu();
                thAlias.append(div);
                console.log(alias);
                $(".inputTextBox").get(i).value = alias;
                tr.append(thAlias);
                $("#df_list_table").append(tr);
            }
        }else{
            $("#df_list").text(res.data);
            console.log(res.data);
        }
    });
    $("#df_list_save_btn").click(function () {
        for(var i = 0; i < $(".inputTextBox").length; i++){
            var alias = {};
            alias["dfo_id"] = $(".alias")[i].getAttribute("dfoId");
            alias["alias_name"] = $(".inputTextBox")[i].value;
            updateDeviceFeatureAlias(alias);
        }
    });
    var dropDownMenuCount = 1;
    var generateDropdownMenu = function(){
        var appliances = ["fan","computer","bulb"];
        var select = $("<select>");
        select.attr("class","editableBox");
        var id = dropDownMenuCount++;
        select.attr("id",id.toString());
        for (var i = 0; i < appliances.length; i++){
            var option = $("<option>");
            option.attr("value",(i+1).toString());
            option.text(appliances[i]);
            select.append(option);
        }
        var input = $("<input>");
        input.attr("class","inputTextBox");
        var div = $("<div>");
        div.attr("class","wrapper");
        div.append(select);
        div.append(input);
        select.change(function(){
            input.val($("option:selected", this).html());
        });
        return div;
    };
});