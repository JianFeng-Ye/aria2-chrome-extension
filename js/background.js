"use strict";

import Const from "./const.js";

let sendHttp = function(request) {
    let httpRequest = new XMLHttpRequest();
    httpRequest.timeout = 3000;
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState == 4) {
            if (httpRequest.status == 200) {
                alert("succ");
            } else {
                alert("error");
            }
        }
    };
    httpRequest.open("POST", request.url, true);
    httpRequest.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    httpRequest.send(request.data);
};

let useAria2Downloader = function(item, outname) {
    let finalUrl = item.finalUrl;
    let referrer = item.referrer;
    chrome.cookies.getAll({"url": finalUrl}, function(cookies) {
        let cookieList = [];
        cookies.forEach(cookie => {
            cookieList.push(cookie.name + "=" + cookie.value);
        });
        let header = [];
        header.push("Referer: " + referrer);
        header.push("Cookie: " + cookieList.join("; "));
        header.push("User-Agent: " + navigator.userAgent);
        header.push("Connection: keep-alive");
        let options = {
            "header": header,
            "out": outname,
        };
        let rpcData = {
            "jsonrpc": "2.0",
            "method": "aria2.addUri",
            "id": new Date().getTime(),
            "params": ["token:" + Const.ARIA2_TOKEN, [finalUrl], options],
        };
        sendHttp({
            url: Const.ARIA2_URL,
            data: JSON.stringify(rpcData),
        });
    });
};

let downloadDict = {};
let dealSuggest = function(id, suggest, filename, consumeFlag, cancelFlag) {
    // 没有 suggest, 之后的 cancel 会报错...
    // quote: Each listener must call suggest exactly once, either synchronously or asynchronously.
    suggest({
        filename: filename,
        conflict_action: "prompt",
        conflictAction: "prompt",
    });
    if (consumeFlag) {
        chrome.downloads.resume(id);
    } else if (cancelFlag) {
        chrome.downloads.cancel(id);
        chrome.downloads.erase({id: id});
    }
};

let timeoutIdDict = {};
let cancel2ResumeDict = {}; // 定时关闭窗口和窗口的 onbeforeunload 冲突
chrome.runtime.onMessage.addListener(function(request, _sender, _sendResponse) {
    let id = request.id;
    let downloadInfo = downloadDict[id];
    if (!downloadInfo) {
        return;
    }
    let item = downloadInfo[0];
    if (id != item.id) {
        return;
    }
    clearTimeout(timeoutIdDict[id]);
    delete timeoutIdDict[id];
    let suggest = downloadInfo[1];
    delete downloadDict[id];
    let filename = request.filename;
    switch (request.type) {
    case 0:
        dealSuggest(id, suggest, filename, true, false);
        break;
    case 1:
        dealSuggest(id, suggest, filename, false, true);
        useAria2Downloader(item, filename);
        break;
    default:
        if (!cancel2ResumeDict[id]) {
            dealSuggest(id, suggest, filename, false, true);
        } else {
            delete cancel2ResumeDict[id];
            dealSuggest(id, suggest, filename, true, false);
        }
        break;
    }
});

let packUrlParams = function(list) {
    let tmpList = [];
    for (let i=0, len=list.length; i<len; i+=2) {
        tmpList.push(list[i] + "=" + list[i+1]);
    }
    return tmpList.join("&");
};

let chooseDownloadType = function(id) {
    let downloadInfo = downloadDict[id];
    let item = downloadInfo[0];
    let urlParams = [
        "id", id,
        "filename", encodeURI(item.filename),
    ];
    let popUpWidth = 500;
    let popUpHeight = 180;
    chrome.windows.create({
        "url": "/html/popup.html?" + packUrlParams(urlParams),
        "focused": true,
        "type": "popup",
        "width": popUpWidth,
        "height": popUpHeight,
        "top": Math.floor(window.screen.height / 2) - Math.floor(popUpHeight / 2),
        "left": Math.floor(window.screen.width / 2) - Math.floor(popUpWidth / 2),
    }, function(w) {
        // 如果10几秒内也没输入, 会自动弹出内置下载器
        timeoutIdDict[id] = setTimeout(function() {
            cancel2ResumeDict[id] = true;
            chrome.windows.remove(w.id);
            // popup 窗口设置了 onbeforeunload, 关闭会触发一次
            // let suggest = downloadInfo[1];
            // dealSuggest(id, suggest, item.filename, true, false);
        }, Const.POPUP_DURATION * 1000);
    });
};

chrome.downloads.onDeterminingFilename.addListener(function(item, suggest) {
    let id = item.id;
    chrome.downloads.pause(id);

    downloadDict[id] = [item, suggest];
    chooseDownloadType(id);
    return true;
});
