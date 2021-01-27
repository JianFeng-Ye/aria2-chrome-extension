"use strict";

import Const from "./const.js";

let sentFlag = false;
let onClick = function(type) {
    let filename = document.getElementById("filename").value.trim();
    if (filename.length <= 0) {
        return;
    }
    let id = parseInt(document.getElementById("download-id").getAttribute("value"));
    if (sentFlag) {
        return;
    }
    sentFlag = true;
    chrome.runtime.sendMessage({
        "id": id,
        "type": type,
        "filename": filename,
    });
    window.close();
};

let getTitle = function(cd) {
    if (!cd) {
        return "aria2";
    }
    return cd + " 秒后自动关闭窗口";
};

document.title = getTitle();
document.addEventListener("DOMContentLoaded", function() {
    var params = window.location.search;
    if (params.length > 1) {
        let vars = params.substring(1).split("&");
        for (let i=0; i<vars.length; i++) {
            let pair = vars[i].split("=");
            let paramName = pair[0];
            if (paramName == "filename") {
                document.getElementById("filename").setAttribute("value", decodeURI(pair[1]));
            } else if (paramName == "id") {
                document.getElementById("download-id").setAttribute("value", decodeURI(pair[1]));
            }
        }
    }

    document.getElementById("button-confirm").addEventListener("click", onClick.bind(null, 1));
    document.getElementById("button-normal").addEventListener("click", onClick.bind(null, 0));
    let cancelFunc = onClick.bind(null, -1);
    document.getElementById("button-cancel").addEventListener("click", cancelFunc);
    // 点击关闭按钮，默认取消下载
    window.onbeforeunload = cancelFunc;

    let cd = Const.POPUP_DURATION;
    document.title = getTitle(cd);
    --cd;
    let intervalId = setInterval(function() {
        document.title = getTitle(cd);
        if (--cd <= 0) {
            clearInterval(intervalId);
            document.title = getTitle();
        }
    }, 1000);
});
