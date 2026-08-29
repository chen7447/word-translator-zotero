"use strict";

// Word Translator for Zotero 核心模块（适配 Zotero 7/8/9/10）
// 依赖：Zotero.Prefs（Zotero 7+ 标准偏好）
// 功能：
//   1. PDF 阅读器划词菜单注入"添加单词并翻译"按钮（带 SVG 图标）
//   2. 调 OpenAI/DeepSeek 兼容接口翻译专业英文单词
//   3. 在右侧 Item Pane 面板以卡片形式展示 [单词 -- 译文]，可逐条删除
//   4. Item Pane 头部下拉切换当前 API；多 API 配置在偏好面板完成

var WordTranslator = {
  // 卡片状态占位常量：状态判断一律走 pending 布尔与这两个常量，
  // 禁止在业务逻辑里散落比较显示字符串（旧版 "翻译中…"/"正在翻译…" 混用导致失败卡重译失效）。
  STATUS_TRANSLATING: "翻译中…",
  STATUS_FAILED: "翻译失败",
  hooks: {
    onPrefsLoad(event) {
      WordTranslator.onPrefsLoad(event);
    },
    onPrefsUnload(event) {
      WordTranslator.onPrefsUnload(event);
    },
  },
  _data: null,
  _initialized: false,
  _addonRoot: "",
  _addonID: "",
  _addonVersion: "",
  _buildTime: "",
  _prefWindowLoaded: false,
  _paneRefresh: null,
  _selectionFirstPending: null,
  // 偏好页配置的“快捷键-划词翻译”统一全局按键状态；不为 Alt/Ctrl 等分别注册状态。
  _selectionTranslateKeyState: null,
  _selectionTranslateSession: null,
  _hotkeyGlobalBound: false,
  _addWordHotkeyFired: false,
  _hotkeyBoundWindows: null,
  // 重载清理用：记录绑定在共享 DOM/window 上的监听器引用，shutdown 时统一移除，
  // 防止插件更新/重载后旧实例监听器残留导致新旧双份监听器并存。
  _globalHotkeyHandlers: null,
  _hotkeyResetHandlers: null,
  _hotkeyReaderHandlers: null,
  _tempEditState: null,
  _tempEditBound: false,
  _tempEditCloseHandler: null,
  _lastSelectionPopup: null,
  // 鼠标侧键桥接（系统层检测 XButton1/XButton2，绕过浏览器侧键拦截）
  _lastAutoWord: null,        // 自动翻译去重：上一个自动添加的文本
  _lastAutoTime: 0,
  _lastHotkeyKey: null,       // 快捷键触发去重键
  _lastHotkeyTime: 0,
  _lastPrefsRefresh: 0,       // 配置读盘节流时间戳
  _lastPrefsMtime: 0,         // 配置文件 mtime 缓存
  _readerTabHandlers: null,   // Reader 事件监听记录
  _hotkeyToolbarHandler: null,// renderToolbar 监听（快捷键绑定入口）
  _notifierID: null,          // 条目删除观察者 id
  _prefsPaneID: null,         // 偏好面板注册 id

  _getProfileDir() {
    try {
      if (Zotero && Zotero.Profile && Zotero.Profile.dir) {
        return String(Zotero.Profile.dir);
      }
    } catch (e) {}
    try {
      if (Zotero && typeof Zotero.getProfileDirectory === "function") {
        const d = Zotero.getProfileDirectory();
        if (d) return d;
      }
    } catch (e) {}
    try {
      if (Zotero && Zotero.ProfileDir) return Zotero.ProfileDir;
    } catch (e) {}
    try {
      if (Zotero && Zotero.profileDirectory) return Zotero.profileDirectory;
    } catch (e) {}
    try {
      if (typeof Services !== "undefined" && Services.dirsvc && typeof Components !== "undefined") {
        const d = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
        if (d) return d;
      }
    } catch (e) {}
    return null;
  },

  _debugWriteToFile(msg) {
    try {
      if (typeof Components === "undefined") return;
      var profileDir = null;
      try { profileDir = this._getProfileDir(); } catch (e0) {}
      if (!profileDir) return;
      var line = "[" + new Date().toISOString() + "] [WordTranslator] " + String(msg) + "\n";
      var wfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      try { wfile.initWithFile(profileDir); } catch (e1) { wfile.initWithPath(profileDir.path || String(profileDir)); }
      wfile.append("wordtranslator-debug.log");
      // 超过 2MB 时轮转：删除旧 .1，重命名当前文件为 .1（保留最近 2 份）
      if (wfile.exists() && wfile.fileSize > 2 * 1024 * 1024) {
        var bak = wfile.clone();
        bak.leafName = "wordtranslator-debug.log.1";
        if (bak.exists()) { try { bak.remove(false); } catch (e) {} }
        try { wfile.moveTo(null, "wordtranslator-debug.log.1"); } catch (e) {}
      }
      var wout = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      wout.init(wfile, 0x02 | 0x08 | 0x10, 0o666, 0);
      var wconv = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
      wconv.init(wout, "UTF-8", 4096, 0xFFFD);
      wconv.writeString(line);
      wconv.close();
      wout.close();
    } catch (e) {
      try { Zotero.debug("[WordTranslator][logwrite-fail] " + msg + " :: " + (e && e.message || e)); } catch (e2) {}
    }
  },

  _debugLog(msg, level) {
    const isTrace = level === "trace";
    // trace 级 = 高频触发路径（划词 popup/按键/鼠标事件等），仅在偏好页显式开启
    // debugLog 时输出，避免错误控制台被高频日志刷屏；普通日志维持始终输出。
    if (isTrace && !(this._data && this._data.debugLog)) return;
    try { Zotero.debug("[WordTranslator] " + msg); } catch (e) {}
    // 写文件受 debugLog 开关控制（默认关）；Zotero.debug 控制台输出不受影响
    if (this._data && this._data.debugLog) {
      this._debugWriteToFile(msg);
    }
  },

  _openExternalURL(url) {
    try {
      if (!url) return false;
      this._debugLog("_openExternalURL: " + url);
      // 优先：Zotero.Utilities.Internal.openInShell。Zotero 9 常定义为外部资源打开
      try {
        if (Zotero.Utilities && Zotero.Utilities.Internal && typeof Zotero.Utilities.Internal.openInShell === "function") {
          Zotero.Utilities.Internal.openInShell(url);
          return true;
        }
      } catch (e) { this._debugLog("_openExternalURL openInShell ERROR: " + (e && e.message || e)); }
      // 回退：cmd.exe /c start 直开（Windows ShellExecute，无弹窗），支持 ms-settings: 和 http(s) 等
      try {
        const file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        file.initWithPath("C:\\Windows\\System32\\cmd.exe");
        const proc = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
        proc.init(file);
        proc.run(false, ["/c", "start", "", url], 4);
        return true;
      } catch (e) { this._debugLog("_openExternalURL cmd start ERROR: " + (e && e.message || e)); }
      // 最后兜底：nsIExternalProtocolService（可能弹权限框，仅作兜底）
      try {
        const io = Services.io;
        const eps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
        eps.loadURI(io.newURI(url, null, null), null);
        return true;
      } catch (e) { this._debugLog("_openExternalURL ext-protocol ERROR: " + (e && e.message || e)); }
      // 最后兜底：复制到剪贴板
      try {
        const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
        clipboardHelper.copyString(url);
        return false;
      } catch (e) {}
      return false;
    } catch (e) {
      this._debugLog("_openExternalURL ERROR: " + (e && (e.stack || e.message || String(e))));
      return false;
    }
  },
  _openInOS(path) {
    try {
      if (!path) return false;
      this._debugLog("_openInOS: " + path);
      // 1) nsIFile.launch()
      try {
        const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        f.initWithPath(path);
        if (f.exists()) {
          f.launch();
          return true;
        }
      } catch (e) { this._debugLog("_openInOS nsIFile ERROR: " + (e && e.message || e)); }
      // 2) Zotero.Utilities.Internal.openInShell
      try {
        if (Zotero.Utilities && Zotero.Utilities.Internal && typeof Zotero.Utilities.Internal.openInShell === "function") {
          Zotero.Utilities.Internal.openInShell(path);
          return true;
        }
      } catch (e) { this._debugLog("_openInOS openInShell ERROR: " + (e && e.message || e)); }
      // 3) 复制到剪贴板
      try {
        const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
        clipboardHelper.copyString(path);
        return false;
      } catch (e) {}
      return false;
    } catch (e) {
      this._debugLog("_openInOS ERROR: " + (e && (e.stack || e.message || String(e))));
      return false;
    }
  },

_configVersion: 0,

  // ---------- 检查更新 ----------
  // 更新清单：GitHub raw 与 jsDelivr 并行拉取，取版本号更高的那份
  _updateCheckUrls: [
    "https://raw.githubusercontent.com/chen7447/word-translator-zotero/main/update.json",
    "https://cdn.jsdelivr.net/gh/chen7447/word-translator-zotero@main/update.json",
  ],
  // 检查结果缓存 { at, result }
  _updateCheckCache: null,
  // 缓存有效期（毫秒），默认 10 分钟
  _updateCheckCacheTTL: 10 * 60 * 1000,

  // 比较两个版本号，返回 >0(a>b) / <0(a<b) / 0(a=b)
  // 支持 "6.9.5" 和 "6.9.0b5" 混合比较：b 后缀 < 同级稳定版
  _compareVersions(a, b) {
    function _parts(v) {
      const s = String(v || "").trim().toLowerCase();
      // 匹配主.次.修订.补丁 以及可选的 a/b 预发布标记
      const m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?(?:([ab])(\d+))?/);
      if (!m) return [0];
      // 主次修订补丁的数字部分
      const nums = [m[1] || 0, m[2] || 0, m[3] || 0, m[4] || 0].map(Number);
      // 预发布标记：a = -2, b = -1, 稳定版 = 0
      const pre = m[5] ? (m[5] === "a" ? -2 : -1) : 0;
      const preN = m[6] ? Number(m[6]) : 0; // 预发布版本号
      return [...nums, pre, preN];
    }
    const pa = _parts(a), pb = _parts(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const x = i < pa.length ? pa[i] : 0;
      const y = i < pb.length ? pb[i] : 0;
      if (x !== y) return x - y;
    }
    return 0;
  },

  _updateSourceName(url) {
    return String(url || "").indexOf("jsdelivr") >= 0 ? "jsDelivr" : "GitHub";
  },

  _latestFromManifest(manifest) {
    const addonId = this._addonID || "wordtranslator@example.com";
    const updates = manifest && manifest.addons && manifest.addons[addonId] && manifest.addons[addonId].updates;
    if (!Array.isArray(updates) || updates.length === 0) return null;
    let latest = null;
    for (const entry of updates) {
      const ver = entry && entry.version;
      if (!ver) continue;
      if (!latest || this._compareVersions(ver, latest.version) > 0) {
        latest = { version: ver, link: entry.update_link || "" };
      }
    }
    if (!latest) return null;
    latest.list = updates.map((u) => ({ version: u.version, link: u.update_link }));
    return latest;
  },

  // 检查更新：并行拉所有源，取版本号更高的那份。force=true 跳过缓存
  // 返回 { hasUpdate, currentVersion, latestVersion, updateLink, error, list, sources }
  async checkForUpdates(force) {
    const now = Date.now();
    if (!force && this._updateCheckCache && (now - this._updateCheckCache.at) < this._updateCheckCacheTTL) {
      return this._updateCheckCache.result;
    }

    const currentVer = this._addonVersion || "4.0.1";
    const result = {
      hasUpdate: false,
      currentVersion: currentVer,
      latestVersion: "",
      updateLink: "",
      error: null,
      list: [],
      sources: [],
    };

    const fetched = await Promise.all(this._updateCheckUrls.map(async (url) => {
      const name = this._updateSourceName(url);
      const fetchUrl = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + now;
      try {
        const resp = await Zotero.HTTP.request("GET", fetchUrl, { responseType: "json" });
        if (resp && resp.status === 200 && resp.response) {
          return { name, manifest: resp.response, error: null };
        }
        return { name, manifest: null, error: "HTTP " + ((resp && resp.status) || "?") };
      } catch (e) {
        return { name, manifest: null, error: String(e && (e.message || e)) };
      }
    }));

    let best = null;
    for (const src of fetched) {
      if (!src.manifest) {
        result.sources.push({ name: src.name, version: "", error: src.error });
        continue;
      }
      const latest = this._latestFromManifest(src.manifest);
      if (!latest) {
        result.sources.push({ name: src.name, version: "", error: "更新清单中未找到版本信息" });
        continue;
      }
      result.sources.push({ name: src.name, version: latest.version, error: null });
      if (!best || this._compareVersions(latest.version, best.version) > 0) {
        best = latest;
      }
    }

    if (!best) {
      result.error = "无法获取更新清单（网络不可用或链接失效）";
      this._updateCheckCache = { at: now, result };
      return result;
    }

    result.list = best.list || [];
    result.latestVersion = best.version;
    result.updateLink = best.link || "";
    if (this._compareVersions(best.version, currentVer) > 0) result.hasUpdate = true;

    this._updateCheckCache = { at: now, result };
    this._debugLog("checkForUpdates: current=" + currentVer + ", latest=" + result.latestVersion + ", hasUpdate=" + result.hasUpdate + ", sources=" + JSON.stringify(result.sources));
    return result;
  },

  _onConfigChange() {
    try {
      this._configVersion++;
      this._debugLog("_onConfigChange: version=" + this._configVersion);
      // 通知 Item Pane 刷新（custom sections 需要重新渲染）
      if (Zotero && Zotero.Notifier && typeof Zotero.Notifier.trigger === "function") {
        Zotero.Notifier.trigger("refresh", "itempane", []).catch(function (e) { try { Zotero.debug("[WordTranslator] notifier trigger ERROR: " + (e && (e.message || e))); } catch (e2) {} });
      }
      // 双保险：再调用一次 pane 自身的 refresh 回调
      if (this._paneRefresh && typeof this._paneRefresh === "function") {
        try { this._paneRefresh(); } catch (e) { this._debugLog("paneRefresh notify ERROR: " + (e && e.message || e)); }
      }
    } catch (e) {
      this._debugLog("_onConfigChange ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  shutdown(reason) {
    try {
      // 插件更新/重载时旧实例会遗留 DOM 事件监听器，导致新旧双份监听器并存、
      // 划词状态错乱（重启 Zotero 才会恢复）。这里统一移除并重置持久标记。
      try { this._cleanupHotkeyDomListeners(); } catch (e2) {}
      // 无论原因，关闭/升级/禁用时都立即写盘，避免防抖定时器未触发导致数据丢失
      try { this._flushAndPersistWords(); } catch (e2) {}
      // 字典缓存落盘
      try { if (Zotero.WordTranslatorDict && typeof Zotero.WordTranslatorDict.flush === "function") Zotero.WordTranslatorDict.flush(); } catch (e2) {}
      for (const [, handler] of this._readerTabHandlers || []) {
        try { Zotero.Reader.unregisterEventListener("renderTextSelectionPopup", handler); } catch (e) {}
      }
      (this._readerTabHandlers = new Map()).clear();
      try {
        if (Zotero.Notifier && this._notifierID) Zotero.Notifier.unregisterObserver(this._notifierID);
      } catch (e) {}
      try {
        if (this._paneKey && Zotero.ItemPaneManager && Zotero.ItemPaneManager.unregisterSection) {
          Zotero.ItemPaneManager.unregisterSection(this._paneKey);
        }
      } catch (e) {}
      this._paneKey = null;
      // 注销偏好页（防止更新后旧 pane 残留导致新标签不显示）
      try {
        if (this._prefsPaneID && Zotero.PreferencePanes && typeof Zotero.PreferencePanes.unregister === "function") {
          try { Zotero.PreferencePanes.unregister(this._prefsPaneID); } catch (e0) {}
        }
      } catch (e0) {}
      this._prefsPaneID = null;
      try { this._hideCardMenu(); } catch (e2) {}
      // 停止鼠标侧键桥接
      try { this._stopXButtonBridge(); } catch (e2) {}
      this._initialized = false;
    } catch (e) {
      // shutdown 整体异常必须有痕：这里的静默失败曾让注销死代码藏了几十个版本
      try { Zotero.debug("[WordTranslator] shutdown ERROR: " + (e && (e.stack || e.message || String(e)))); } catch (e2) {}
    }
  },

  async init() {
    try {
      if (this._initialized) return;
      this._initialized = true;
      this._addonRoot = (typeof addonRoot !== 'undefined' && addonRoot) ? addonRoot : '';
      this._addonID = (typeof addonID !== 'undefined' && addonID) ? addonID : '';
      this._addonVersion = (typeof addonVersion !== 'undefined' && addonVersion) ? addonVersion : '';
      if (!this._buildTime) this._buildTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      try {
        Zotero.WordTranslator.addonVersion = this._addonVersion;
        Zotero.WordTranslator.buildTime = this._buildTime;
        try {
          let pp = null;
          const prof = this._getProfileDir();
          if (prof && typeof prof === "object") { try { pp = prof.path; } catch (e) {} if (!pp) try { pp = String(prof); } catch (e) {} }
          else if (typeof prof === "string") pp = prof;
          if (pp) {
            const sep = pp.indexOf("\\") >= 0 ? "\\" : "/";
            Zotero.WordTranslator.prefsPath = pp.replace(/[\\/]+$/, "") + sep + "prefs.js";
            // 预计算数据目录路径（纯字符串，偏好沙箱可直接读取，避免沙箱内 Components 不可用）
            const baseDir = pp.replace(/[\\/]+$/, "") + sep + "wordtranslator";
            Zotero.WordTranslator.dataDirPath = baseDir;
            Zotero.WordTranslator.apiConfigPath = baseDir + sep + "api-config.json";
            Zotero.WordTranslator.wordsDirPath = baseDir + sep + "words";
          }
        } catch (e) {}
      } catch (e) {}
        // 暴露其他资源给偏好面板使用
        try { Zotero.WordTranslator.openExternalURL = (url) => this._openExternalURL(url); } catch (e) {}
        try { Zotero.WordTranslator.getDataDirPath = () => Zotero.WordTranslator.dataDirPath || (Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getDataDirPath()) || ""; } catch (e) {}
        try { Zotero.WordTranslator.getApiConfigPath = () => Zotero.WordTranslator.apiConfigPath || (Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getApiConfigPath()) || ""; } catch (e) {}
        try { Zotero.WordTranslator.getWordsDirPath = () => Zotero.WordTranslator.wordsDirPath || (Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getWordsDirPath()) || ""; } catch (e) {}
        try { Zotero.WordTranslator.openDataDir = () => this._openInOS(Zotero.WordTranslator.dataDirPath || (Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getDataDirPath()) || ""); } catch (e) {}
        try { Zotero.WordTranslator.openInOS = (path) => this._openInOS(path); } catch (e) {}
        // 偏好沙箱读取助手：返回 JSON 字符串（沙箱内无 Components，不能直接调 storage.js）
        try { Zotero.WordTranslator.readApiConfigString = () => { try { const S = Zotero.WordTranslatorStorage; if (S && typeof S.loadApiConfig === "function") { const obj = S.loadApiConfig(); return obj ? JSON.stringify(obj) : ""; } } catch (e0) {} return ""; }; } catch (e) {}
        try { Zotero.WordTranslator.writeApiConfigString = (jsonStr) => { try { const S = Zotero.WordTranslatorStorage; if (S && typeof S.saveApiConfig === "function") { const obj = jsonStr ? JSON.parse(jsonStr) : null; return !!S.saveApiConfig(obj); } } catch (e0) {} return false; }; } catch (e) {}
        // 字典服务：偏好页"测试"按钮桥接（镜像 testApi）
        try { Zotero.WordTranslator.testDict = () => (Zotero.WordTranslatorDict && Zotero.WordTranslatorDict.test()) || Promise.resolve({ ok: false, message: "字典模块未加载" }); } catch (e) {}
      await this.loadDataFromDisk();
      // 字典服务：词级缓存并入内存（此后渲染只读内存缓存，不触网）
      try { if (Zotero.WordTranslatorDict && typeof Zotero.WordTranslatorDict.loadCache === "function") Zotero.WordTranslatorDict.loadCache(); } catch (e) {}
      this._loadWordsFromDisk();
      this._sortMode = this._data.sortMode || "reverse";
      this._activeSearchStrategy = this._getActiveSearchStrategyName();
      // 主动验证存储层：确保数据目录存在并写盘（输出日志便于定位写文件失败）
      try {
        if (Zotero.WordTranslatorStorage) {
          const dir = Zotero.WordTranslatorStorage.getDataDirPath();
          const apiPath = Zotero.WordTranslatorStorage.getApiConfigPath();
          this._debugLog("storage verify: dataDir=" + dir + ", apiPath=" + apiPath);
          if (this._data && this._data.apis && this._data.apis.length > 0) {
            const ok = Zotero.WordTranslatorStorage.saveApiConfig(this._data);
            this._debugLog("storage verify: saveApiConfig=" + ok + ", apis=" + this._data.apis.length);
          }
        } else {
          this._debugLog("storage verify: WordTranslatorStorage NOT FOUND");
        }
      } catch (e) { this._debugLog("storage verify ERROR: " + (e && (e.stack || e.message || String(e)))); }
      // 启动路径检测：明确打印数据文件是否存在，便于排查
      try {
        if (Zotero.WordTranslatorStorage) {
          const dirP = Zotero.WordTranslatorStorage.getDataDirPath();
          const apiP = Zotero.WordTranslatorStorage.getApiConfigPath();
          const wordsDir = Zotero.WordTranslatorStorage.getWordsDirPath();
          let apiExists = false;
          let wordsExists = false;
          try {
            const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
            f.initWithPath(apiP);
            apiExists = f.exists();
          } catch (e4) {}
          try {
            const f2 = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
            f2.initWithPath(wordsDir);
            wordsExists = f2.exists() && f2.isDirectory();
          } catch (e5) {}
          this._debugLog("storage paths: dataDir=" + dirP + " | apiConfig=" + apiP + " (exists=" + apiExists + ") | wordsDir=" + wordsDir + " (exists=" + wordsExists + ")");
        }
      } catch (e6) {}
      await this.registerPrefsWindow();
      this.registerReaderEvents();
      this.registerItemPaneSection();
      // 条目删除观察：同步清理 words/<id>.json 防孤儿文件（Phase 3）
      this.registerItemNotifier();
      // 鼠标侧键桥接启动：延迟 500ms 确保 Zotero 子系统就绪（升级场景下 Subprocess
      // 等模块可能尚未加载），失败后自动重试 2 次，共 3 次机会。
      const selfBridge = this;
      (async function _bridgeInit() {
        for (let ai = 0; ai < 3; ai++) {
          if (selfBridge._xbuttonBridge.active) return;
          await new Promise(r => setTimeout(r, ai === 0 ? 500 : 1000));
          try { await selfBridge._startXButtonBridge(); } catch (e) {
            selfBridge._debugLog("xbutton bridge init attempt " + (ai + 1) + " ERROR: " + (e && (e.message || e)));
          }
        }
      })();
      // Beta：插件更新/加载后延迟强制重渲染当前 Item Pane，
      // 确保单词本立即显示本地已加载数据（热更新后 Item Pane 不会自动重画）
      try {
        const self = this;
        setTimeout(function () {
          try { self._rerenderCurrentItemPane("post-init"); } catch (e) {}
        }, 1500);
      } catch (e) {}
      this._debugLog("init OK; root=" + this._addonRoot);
    } catch (e) {
      this._debugLog("init ERROR: " + (e && (e.stack || e.message || e)));
    }
  },

  async loadDataFromDisk() {
    try {
      // 优先读独立文件；无文件时回退读 prefs.js 旧数据（一次性迁移）
      let raw = null;
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.loadApiConfig === "function") {
        try { raw = Zotero.WordTranslatorStorage.loadApiConfig(); } catch (e0) {}
      }
      if (!raw) {
        const rawStr = Zotero.Prefs.get("extensions.zotero.wordtranslator.config", true);
        if (rawStr) { try { raw = JSON.parse(rawStr); } catch (e1) {} }
        if (raw) {
          this._debugLog("loadDataFromDisk: migrating old prefs config to file");
          try {
            if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.saveApiConfig === "function") {
              Zotero.WordTranslatorStorage.saveApiConfig(raw);
            }
          } catch (e2) {}
          try { Zotero.Prefs.clear && Zotero.Prefs.clear("extensions.zotero.wordtranslator.config", true); } catch (e3) {}
        }
      }
      this._data = this._normalize(raw);
      this._debugLog("loadDataFromDisk OK, apis=" + (this._data.apis || []).length);
    } catch (e) {
      this._debugLog("loadDataFromDisk ERROR: " + (e && (e.stack || e.message || e)));
      this._data = this._normalize(null);
    }
  },

  // ---------- 注册 Zotero 偏好页 ----------
  async registerPrefsWindow() {
    try {
      const rootURI = this._addonRoot.endsWith("/") ? this._addonRoot : this._addonRoot + "/";
      // 避免重复注册冲突：插件更新/重新安装后，旧版的 PreferencePane 仍可能残留。
      // 先 unregister 再 register，确保新版的 URL 生效。
      try {
        if (Zotero.PreferencePanes && typeof Zotero.PreferencePanes.unregister === "function" && this._prefsPaneID) {
          try { Zotero.PreferencePanes.unregister(this._prefsPaneID); } catch (e0) {}
        }
      } catch (e0) {}
      this._prefsPaneID = "wordtranslator-prefs";
      await Zotero.PreferencePanes.register({
        pluginID: this._addonID,
        id: this._prefsPaneID,
        src: rootURI + "content/preferences.xhtml",
        label: "单词翻译 Word Translator",
        image: rootURI + "content/icons/wordtranslator-section-20.svg",
        scripts: [rootURI + "content/preferences.js"],
      });
      this._debugLog("registerPrefsWindow OK: " + rootURI + "content/preferences.xhtml");
    } catch (e) {
      this._debugLog("registerPrefsWindow ERROR: " + (e && (e.stack || e.message || e)));
    }
  },

  // ---------- 注册划词菜单 ----------
  _refreshPrefsFromStorage(force) {
    try {
      const now = Date.now();
      if (!force && this._lastPrefsRefresh && (now - this._lastPrefsRefresh) < 250) {
        return true;
      }
      if (!Zotero || !Zotero.WordTranslatorStorage) return false;
      // 读取磁盘 mtime
      let mtime = 0;
      try {
        if (typeof Zotero.WordTranslatorStorage.getApiConfigMtime === "function") {
          mtime = Zotero.WordTranslatorStorage.getApiConfigMtime() || 0;
        }
      } catch (e0) {}
      if (!force && this._lastPrefsMtime && mtime && mtime === this._lastPrefsMtime) {
        this._lastPrefsRefresh = now;
        return true;
      }
      const raw = Zotero.WordTranslatorStorage.loadApiConfig();
      this._lastPrefsRefresh = now;
      if (!raw || typeof raw !== "object") {
        this._lastPrefsMtime = 0;
        return false;
      }
      this._data = this._normalize(raw);
      this._lastPrefsMtime = mtime;
      this._sortMode = this._data.sortMode || "reverse";
      this._activeSearchStrategy = this._getActiveSearchStrategyName();
      return true;
    } catch (e) {
      this._debugLog("_refreshPrefsFromStorage ERROR: " + (e && (e.message || String(e))));
      return false;
    }
  },

  // 强制失效缓存，使下一次 _refreshPrefsFromStorage() 一定会读盘。
  // preferences.js 的 save() 在写盘后会调用此方法，确保开关状态立即生效。
  _invalidatePrefsCache() {
    try { this._lastPrefsMtime = 0; this._lastPrefsRefresh = 0; } catch (e) {}
  },

  async _reloadDataFromDisk() {
    try {
      let raw = null;
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.loadApiConfig === "function") {
        try { raw = Zotero.WordTranslatorStorage.loadApiConfig(); } catch (e0) {}
      }
      if (!raw) {
        const rawStr = Zotero.Prefs.get("extensions.zotero.wordtranslator.config", true);
        if (rawStr) { try { raw = JSON.parse(rawStr); } catch (e1) {} }
      }
      // 仅当读到有效数据时才覆盖内存中的 _data；
      // 读到空时保留现有 _data（避免写入失败导致内存被冲掉）
      if (raw && typeof raw === "object") {
        this._data = this._normalize(raw);
      }
      this._debugLog("_reloadDataFromDisk: apis=" + ((this._data && this._data.apis && this._data.apis.length) || 0) + ", rawFromDisk=" + !!raw);
    } catch (e) {
      this._debugLog("_reloadDataFromDisk ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // 强制按当前 Zotero.ItemPane 激活的 item id 重渲染单词本 body
  registerItemNotifier() {
    try {
      if (!Zotero.Notifier || typeof Zotero.Notifier.registerObserver !== "function") return;
      if (this._notifierID) return;
      const self = this;
      this._notifierID = Zotero.Notifier.registerObserver({
        notify: function (event, type, ids) {
          try {
            if (event !== "delete" || type !== "item" || !Array.isArray(ids) || !ids.length) return;
            let cleaned = 0;
            for (const rawID of ids) {
              const id = Number(rawID);
              if (!Number.isFinite(id) || id <= 0) continue;
              if (!self._itemWords.has(id)) continue;
              self._itemWords.delete(id);
              try { if (self._wordBookViewState) self._wordBookViewState.delete(id); } catch (e0) {}
              try {
                const timer = self._wordBookSearchTimers && self._wordBookSearchTimers.get(id);
                if (timer) {
                  clearTimeout(timer);
                  self._wordBookSearchTimers.delete(id);
                }
              } catch (e1) {}
              try {
                const S = Zotero.WordTranslatorStorage;
                if (S && typeof S.cancelPendingSave === "function") S.cancelPendingSave(id);
                if (S && typeof S.saveWordsForItem === "function") S.saveWordsForItem(id, []); // 删除 words/<id>.json
              } catch (e2) {}
              cleaned++;
            }
            if (cleaned > 0) self._debugLog("notifier: cleaned word lists for " + cleaned + " deleted item(s)");
          } catch (e) {
            self._debugLog("notifier notify ERROR: " + (e && (e.stack || e.message || String(e))));
          }
        },
      }, ["item"], "wordtranslator");
      this._debugLog("item notifier registered: id=" + this._notifierID);
    } catch (e) {
      this._debugLog("registerItemNotifier ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // DOM 兜底：Fluent 未加载时直接设置 header label 和 sidenav tooltiptext
  onPrefsLoad(event) {
    // preferences.js 已由 PreferencePanes.register 的 scripts[] 在沙箱中自动加载，
    // 这里仅作兼容占位，不再手动 loadSubScript，避免重复加载。
    this._prefWindowLoaded = true;
  },

  onPrefsUnload(event) {
    this._prefWindowLoaded = false;
  },

  _normalize(raw) {
    // 配置 schema 单源化：默认值与校验逻辑统一在 config-schema.js
    return WordTranslatorConfig.normalize(raw);
  },

  getActiveApi() {
    const apis = (this._data && this._data.apis) || [];
    const i = (this._data && this._data.activeApiIndex) || 0;
    return apis[i] || apis[0] || null;
  },

  // ---- 单词本存储与读取（存于 profile/wordtranslator/words/ 下，按条目分文件；跨插件升级/重启）----
  _wordsPrefKey: "extensions.zotero.wordtranslator.words",

  _loadWordsFromDisk() {
    try {
      let migrated = false;
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.loadWordsMap === "function") {
        try {
          const map = Zotero.WordTranslatorStorage.loadWordsMap();
          this._itemWords = map;
          if (map.size > 0) migrated = true;
        } catch (e0) {}
      }
      // 旧版 prefs.js 数据迁移（仅当文件目录为空时）
      if (!migrated) {
        const raw = Zotero.Prefs.get(this._wordsPrefKey, true);
        if (raw) {
          this._debugLog("_loadWordsFromDisk: migrating old prefs words to files");
          const obj = JSON.parse(raw);
          this._itemWords = new Map();
          for (const k of Object.keys(obj || {})) {
            const id = Number(k);
            if (!Number.isFinite(id)) continue;
            const list = Array.isArray(obj[k]) ? obj[k].map(function (w) {
              const item = { word: String(w.word || ""), translation: String(w.translation || ""), pending: !!w.pending };
              const hl = String(w.highlight || "");
              if (hl === "amber" || hl === "sage" || hl === "blue" || hl === "rose") item.highlight = hl;
              return item;
            }) : [];
            if (list.length > 0) {
              this._itemWords.set(id, list);
              try {
                if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.saveWordsForItem === "function") {
                  Zotero.WordTranslatorStorage.saveWordsForItem(id, list);
                }
              } catch (e1) {}
            }
          }
          try { Zotero.Prefs.clear && Zotero.Prefs.clear(this._wordsPrefKey, true); } catch (e2) {}
        } else {
          this._debugLog("_loadWordsFromDisk: no persisted data");
        }
      }
      this._debugLog("_loadWordsFromDisk: loaded " + this._itemWords.size + " item(s)");
    } catch (e) {
      this._debugLog("_loadWordsFromDisk ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // 只调度单个条目的防抖保存：业务改动点（增删词/高亮/字典模式/重译等）一律走这里。
  // 旧版 _persistWords 每次改动对全部条目重新调度防抖写入（O(全部条目) 定时器风暴），已移除。
  _persistWordsForItem(itemID) {
    try {
      const id = Number(itemID);
      if (!Number.isFinite(id) || id <= 0) return;
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.saveWordsForItemDebounced === "function") {
        Zotero.WordTranslatorStorage.saveWordsForItemDebounced(id, this._itemWords.get(id) || [], 300);
        return;
      }
      // 兜底：仍写 prefs（无 storage 层时全量序列化）
      const obj = {};
      for (const [itemKey, l] of this._itemWords) {
        obj[String(itemKey)] = l;
      }
      Zotero.Prefs.set(this._wordsPrefKey, JSON.stringify(obj), true);
    } catch (e) {
      this._debugLog("_persistWordsForItem ERROR: " + (e && (e.message || String(e))));
    }
  },

  // 立即 flush 防抖定时器并将当前内存中的全部单词本数据写盘
  _flushAndPersistWords() {
    try {
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.flushAll === "function") {
        Zotero.WordTranslatorStorage.flushAll();
      }
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.saveWordsForItem === "function") {
        for (const [itemID, list] of this._itemWords) {
          try { Zotero.WordTranslatorStorage.saveWordsForItem(itemID, list); } catch (e1) {}
        }
        return;
      }
      const obj = {};
      for (const [itemID, list] of this._itemWords) {
        obj[String(itemID)] = list;
      }
      Zotero.Prefs.set(this._wordsPrefKey, JSON.stringify(obj), true);
    } catch (e) {
      this._debugLog("_flushAndPersistWords ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _saveData() {
    try {
      let ok = false;
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.saveApiConfig === "function") {
        ok = Zotero.WordTranslatorStorage.saveApiConfig(this._data);
      }
      if (!ok) {
        Zotero.Prefs.set("extensions.zotero.wordtranslator.config", JSON.stringify(this._data), true);
      }
      const main = Zotero.getMainWindow();
      if (main && main.document) {
        try {
          const ev = new main.document.defaultView.Event("wordtranslator-config-updated", { bubbles: false });
          main.document.dispatchEvent(ev);
        } catch (e2) {}
      }
    } catch (e) {
      this._debugLog("_saveData ERROR: " + (e && e.message || e));
    }
  },

  // ---------- 翻译 API ----------
  // 执行层 Provider 注册表：偏好页负责分组和配置；这里按协议分发请求。
  // 新服务只需注册执行方法；未注册服务保持原 OpenAI 兼容路径。
};

if (typeof Zotero !== "undefined") {
  Zotero.WordTranslator = WordTranslator;
}
