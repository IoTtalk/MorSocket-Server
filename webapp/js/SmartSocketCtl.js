/**
 * Created by kuan on 2017/6/1.
 */

$( document ).ready(function () {
    // menu dropdown
    $('.ui.dropdown').dropdown();

    // make alias editable
    var defaultText;
    function endEdit(e) {
        var input = $(e.target),
            label = input && input.parent().prev();

        label.text(input.val() === '' ? defaultText : input.val()+"  \u270E");
        input.hide();
        label.show();
    }

    $(".clickedit").hide()
        .focusout(endEdit)
        .keyup(function (e) {
            if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) {
                endEdit(e);
                return false;
            } else {
                return true;
            }
        })
        .parent().prev().click(function () {
            defaultText = $(this).innerText;
            $(this).hide();
            $(this).next().children().first().show().focus();
        });
    // bind socket status click event
    var changeToRed = function(){
        this.className = "sStatus ui red empty circular label";
        $(this).unbind("click",changeToRed);
        $(this).click(changeToGreen);
    };
    var changeToGreen = function(){
        this.className = "sStatus ui green empty circular label";
        $(this).unbind("click",changeToGreen);
        $(this).click(changeToRed);
    };
    $(".sStatus.ui.red.empty.circular").click(changeToGreen);
    $(".sStatus.ui.green.empty.circular").click(changeToRed);

    // download app button click event
    var i = 1;
    var description = [
        "開啟下app後，按下右上角的WIFI按鈕",
        "按下BLE按鈕",
        "選擇要連接的SmartSocket，ID標示在SmartSocket Controller上",
        "設定 1.設定SmartSocket要連接的Access Point，2.設定SmartScoket要連接的SmartScoket Server IP:140.113.199.202, port:7654",
        "驗證BLE連線，如果失敗會回傳E1",
        "驗證Access Point存在，如果失敗會回傳E1",
        "驗證Access Point密碼是否正確，如果失敗會回傳E1",
        "驗證WIFI連線，如果失敗會回傳E1",
        "開始傳輸，如果失敗會回傳E1"];
    $(".downloadAppButton").click(function(){
        i = 1;
        $("#setupImg").attr("src","../imgs/1.png");
        $("#describeText").text(description[i-1]);
        $("#setupStep").text("Setup step " + i);
        $("#setupButtonPre").hide();
        $(".setupButtonNex").show();
        $('.ui.basic.modal').modal('show');
    });
    var setupNext = function(){
        if(i == 1)
            $("#setupButtonPre").show();
        else if(i == 8)
            $("#setupButtonNex").hide();
        i++;
        $("#setupStep").text("Setup step " + i);
        $("#describeText").text(description[i-1]);
        $("#setupImg").attr("src","../imgs/"+i+".png");
    };
    var setupPrev = function(){
        if(i == 9)
            $("#setupButtonNex").show();
        else if(i == 2)
            $("#setupButtonPre").hide();
        i--;
        $("#setupStep").text("Setup step " + i);
        $("#describeText").text(description[i-1]);
        $("#setupImg").attr("src","../imgs/"+i+".png");
    };
    $("#setupButtonNex").click(setupNext);
    $("#setupButtonPre").click(setupPrev);

});