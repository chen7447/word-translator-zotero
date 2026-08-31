// Word Translator 模块：translate（Phase 5 由 addon.js 机械拆分，纯移动无行为变更）
// 依赖：本文件在 addon.js 之后经 loadSubScript 注入，Object.assign 挂到同一 WordTranslator 对象上，this 绑定不变。
"use strict";

// Google 无密钥通道：限流是按 client 维度做的——gtx（历史默认，人人都在用）自 2026-08 起被全局 429，
// 而 dict-chrome-ex（Chrome 词典扩展同一端点）不在限流名单且 tk 参数可省略（实测 200、连发不封）。
// 会话内记住当前可用的 client，被限流再按候选顺序重试。
var _googleClientId = "dict-chrome-ex";
var _GOOGLE_CLIENT_CANDIDATES = ["dict-chrome-ex", "tw-ob", "gtx"];

var WordTranslatorModule_translate = {
  async _enrichDict(word) {
    try {
      const D = Zotero.WordTranslatorDict;
      if (!D || typeof D.lookup !== "function") return;
      const entry = await D.lookup(word);
      if (!entry) return;
      try { await this._rerenderCurrentItemPane("dict-update"); } catch (e) {}
    } catch (e) {
      this._debugLog("_enrichDict ERROR: " + (e && (e.message || e)));
    }
  },

  // 渲染目标 body 解析（统一入口）：
  //   1) 上下文 body 已连接且就是最新初始化的 → 直接用；
  //   2) 存在最新 uid 的连接 body（如重载后旧 body 残留）→ 切换过去并留诊断日志；
  //   3) 兜底取文档中第一个连接的 .wordtranslator-pane-body。
  // 多个 body 同时连接时一律打日志——这是排查"保存成功但面板不显示"类问题的关键证据。
  _speakRegistry: {
    // 系统 TTS：无外部音频，纯本地合成（始终可用）
    system: function (word, doc) {
      try {
        let win = null;
        try { win = Zotero.getMainWindow(); } catch (e) {}
        if (!win) try { win = doc.defaultView; } catch (e) {}
        const Ctor = win && win.SpeechSynthesisUtterance;
        const ss = win && win.speechSynthesis;
        if (Ctor && ss) {
          const u = new Ctor(word);
          u.lang = "en-US";
          u.rate = 0.9;
          ss.speak(u);
        } else {
          this._debugLog("speak system: web speech API missing in window");
        }
      } catch (e) {
        this._debugLog("speak system ERROR: " + (e && (e.message || e)));
      }
    },

    // TTS API：需地址+Key；无配置则静默
    api: function (word, doc) {
      const apiUrl = this._data && this._data.ttsApiUrl;
      const apiKey = this._data && this._data.ttsApiKey;
      if (!apiUrl || !apiKey) {
        this._debugLog("speak skipped: TTS API not configured");
        return;
      }
      Zotero.HTTP.request("POST", apiUrl.replace(/\/+$/, "") + "/audio/speech", {
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        // Phase 8：模型/音色可配置（偏好页 TTS API 区），缺省回落 tts-1/alloy
        body: JSON.stringify({
          model: (this._data && this._data.ttsApiModel) || "tts-1",
          input: word,
          voice: (this._data && this._data.ttsApiVoice) || "alloy",
          response_format: "mp3",
        }),
        responseType: "arraybuffer",
      }).then((resp) => {
        if (resp.status !== 200) {
          this._debugLog("speak TTS API error: HTTP " + resp.status);
          return;
        }
        const blob = new Blob([resp.response], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = doc.createElement("audio");
        audio.src = url;
        audio.play().then(() => {
          audio.onended = () => URL.revokeObjectURL(url);
        }).catch((e) => { this._debugLog("speak TTS API play ERROR: " + (e && e.message || e)); });
      }).catch((e) => {
        this._debugLog("speak TTS API ERROR: " + (e && (e.message || e)));
      });
    },

    // 词典原生音频：优先条目音频，无则用 youdao dictvoice 按词兜底（实测可达）；
    // 源失效（media error）时自动回退系统 TTS 兜底，保证任意词都有声。
    "dict:youdao": function (word, doc) {
      try {
        const D = Zotero.WordTranslatorDict;
        const entry = D && D.getCached && D.getCached(word);
        let src = entry && entry.audio && (entry.audio.us || entry.audio.uk);
        // 只有真·单词（无空格）才按词生成 youdao 兜底；句子/短语没有词典音频，回落系统 TTS 朗读
        if (!src && !/\s/.test(word) && word.length <= 40) {
          src = "https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(word) + "&type=1";
        }
        const onFail = () => this._speakRegistry.system.call(this, word, doc);
        if (src) {
          this._playAudioEl(doc, word, src, onFail);
        } else {
          onFail();
        }
      } catch (e) { this._debugLog("speak dict ERROR: " + (e && (e.message || e))); }
    },
  },

  // 统一播放：audio 元素挂到 DOM 再播（Gecko 未挂载偶发静默），播完移除；
  // 播放失败/媒体不可用时调用 onFail（若提供）
  _playAudioEl(doc, word, src, onFail) {
    try {
      const a = doc.createElement("audio");
      a.src = src;
      a.style.display = "none";
      try { (doc.body || doc.documentElement).appendChild(a); } catch (e) {}
      let failed = false;
      const failOnce = () => {
        if (failed) return;
        failed = true;
        try { if (a.parentNode) a.parentNode.removeChild(a); } catch (e) {}
        if (typeof onFail === "function") { try { onFail(); } catch (e) {} }
      };
      const onDone = () => {
        try { if (a.parentNode) a.parentNode.removeChild(a); } catch (e) {}
      };
      a.addEventListener("error", failOnce);
      a.addEventListener("ended", onDone);
      a.play().catch((e) => {
        this._debugLog("speak audio play ERROR (" + word + "): " + (e && (e.message || e)));
        failOnce();
      });
    } catch (e) { this._debugLog("speak audio ERROR: " + (e && (e.message || e))); if (typeof onFail === "function") { try { onFail(); } catch (e2) {} } }
  },

  // 🔊 入口：现读引擎 → 注册表分派（无匹配回落 system），每次点击都现解析，无跨调用状态
  _speakWord(word, doc) {
    const engine = (this._data && this._data.ttsEngine) || "system";
    const fn = (engine === "dict" ? this._speakRegistry["dict:youdao"] : this._speakRegistry[engine]) || this._speakRegistry.system;
    try { fn.call(this, word, doc); }
    catch (e) { this._debugLog("speak dispatch ERROR: " + (e && (e.message || e))); }
  },

  async _translateWithTimeout(text, timeoutMs, onChunk, context) {
    const timeout = timeoutMs || 15000;
    let timer = null;
    try {
      return await Promise.race([
        this.translate(text, null, onChunk, context),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("翻译超时（" + Math.round(timeout / 1000) + " 秒未返回）")), timeout);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  },

  _translateAdapters: new Map([
    ["google", "_translateGoogle"],
    ["deepl", "_translateDeepL"],
    ["microsoft", "_translateMicrosoft"],
    ["caiyun", "_translateCaiyun"],
    ["niutrans", "_translateNiuTrans"],
    ["claude", "_translateClaude"],
    ["libretranslate", "_translateLibreTranslate"],
    ["baidu", "_translateBaidu"],
    ["baidu-field", "_translateBaiduField"],
    ["deeplx-selfhosted", "_translateDeepLXSelfhosted"],
    ["youdaozhiyun", "_translateYoudaoZhiyun"],
    ["tencent", "_translateTencent"],
    ["aliyun", "_translateAliyun"],
    ["volcengine", "_translateVolcengine"],
    ["xfyun", "_translateXfyun"],
  ]),

  _bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  },

  _bytesToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  },

  async _sha256Hex(value) {
    return this._bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  },

  async _hmacSha1Base64(value, keyValue) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(keyValue), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    return this._bytesToBase64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  },

  async _hmacSha256(value, keyValue) {
    const keyData = typeof keyValue === "string" ? new TextEncoder().encode(keyValue) : keyValue;
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  },

  _parseJsonResponse(resp, serviceName) {
    let data = resp.response;
    if (typeof data === "string") {
      try { data = JSON.parse(data); }
      catch (e) { throw new Error(serviceName + " 返回的不是有效 JSON：" + data.slice(0, 200)); }
    }
    return data;
  },

  async _translateDeepLXSelfhosted(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("DeepLX 自建服务翻译文本为空");
    // 用户可能填 base URL（如 http://127.0.0.1:1188）也可能直接填完整 /translate 地址
    let base = (api.baseUrl || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("DeepLX 自建服务 URL 未配置");
    const url = /\/translate$/.test(base) ? base : base + "/translate";
    const headers = { "Content-Type": "application/json" };
    if (api.apiKey) {
      // 自建 DLX 服务若开启了 -token 鉴权，使用 Bearer 或 DeepL-Auth-Key 均可，服务端兼容两种
      headers["Authorization"] = "Bearer " + api.apiKey;
    }
    const body = JSON.stringify({
      text: source,
      source_lang: "EN",
      target_lang: "ZH",
    });
    this._debugLog("DeepLX 自建服务 request URL: " + url + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", url, {
      headers,
      body,
      responseType: "json",
    });
    const data = this._parseJsonResponse(resp, "DeepLX 自建服务");
    if (data && data.code === 200 && data.data) {
      return String(data.data).trim();
    }
    // 非 200：HTTP 状态或业务 code 错误；DLX 错误响应为 {code, message}
    const detail = (data && data.message) || (data && data.error && (data.error.message || data.error)) || resp.statusText || "";
    throw new Error("DeepLX 自建服务错误(" + (resp.status || (data && data.code) || "?") + "): " + detail);
  },

  async _translateYoudaoZhiyun(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("有道智云翻译文本为空");
    const parts = String(api.apiKey || "").split("#");
    const appKey = (parts.shift() || "").trim();
    const appSecret = parts.shift() ? (parts.join("#")).trim() : "";
    const vocabId = (parts.shift() || "").trim();
    if (!appKey || !appSecret) throw new Error("有道智云 API Key 请按 AppKey#AppSecret 格式填写");
    const salt = String(Date.now());
    const curtime = String(Math.floor(Date.now() / 1000));
    const truncated = source.length <= 20 ? source : source.slice(0, 10) + source.length + source.slice(-10);
    const sign = await this._sha256Hex(appKey + truncated + salt + curtime + appSecret);
    const endpoint = (api.baseUrl || "https://openapi.youdao.com/api").trim();
    const form = [
      "q=" + encodeURIComponent(source), "from=en", "to=zh-CHS", "appKey=" + encodeURIComponent(appKey),
      "salt=" + encodeURIComponent(salt), "sign=" + encodeURIComponent(sign), "signType=v3", "curtime=" + encodeURIComponent(curtime),
    ];
    if (vocabId) form.push("vocabId=" + encodeURIComponent(vocabId));
    this._debugLog("Youdao Zhiyun request URL: " + endpoint + " | textLength=" + source.length + " | method=POST");
    const resp = await Zotero.HTTP.request("POST", endpoint, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.join("&"),
      responseType: "json",
    });
    const data = this._parseJsonResponse(resp, "有道智云");
    if (resp.status < 200 || resp.status >= 300) throw new Error("有道智云错误(" + resp.status + "): " + (resp.statusText || ""));
    if (data && data.errorCode && data.errorCode !== "0") throw new Error("有道智云错误(" + data.errorCode + "): " + (data.errorMsg || ""));
    const translation = data && data.translation && data.translation[0];
    if (!translation) throw new Error("有道智云返回中没有 translation[0]：" + JSON.stringify(data).slice(0, 500));
    return String(translation).trim();
  },

  async _translateTencent(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("腾讯云机器翻译文本为空");
    const parts = String(api.apiKey || "").split("#");
    const secretId = (parts[0] || "").trim();
    const secretKey = (parts[1] || "").trim();
    const region = (parts[2] || "ap-shanghai").trim();
    const projectId = Number(parts[3] || 0);
    if (!secretId || !secretKey) throw new Error("腾讯云 API Key 请按 SecretId#SecretKey#Region#ProjectId 格式填写");
    const service = "tmt";
    const host = "tmt.tencentcloudapi.com";
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const payload = JSON.stringify({ SourceText: source, Source: "en", Target: "zh", ProjectId: Number.isFinite(projectId) ? projectId : 0 });
    const canonicalHeaders = "content-type:application/json; charset=utf-8\nhost:" + host + "\n";
    const signedHeaders = "content-type;host";
    const canonicalRequest = "POST\n/\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + await this._sha256Hex(payload);
    const credentialScope = date + "/" + service + "/tc3_request";
    const stringToSign = "TC3-HMAC-SHA256\n" + timestamp + "\n" + credentialScope + "\n" + await this._sha256Hex(canonicalRequest);
    const secretDate = await this._hmacSha256(date, "TC3" + secretKey);
    const secretService = await this._hmacSha256(service, secretDate);
    const secretSigning = await this._hmacSha256("tc3_request", secretService);
    const signature = this._bytesToHex(await this._hmacSha256(stringToSign, secretSigning));
    const authorization = "TC3-HMAC-SHA256 Credential=" + secretId + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;
    this._debugLog("Tencent request URL: https://" + host + " | region=" + region + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", "https://" + host, {
      headers: { "Content-Type": "application/json; charset=utf-8", Host: host, "X-TC-Action": "TextTranslate", "X-TC-Version": "2018-03-21", "X-TC-Timestamp": String(timestamp), "X-TC-Region": region, Authorization: authorization },
      body: payload,
      responseType: "json",
    });
    const data = this._parseJsonResponse(resp, "腾讯云机器翻译");
    const error = data && data.Response && data.Response.Error;
    if (resp.status < 200 || resp.status >= 300 || error) throw new Error("腾讯云机器翻译错误(" + (error && error.Code || resp.status) + "): " + (error && error.Message || resp.statusText || ""));
    const translation = data && data.Response && data.Response.TargetText;
    if (!translation) throw new Error("腾讯云机器翻译返回中没有 Response.TargetText：" + JSON.stringify(data).slice(0, 500));
    return String(translation).trim();
  },

  async _translateAliyun(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("阿里云机器翻译文本为空");
    const parts = String(api.apiKey || "").split("#");
    const accessKeyId = (parts[0] || "").trim();
    const accessKeySecret = parts.slice(1).join("#").trim();
    if (!accessKeyId || !accessKeySecret) throw new Error("阿里云 API Key 请按 AccessKeyId#AccessKeySecret 格式填写");
    const encode = function (value) { return encodeURIComponent(value).replace(/[!'()*]/g, function (char) { return "%" + char.charCodeAt(0).toString(16).toUpperCase(); }); };
    const params = {
      AccessKeyId: accessKeyId, Action: "TranslateGeneral", Format: "JSON", FormatType: "text", Scene: "general",
      SignatureMethod: "HMAC-SHA1", SignatureNonce: Zotero.Utilities.randomString(16), SignatureVersion: "1.0",
      SourceLanguage: "en", SourceText: source, TargetLanguage: "zh", Timestamp: new Date().toISOString(), Version: "2018-10-12",
    };
    const canonical = Object.keys(params).sort().map(function (key) { return encode(key) + "=" + encode(params[key]); }).join("&");
    const stringToSign = "POST&%2F&" + encode(canonical);
    const signature = await this._hmacSha1Base64(stringToSign, accessKeySecret + "&");
    const endpoint = (api.baseUrl || "https://mt.cn-hangzhou.aliyuncs.com/").trim();
    const body = canonical + "&Signature=" + encode(signature);
    this._debugLog("Aliyun request URL: " + endpoint + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", endpoint, { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, responseType: "json" });
    const data = this._parseJsonResponse(resp, "阿里云机器翻译");
    if (resp.status < 200 || resp.status >= 300 || (data && data.Code && data.Code !== "200")) throw new Error("阿里云机器翻译错误(" + (data && data.Code || resp.status) + "): " + (data && data.Message || resp.statusText || ""));
    const translation = data && data.Data && data.Data.Translated;
    if (!translation) throw new Error("阿里云机器翻译返回中没有 Data.Translated：" + JSON.stringify(data).slice(0, 500));
    return String(translation).trim();
  },

  async _translateVolcengine(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("火山引擎机器翻译文本为空");
    const parts = String(api.apiKey || "").split("#");
    const accessKeyId = (parts[0] || "").trim();
    const accessKeySecret = parts.slice(1).join("#").trim();
    if (!accessKeyId || !accessKeySecret) throw new Error("火山引擎 API Key 请按 AccessKeyId#AccessKeySecret 格式填写");
    const host = "translate.volcengineapi.com";
    const region = "cn-north-1";
    const service = "translate";
    const currTime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const requestBody = { TargetLanguage: "zh", TextList: [source] };
    const bodyStr = JSON.stringify(requestBody);
    const contentHash = await this._sha256Hex(bodyStr);
    const signedHeaders = "content-type;x-content-sha256;x-date";
    const canonicalHeaders = "content-type:application/json\nx-content-sha256:" + contentHash + "\nx-date:" + currTime + "\n";
    const canonicalRequest = "POST\n/\nAction=TranslateText&Version=2020-06-01\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + contentHash;
    const credentialScope = currTime.slice(0, 8) + "/" + region + "/" + service + "/request";
    const stringToSign = "HMAC-SHA256\n" + currTime + "\n" + credentialScope + "\n" + await this._sha256Hex(canonicalRequest);
    const kDate = await this._hmacSha256(currTime.slice(0, 8), accessKeySecret);
    const kRegion = await this._hmacSha256(region, kDate);
    const kService = await this._hmacSha256(service, kRegion);
    const signingKey = await this._hmacSha256("request", kService);
    const signature = this._bytesToHex(await this._hmacSha256(stringToSign, signingKey));
    const authorization = "HMAC-SHA256 Credential=" + accessKeyId + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;
    this._debugLog("Volcengine request URL: https://" + host + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", "https://" + host + "/?Action=TranslateText&Version=2020-06-01", {
      headers: { "Content-Type": "application/json", "X-Date": currTime, "X-Content-Sha256": contentHash, Authorization: authorization },
      body: bodyStr,
      responseType: "json",
    });
    const data = this._parseJsonResponse(resp, "火山引擎机器翻译");
    const error = data && data.ResponseMetadata && data.ResponseMetadata.Error;
    if (resp.status < 200 || resp.status >= 300 || error) throw new Error("火山引擎机器翻译错误(" + (error && error.Code || resp.status) + "): " + (error && error.Message || resp.statusText || ""));
    const translation = data && data.TranslationList && data.TranslationList[0] && data.TranslationList[0].Translation;
    if (!translation) throw new Error("火山引擎机器翻译返回中没有 TranslationList[0].Translation：" + JSON.stringify(data).slice(0, 500));
    return String(translation).trim();
  },

  async _translateXfyun(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("讯飞机器翻译文本为空");
    const parts = String(api.apiKey || "").split("#");
    const appId = (parts[0] || "").trim();
    const apiKey = (parts[1] || "").trim();
    const apiSecret = (parts[2] || "").trim();
    if (!appId || !apiKey || !apiSecret) throw new Error("讯飞 API Key 请按 AppID#APIKey#APISecret 格式填写");
    const host = "itrans.xf-yun.com";
    const path = "/v1/its";
    const date = new Date().toUTCString();
    const signatureOrigin = "host: " + host + "\ndate: " + date + "\nPOST " + path + " HTTP/1.1";
    const signatureHash = this._bytesToBase64(await this._hmacSha256(signatureOrigin, apiSecret));
    const authorizationOrigin = 'api_key="' + apiKey + '",algorithm="hmac-sha256",headers="host date request-line",signature="' + signatureHash + '"';
    const authorization = this._bytesToBase64(new TextEncoder().encode(authorizationOrigin));
    const url = "https://" + host + path + "?authorization=" + encodeURIComponent(authorization) + "&host=" + encodeURIComponent(host) + "&date=" + encodeURIComponent(date);
    const encodedContent = this._bytesToBase64(new TextEncoder().encode(source));
    const body = JSON.stringify({
      header: { app_id: appId, status: 3, res_id: "" },
      payload: { text: { from: "en", to: "cn", content: encodedContent } },
    });
    this._debugLog("Xfyun request URL: https://" + host + path + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", url, {
      headers: { "Content-Type": "application/json", Accept: "application/json,version=1.0" },
      body,
      responseType: "json",
    });
    const data = this._parseJsonResponse(resp, "讯飞机器翻译");
    const header = data && data.header;
    if (resp.status < 200 || resp.status >= 300 || (header && header.code !== 0)) throw new Error("讯飞机器翻译错误(" + (header && header.code || resp.status) + "): " + (header && header.message || resp.statusText || ""));
    const translation = data && data.payload && data.payload.result && data.payload.result.trans_result && data.payload.result.trans_result.dst;
    if (!translation) throw new Error("讯飞机器翻译返回中没有 payload.result.trans_result.dst：" + JSON.stringify(data).slice(0, 500));
    return String(translation).trim();
  },

  async _translateBaiduField(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("百度垂直领域翻译文本为空");
    const parts = String(api.apiKey || "").split("#");
    const appid = (parts[0] || "").trim();
    const key = parts.slice(1, -1).join("#").trim();
    const domain = (parts[parts.length - 1] || "").trim();
    if (!appid || !key || !domain) throw new Error("百度垂直领域 API Key 请按 AppID#密钥#domain 格式填写");
    const salt = String(Date.now());
    const sign = Zotero.Utilities.Internal.md5(appid + source + salt + domain + key, false);
    const endpoint = (api.baseUrl || "https://api.fanyi.baidu.com/api/trans/vip/fieldtranslate").trim();
    const query = ["q=" + encodeURIComponent(source), "from=en", "to=zh", "appid=" + encodeURIComponent(appid), "domain=" + encodeURIComponent(domain), "salt=" + encodeURIComponent(salt), "sign=" + encodeURIComponent(sign)].join("&");
    this._debugLog("Baidu field request URL: " + endpoint + " | domain=" + domain + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("GET", endpoint + "?" + query, { responseType: "json" });
    let responseData = resp.response;
    if (typeof responseData === "string") { try { responseData = JSON.parse(responseData); } catch (e) { throw new Error("百度垂直领域返回的不是有效 JSON：" + responseData.slice(0, 200)); } }
    if (resp.status < 200 || resp.status >= 300) throw new Error("百度垂直领域错误(" + resp.status + "): " + (resp.statusText || ""));
    if (responseData && responseData.error_code) throw new Error("百度垂直领域错误(" + responseData.error_code + "): " + (responseData.error_msg || ""));
    const rows = responseData && responseData.trans_result;
    const translation = Array.isArray(rows) ? rows.map(function (row) { return row && row.dst || ""; }).join("\n").trim() : "";
    if (!translation) throw new Error("百度垂直领域返回中没有 trans_result[].dst：" + JSON.stringify(responseData).slice(0, 500));
    return translation;
  },

  async _translateBaidu(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("百度翻译文本为空");
    const parts = String(api.apiKey || "").split("#");
    const appid = (parts[0] || "").trim();
    const key = parts.slice(1).join("#").trim();
    if (!appid || !key) throw new Error("百度翻译 API Key 请按 AppID#密钥 格式填写");
    const salt = String(Date.now());
    const sign = Zotero.Utilities.Internal.md5(appid + source + salt + key, false);
    const endpoint = (api.baseUrl || "https://api.fanyi.baidu.com/api/trans/vip/translate").trim();
    const query = [
      "q=" + encodeURIComponent(source),
      "from=en",
      "to=zh",
      "appid=" + encodeURIComponent(appid),
      "salt=" + encodeURIComponent(salt),
      "sign=" + encodeURIComponent(sign),
    ].join("&");
    this._debugLog("Baidu request URL: " + endpoint + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("GET", endpoint + "?" + query, { responseType: "json" });
    let responseData = resp.response;
    if (typeof responseData === "string") { try { responseData = JSON.parse(responseData); } catch (e) { throw new Error("百度翻译返回的不是有效 JSON：" + responseData.slice(0, 200)); } }
    if (resp.status < 200 || resp.status >= 300) throw new Error("百度翻译错误(" + resp.status + "): " + (resp.statusText || ""));
    if (responseData && responseData.error_code) throw new Error("百度翻译错误(" + responseData.error_code + "): " + (responseData.error_msg || ""));
    const rows = responseData && responseData.trans_result;
    const translation = Array.isArray(rows) ? rows.map(function (row) { return row && row.dst || ""; }).join("\n").trim() : "";
    if (!translation) throw new Error("百度翻译返回中没有 trans_result[].dst：" + JSON.stringify(responseData).slice(0, 500));
    return translation;
  },

  async _translateClaude(text, api, context) {
    const source = String(text || "").trim();
    if (!source) throw new Error("Claude 翻译文本为空");
    const base = (api.baseUrl || "https://api.anthropic.com/v1").trim().replace(/\/+$/, "");
    const url = base + "/messages";
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": api.apiKey,
      "anthropic-version": "2023-06-01",
    };
    // 与 OpenAI 兼容路径共用提示词设置（旧版硬编码提示词，忽略偏好页配置）：
    // split 模式 → Anthropic 协议的顶层 system 字段；combined 模式 → 全并入 user 消息。
    const parts = this._buildPromptParts(source, context);
    const body = {
      model: api.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: parts.user }],
    };
    if (parts.system) body.system = parts.system;
    this._debugLog("Claude request URL: " + url + " | model=" + (api.model || "(none)"));
    const resp = await Zotero.HTTP.request("POST", url, { headers, body: JSON.stringify(body), responseType: "json" });
    let responseData = resp.response;
    if (typeof responseData === "string") { try { responseData = JSON.parse(responseData); } catch (e) { throw new Error("Claude 返回的不是有效 JSON：" + responseData.slice(0, 200)); } }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && responseData.error && (responseData.error.message || responseData.error) || resp.statusText || "";
      throw new Error("Claude 错误(" + resp.status + "): " + detail);
    }
    const translation = responseData && responseData.content && responseData.content[0] && responseData.content[0].text;
    if (!translation) throw new Error("Claude 返回中没有 content[0].text：" + JSON.stringify(responseData).slice(0, 500));
    return String(translation).trim();
  },

  async _translateLibreTranslate(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("LibreTranslate 翻译文本为空");
    const url = (api.baseUrl || "").trim().replace(/\/+$/, "") + "/translate";
    if (url === "/translate") throw new Error("请填写 LibreTranslate 服务的基础 URL");
    const body = { q: source, source: "en", target: "zh", format: "text" };
    if ((api.apiKey || "").trim()) body.api_key = api.apiKey;
    this._debugLog("LibreTranslate request URL: " + url + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", url, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), responseType: "json" });
    let responseData = resp.response;
    if (typeof responseData === "string") { try { responseData = JSON.parse(responseData); } catch (e) { throw new Error("LibreTranslate 返回的不是有效 JSON：" + responseData.slice(0, 200)); } }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && (responseData.error || responseData.message) || resp.statusText || "";
      throw new Error("LibreTranslate 错误(" + resp.status + "): " + detail);
    }
    if (!responseData || !responseData.translatedText) throw new Error("LibreTranslate 返回中没有 translatedText：" + JSON.stringify(responseData).slice(0, 500));
    return String(responseData.translatedText).trim();
  },

  async _translateNiuTrans(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("小牛翻译文本为空");
    const url = (api.baseUrl || "https://api.niutrans.com/NiuTransServer/translation").trim();
    const headers = { "Content-Type": "application/json" };
    const body = {
      from: "en",
      to: "zh",
      src_text: source,
      apikey: api.apiKey,
    };
    this._debugLog("NiuTrans request URL: " + url + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", url, {
      headers,
      body: JSON.stringify(body),
      responseType: "json",
    });
    let responseData = resp.response;
    if (typeof responseData === "string") {
      try { responseData = JSON.parse(responseData); }
      catch (e) { throw new Error("小牛翻译返回的不是有效 JSON：" + responseData.slice(0, 200)); }
    }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && (responseData.message || responseData.error_msg) || resp.statusText || "";
      throw new Error("小牛翻译错误(" + resp.status + "): " + detail);
    }
    const translation = responseData && (responseData.tgt_text || responseData.target_text);
    if (!translation) throw new Error("小牛翻译返回中没有 tgt_text：" + JSON.stringify(responseData).slice(0, 500));
    return String(translation).trim();
  },

  async _translateCaiyun(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("彩云小译文本为空");
    const url = (api.baseUrl || "http://api.interpreter.caiyunai.com/v1/translator").trim();
    const headers = {
      "Content-Type": "application/json",
      "x-authorization": "token " + api.apiKey,
    };
    const body = {
      source: [source],
      trans_type: "en2zh",
      request_id: "wordtranslator-" + Date.now(),
      detect: false,
    };
    this._debugLog("Caiyun request URL: " + url + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", url, {
      headers,
      body: JSON.stringify(body),
      responseType: "json",
    });
    let responseData = resp.response;
    if (typeof responseData === "string") {
      try { responseData = JSON.parse(responseData); }
      catch (e) { throw new Error("彩云小译返回的不是有效 JSON：" + responseData.slice(0, 200)); }
    }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && (responseData.message || responseData.error) || resp.statusText || "";
      throw new Error("彩云小译错误(" + resp.status + "): " + detail);
    }
    const translation = responseData && responseData.target && responseData.target[0];
    if (!translation) throw new Error("彩云小译返回中没有 target[0]：" + JSON.stringify(responseData).slice(0, 500));
    return String(translation).trim();
  },

  async _translateMicrosoft(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("微软翻译文本为空");
    const endpoint = (api.baseUrl || "https://api.cognitive.microsofttranslator.com/translate").trim();
    const query = "api-version=3.0&to=zh";
    const url = endpoint + (endpoint.indexOf("?") >= 0 ? "&" : "?") + query;
    const headers = {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": api.apiKey,
    };
    const body = [{ Text: source }];
    this._debugLog("Microsoft request URL: " + endpoint + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", url, {
      headers,
      body: JSON.stringify(body),
      responseType: "json",
    });
    let responseData = resp.response;
    if (typeof responseData === "string") {
      try { responseData = JSON.parse(responseData); }
      catch (e) { throw new Error("微软翻译返回的不是有效 JSON：" + responseData.slice(0, 200)); }
    }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && responseData.error && (responseData.error.message || responseData.error) || resp.statusText || "";
      throw new Error("微软翻译错误(" + resp.status + "): " + detail);
    }
    const translation = responseData && responseData[0] && responseData[0].translations && responseData[0].translations[0] && responseData[0].translations[0].text;
    if (!translation) throw new Error("微软翻译返回中没有 [].translations[].text：" + JSON.stringify(responseData).slice(0, 500));
    return String(translation).trim();
  },

  async _translateDeepL(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("DeepL 翻译文本为空");
    const base = (api.baseUrl || "https://api-free.deepl.com/v2").trim().replace(/\/+$/, "");
    const url = base + "/translate";
    const headers = {
      "Content-Type": "application/json",
      Authorization: "DeepL-Auth-Key " + api.apiKey,
    };
    const body = {
      text: [source],
      target_lang: "ZH",
    };
    this._debugLog("DeepL request URL: " + url + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", url, {
      headers,
      body: JSON.stringify(body),
      responseType: "json",
    });
    let responseData = resp.response;
    if (typeof responseData === "string") {
      try { responseData = JSON.parse(responseData); }
      catch (e) { throw new Error("DeepL 返回的不是有效 JSON：" + responseData.slice(0, 200)); }
    }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && responseData.message || resp.statusText || "";
      throw new Error("DeepL 错误(" + resp.status + "): " + detail);
    }
    const translation = responseData && responseData.translations && responseData.translations[0] && responseData.translations[0].text;
    if (!translation) throw new Error("DeepL 返回中没有 translations[0].text：" + JSON.stringify(responseData).slice(0, 500));
    return String(translation).trim();
  },

  async _translateGoogle(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("Google 翻译文本为空");
    const endpoint = (api.baseUrl || "https://translate.googleapis.com/translate_a/single")
      .trim()
      .replace(/\/+$/, "");
    // 429/403 与网络错误视为"此 client 被限流/不可达"，换下一个 client 重试；其余 HTTP 错误直接抛出。
    let lastError = null;
    for (const client of [_googleClientId].concat(_GOOGLE_CLIENT_CANDIDATES.filter((c) => c !== _googleClientId))) {
      const url = endpoint + "?client=" + client + "&sl=en&tl=zh&dt=t&q=" + encodeURIComponent(source);
      let resp = null;
      try {
        resp = await Zotero.HTTP.request("GET", url, { responseType: "json" });
      } catch (e) {
        lastError = e;
        this._debugLog("Google client=" + client + " request ERROR: " + (e && (e.message || e)));
        continue;
      }
      this._debugLog("Google client=" + client + " status=" + (resp && resp.status) + " | textLength=" + source.length);
      if (resp.status === 429 || resp.status === 403) {
        lastError = new Error("Google 翻译被限流(" + resp.status + ") client=" + client);
        continue;
      }
      if (resp.status < 200 || resp.status >= 300) {
        const detail = resp.statusText || ("HTTP " + resp.status);
        throw new Error("Google 翻译错误(" + resp.status + "): " + detail);
      }
      let responseData = resp.response;
      if (typeof responseData === "string") {
        try { responseData = JSON.parse(responseData); }
        catch (e) { throw new Error("Google 翻译返回的不是有效 JSON：" + responseData.slice(0, 200)); }
      }
      const segments = responseData && responseData[0];
      const translation = Array.isArray(segments)
        ? segments.map(function (segment) { return segment && segment[0] || ""; }).join("").trim()
        : "";
      if (!translation) throw new Error("Google 翻译返回中没有 [0][].0：" + JSON.stringify(responseData).slice(0, 500));
      if (client !== _googleClientId) { _googleClientId = client; }
      return translation;
    }
    throw lastError || new Error("Google 翻译失败：所有候选 client 均被限流");
  },

  // 提示词构造单一来源：OpenAI 兼容路径与 Claude 适配器共用。
  // split 模式 → { system, user }；combined 模式 → { system: "", user: 全局模板 }。
  // {{word}} 替换为待翻译文本。
  // Phase 8 {{context}}：promptUseContext 开启时，模板中的 {{context}} 替换为选区上下文；
  // 模板未写 {{context}} 且确有上下文时自动附加在末尾；关闭或无上下文时 {{context}} 清空。
  _buildPromptParts(text, context) {
    const D = WordTranslatorConfig.DEFAULTS;
    const promptMode = (this._data && this._data.promptMode) || "split";
    const useCtx = !!(this._data && this._data.promptUseContext === true);
    const ctxText = String(context || "").trim();
    const applyContext = (user) => {
      let u = String(user || "");
      if (useCtx && ctxText) {
        if (u.indexOf("{{context}}") >= 0) u = u.split("{{context}}").join(ctxText);
        else u += "\n（该词所在上下文：" + ctxText + "）";
      }
      return u.split("{{context}}").join("");
    };
    if (promptMode === "combined") {
      const globalTemplate = (this._data && this._data.promptGlobal) || D.promptGlobal;
      return { system: "", user: applyContext(String(globalTemplate || "")).split("{{word}}").join(text) };
    }
    const system = (this._data && this._data.promptSystem) || D.promptSystem;
    const userTemplate = (this._data && this._data.promptUser) || D.promptUser;
    return { system: String(system || ""), user: applyContext(String(userTemplate || "")).split("{{word}}").join(text) };
  },

  // SSE 流解析（纯函数，可离线单测）：把 buffer+chunk 拆成完整的 "data: ..." 事件行。
  // 返回 { events: string[], rest: string }；rest 是末尾残缺行，留给下一个 chunk 拼接。
  // 兼容 \n 与 \r\n 行尾、有无空格的 "data:" 前缀。
  _parseSSEChunk(buffer, chunk) {
    const events = [];
    let rest = String(buffer || "") + String(chunk || "");
    let idx;
    while ((idx = rest.indexOf("\n")) >= 0) {
      const line = rest.slice(0, idx).replace(/\r$/, "");
      rest = rest.slice(idx + 1);
      if (line.startsWith("data: ")) events.push(line.slice(6).trim());
      else if (line.startsWith("data:")) events.push(line.slice(5).trim());
    }
    return { events, rest };
  },

  async translate(text, apiOverride, onChunk, context) {
    const api = apiOverride || this.getActiveApi();
    if (!api) throw new Error("未配置 API（请到设置->单词翻译 中添加 API）");
    const provider = api.provider || (api.type === "deepseek" ? "deepseek" : "openai");
    const adapterMethod = this._translateAdapters.get(provider);
    if (adapterMethod && typeof this[adapterMethod] === "function") {
      // 非流式适配器（Google/DeepL 等）一次性返回；若传入 onChunk 则返回后回调一次完整结果
      // （第 4 参 context 仅被 Claude 适配器使用，其余适配器忽略）
      const result = await this[adapterMethod](text, api, context);
      if (typeof onChunk === "function" && result) {
        try { onChunk(String(result)); } catch (e) {}
      }
      return result;
    }
    const parts = this._buildPromptParts(text, context);
    const messages = [];
    if (parts.system) messages.push({ role: "system", content: parts.system });
    messages.push({ role: "user", content: parts.user });
    const body = {
      model: api.model,
      messages,
      temperature: 0.3,
      stream: !!onChunk,
    };
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + api.apiKey,
    };
    let base = (api.baseUrl || "").trim().replace(/\/+$/, "");
    if (!base) {
      const defaultUrls = {
        deepseek: "https://api.deepseek.com",
        "qwen-mt": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      };
      base = defaultUrls[provider] || "https://api.openai.com/v1";
    }
    const url = base + "/chat/completions";
    this._debugLog("request URL: " + url + " | model=" + (api.model || "(none)"));
    let responseData;
        let respStatus = 200;
        let respStatusText = "";
        let streamed = false;
        // 流式仅在 fetch 可用时启用；无 fetch 的环境回退非流式，结束后一次性回调 onChunk
        if (typeof onChunk === "function" && typeof fetch === "function") {
          streamed = true;
          // 流式输出：使用 fetch + SSE 逐行解析（LLM 场景）
          const fetchResp = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });
          respStatus = fetchResp.status;
          if (!fetchResp.ok) {
            const errText = await fetchResp.text().catch(() => "");
            throw new Error("API 错误(" + fetchResp.status + "): " + errText.slice(0, 200));
          }
          const reader = fetchResp.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";
          let sseBuffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            // 行缓冲解析：跨 chunk 被劈开的 data 行会在下一轮拼齐
            // （旧版 split("\\n") 拆的是字面量反斜杠且无行缓冲，流式必然解析失败）
            const sseParsed = this._parseSSEChunk(sseBuffer, chunk);
            sseBuffer = sseParsed.rest;
            for (const data of sseParsed.events) {
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content;
                if (delta) {
                  accumulated += delta;
                  try { onChunk(accumulated); } catch (e) {}
                }
              } catch (e) {}
            }
          }
          responseData = { choices: [{ message: { content: accumulated } }] };
        } else {
          const resp = await Zotero.HTTP.request("POST", url, {
            headers,
            body: JSON.stringify(body),
            responseType: "json",
          });
          respStatus = resp.status;
          respStatusText = resp.statusText;
          responseData = resp.response;
          if (typeof responseData === "string") {
            try { responseData = JSON.parse(responseData); }
            catch (e) { throw new Error("API 返回的不是有效 JSON：" + responseData.slice(0, 200)); }
          }
        }
        if (respStatus < 200 || respStatus >= 300) {
          const detail = responseData && responseData.error && (responseData.error.message || responseData.error) || responseData && responseData.message || respStatusText || "";
          throw new Error("API 错误(" + respStatus + "): " + detail);
        }
    const content = (responseData && responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content) || "";
    if (!content) {
      throw new Error("API 返回中没有 choices[0].message.content：" + JSON.stringify(responseData).slice(0, 500));
    }
    if (typeof onChunk === "function" && !streamed) {
      // 非流式路径拿到完整结果后一次性回调，保持 onChunk 契约（临时编辑框据此收尾）
      try { onChunk(String(content)); } catch (e) {}
    }
    return String(content).trim();
  },
async testApi(api) {
    // 测试必须落到成功/失败，不能因网络挂起永远停在"测试中…"：加超时兜底，并把失败原因透出。
    const TEST_TIMEOUT = 15000;
    let timer;
    try {
      const result = await Promise.race([
        this.translate("translation", api),
        new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error("测试超时（15 秒未返回）")); }, TEST_TIMEOUT); }),
      ]);
      return { ok: !!result, message: "翻译成功" };
    } catch (e) {
      return { ok: false, message: (e && e.message) || String(e) };
    } finally {
      clearTimeout(timer);
    }
  },
};

if (typeof WordTranslator !== "undefined") {
  try { Object.assign(WordTranslator, WordTranslatorModule_translate); } catch (e) { try { Zotero.debug("[WordTranslator] module translate assign ERROR: " + (e && (e.stack || e.message || e))); } catch (e2) {} }
}
