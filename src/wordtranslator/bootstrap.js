"use strict";

// Word Translator for Zotero 引导脚本（适配 Zotero 7/8/9/10）

var chromeHandle;

function logError(err) {
    try {
      var msg = (err && (err.stack || err.message || String(err))) || String(err);
      var line = "[" + new Date().toISOString() + "] [bootstrap] " + msg + "\n";
      var profileDir = null;
      try { profileDir = (Zotero && Zotero.ProfileDir) ? Zotero.ProfileDir : (Zotero && Zotero.profileDirectory ? Zotero.profileDirectory : null); } catch (e0) {}
      if (!profileDir) { try { Zotero.debug("[bootstrap] " + msg); } catch (e1) {} return; }
      var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      try { file.initWithFile(profileDir); } catch (e1) { file.initWithPath(profileDir.path || String(profileDir)); }
      file.append("wordtranslator-debug.log");
      var out = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      out.init(file, 0x02 | 0x08 | 0x10, 0o666, 0);
      var conv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter;1"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
      conv.charset = "UTF-8";
      var stream = conv.convertToInputStream(line);
      var available = stream.available();
      var bytes = stream.readBytes(available);
      var bstream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
      bstream.setOutputStream(out);
      bstream.writeBytes(bytes, available);
      bstream.close();
      out.close();
      try { Zotero.debug("[bootstrap] " + msg); } catch (e3) {}
    } catch (e2) {
      try { Zotero.debug("[bootstrap][logwrite-fail] " + (e2 && e2.message || e2)); } catch (e3) {}
    }
  }

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  try {
    await Zotero.initializationPromise;

    if (!rootURI) {
      rootURI = resourceURI.spec;
    }

    // 确保 Zotero 主进程模块已加载（Zotero 7+ 用 importESModule，Components.utils.import 已移除）。
    // zoteropdftranslate 也是这样做的：ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs")
    try {
      ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
    } catch (e0) {
      logError("import zotero.mjs: " + e0);
    }

    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "wordtranslator", rootURI + "content/"],
    ]);

    // 桥接全局变量（Components 是 bootstrap 作用域全局，必须显式注入，否则 addon.js 的日志/文件写会抛 ReferenceError）
    const ctx = {
      addonID: id,
      addonVersion: version,
      addonRoot: rootURI,
    };
    ctx._globalThis = ctx;
    ctx.Zotero = Zotero;
    ctx.Services = Services;
    ctx.Components = Components;

    Services.scriptloader.loadSubScript(rootURI + "content/scripts/addon.js", ctx);

    if (Zotero.WordTranslator) {
      Zotero.WordTranslator.addonID = id;
      Zotero.WordTranslator.addonRoot = rootURI;
      await Zotero.WordTranslator.init();
    } else {
      logError("Zotero.WordTranslator is undefined after loadSubScript");
    }
  } catch (e) {
    logError(e);
  }
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }
  if (typeof Zotero !== "undefined" && Zotero.WordTranslator) {
    try {
      Zotero.WordTranslator.shutdown(reason);
    } catch (e) {
      logError(e);
    }
  }
  if (chromeHandle) {
    try {
      chromeHandle.destruct();
    } catch (e) {}
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}
