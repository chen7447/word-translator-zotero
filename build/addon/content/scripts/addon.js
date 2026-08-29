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
  _itemWords: new Map(),      // itemID -> [{word, translation, pending, highlight?}]
  _cardMenu: null,            // 单词本卡片右键菜单 { el, doc, onDoc, onKey, onScroll }
  _wordBookViewState: new Map(), // itemID -> { page, search } 分页/搜索临时界面状态（不写盘）
  _wordBookSearchTimers: new Map(), // itemID -> debounce timer
  _wordBookSearchStrategies: new Map([
    // 前缀匹配（默认）：word.startsWith(keyword)
    ["prefix", function (word, keyword) {
      return String(word.word || "").toLowerCase().startsWith(keyword);
    }],
    // 所有匹配：单词或释义包含 keyword
    ["all", function (word, keyword) {
      const w = String(word.word || "").toLowerCase();
      const t = String(word.translation || "").toLowerCase();
      return w.includes(keyword) || t.includes(keyword);
    }],
    // 只搜单词：仅 word 字段包含 keyword
    ["wordOnly", function (word, keyword) {
      return String(word.word || "").toLowerCase().includes(keyword);
    }],
    // 精确匹配：word === keyword
    ["exact", function (word, keyword) {
      return String(word.word || "").toLowerCase() === keyword;
    }],
  ]), // 搜索策略注册表：后续策略只需注册，不改后置处理流程
  _activeSearchStrategy: "prefix", // 当前生效策略，从 _data.searchStrategy 加载
  _sortMode: "reverse", // 排序模式：forward | reverse | alpha
  _panelUIDs: new Map(),      // itemID -> { paneUID, refresh }
  _paneKey: null,
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
  _currentPane: null,
  _currentPaneContext: null,
  _tempEditState: null,
  _tempEditBound: false,
  _tempEditCloseHandler: null,
  _lastSelectionPopup: null,
  // 鼠标侧键桥接（系统层检测 XButton1/XButton2，绕过浏览器侧键拦截）
  _xbuttonBridge: {
    active: false,           // 桥接是否运行
    process: null,           // Subprocess 进程对象（bridge-hook.exe）
    pollTimer: null,         // 事件文件轮询定时器
    eventFile: null,         // 事件文件路径
    exePath: null,           // 编译后的 bridge-hook.exe 路径
    hookSourcePath: null,    // 提取后的 bridge-hook.cs 路径（C# 钩子源文件）
    restartCount: 0,         // 连续重启计数（退避用）
    startedAt: 0,            // 最近启动时间戳
    restartTimer: null,      // 重启退避定时器
    hookMode: false,         // 当前是否运行 WH_MOUSE_LL 钩子模式
    lastEventTs: 0,          // 最近一次处理的事件 ts（去重用）
  },
  _subprocessModule: null,   // Subprocess 模块缓存

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

  _debugLog(msg) {
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
      // 最后退耀：nsIExternalProtocolService（可能弹权限框，仅作兜底）
      try {
        const io = Services.io;
        const eps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
        eps.loadURI(io.newURI(url, null, null), null);
        return true;
      } catch (e) { this._debugLog("_openExternalURL ext-protocol ERROR: " + (e && e.message || e)); }
      // 最后退耀：复制到剪贴板
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
        if (Zotero.Notifier && this._hotkeyNotifierID) Zotero.Notifier.unregisterObserver(this._hotkeyNotifierID);
      } catch (e) {}
      this._hotkeyNotifierID = null;
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
    } catch (e) {}
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
  registerReaderEvents() {
    this._readerTabHandlers = this._readerTabHandlers || new Map();
    const handler = (event) => {
      try { this._onRenderTextSelectionPopup(event); }
      catch (e) { this._debugLog("popup handler ERROR: " + (e && e.message || e)); }
    };
    Zotero.Reader.registerEventListener("renderTextSelectionPopup", handler, this._addonID);
    this._readerTabHandlers.set("popup", handler);
    // 阅读器打开时（renderToolbar 事件）主动给 PDF iframe 挂快捷键监听，
    // 保证“按住修饰键 + 第一次划词”也能生效（首次 popup 时再挂就太晚了）。
    try {
      if (!this._hotkeyToolbarHandler) {
        const self = this;
        this._hotkeyToolbarHandler = (event) => {
          try {
            // renderToolbar 事件的 detail 不含 reader 字段，遍历当前所有阅读器绑定
            const readers = Zotero.Reader && Zotero.Reader._readers;
            if (readers && readers.length) {
              for (const r of readers) {
                try { self._bindHotkeyForReaderInstance(r); } catch (e) {}
              }
            }
          } catch (e) {}
        };
        Zotero.Reader.registerEventListener("renderToolbar", this._hotkeyToolbarHandler, this._addonID);
      }
    } catch (e) {
      this._debugLog("hotkey renderToolbar ERROR: " + (e && (e.stack || e.message || String(e))));
    }
    // 启动兜底：遍历已打开的阅读器，绑定快捷键监听
    try {
      const readers = Zotero.Reader && Zotero.Reader._readers;
      if (readers && readers.length) {
        for (const r of readers) {
          try { this._bindHotkeyForReaderInstance(r); } catch (e) {}
        }
      }
    } catch (e) {}
    // 全局监听：主窗口挂 keydown/keyup/mousedown，焦点在 debug 界面等处也能记录快捷键状态
    try {
      this._bindGlobalHotkeyListener();
    } catch (e) {
      this._debugLog("global hotkey ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _cleanupHotkeyDomListeners() {
    try {
      // 移除主窗口 document 上的快捷键监听（插件重载/更新时旧实例残留的监听器
      // 不会随实例销毁，导致新旧两份同时处理同一事件、划词状态双轨错乱）。
      for (const rec of this._globalHotkeyHandlers || []) {
        try {
          if (rec && rec.target && typeof rec.target.removeEventListener === "function") {
            rec.target.removeEventListener(rec.type, rec.handler, rec.capture);
          }
        } catch (e) {}
      }
      this._globalHotkeyHandlers = null;
      // 移除 blur/pagehide/deactivate 重置监听，并删除 window 上的防重标记，
      // 否则重载后新实例会误判“已绑定”而跳过 reset 监听（残留清理失效）。
      for (const [win, recs] of this._hotkeyResetHandlers || []) {
        for (const rec of recs || []) {
          try {
            if (rec && rec.target && typeof rec.target.removeEventListener === "function") {
              rec.target.removeEventListener(rec.type, rec.handler, rec.capture);
            }
          } catch (e) {}
        }
        try { delete win.__wordTranslatorHotkeyResetBound; } catch (e) {}
      }
      this._hotkeyResetHandlers = null;
      // 移除 Reader/PDF 窗口上的划词会话监听。
      for (const [win, recs] of this._hotkeyReaderHandlers || []) {
        for (const rec of recs || []) {
          try {
            if (rec && rec.target && typeof rec.target.removeEventListener === "function") {
              rec.target.removeEventListener(rec.type, rec.handler, rec.capture);
            }
          } catch (e) {}
        }
      }
      this._hotkeyReaderHandlers = null;
      this._hotkeyBoundWindows = null;
    } catch (e) {
      this._debugLog("_cleanupHotkeyDomListeners ERROR: " + (e && (e.message || String(e))));
    }
  },

  _bindGlobalHotkeyListener() {
    try {
      if (this._hotkeyGlobalBound) return;
      const win = Zotero.getMainWindow();
      const target = win && (win.document || win);
      if (!target) return;
      this._hotkeyGlobalBound = true;
      // 主 Zotero 窗口失焦通常意味着应用被 Alt+Tab 切走；与 Reader/PDF
      // 内部因 popup 夺焦点产生的 blur 分开处理。
      // reset listener 必须绑定真实的顶层 Window；target 可能是 document，
      // 而 Alt+Tab 触发的是 Window blur，不能依赖 document 接收该事件。
      this._bindHotkeyResetListener(win, "main-window");
      const self = this;
      const handlers = [];
      const add = (type, fn) => {
        target.addEventListener(type, fn, true);
        handlers.push({ target, type, handler: fn, capture: true });
      };
      // 偏好页设置什么快捷键，就由同一套全局状态匹配器处理；不按具体按键分别注册。
      add("keydown", function (ev) {
        try { self._handleSelectionTranslateGlobalKeyDown(ev, "main-window"); } catch (e) {}
      });
      add("keyup", function (ev) {
        try { self._handleSelectionTranslateGlobalKeyUp(ev, "main-window"); } catch (e) {}
      });
      // —— 鼠标：只保留“先选区后按绑定键”的入口；侧键划词已废弃 ——
      add("mousedown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._addWordHotkeyActive()) return;
          if (self._matchSelectionFirstKey(ev)) {
            self._fireAddWordHotkey();
          }
        } catch (e) {}
      });
      // —— 键盘：“先选区后按绑定键” ——
      add("keydown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._addWordHotkeyActive()) return;
          if (self._matchSelectionFirstKey(ev)) {
            self._fireAddWordHotkey();
          }
        } catch (e) {}
      });
      this._globalHotkeyHandlers = handlers;
      this._debugLog("global hotkey listener bound");
    } catch (e) {
      this._debugLog("_bindGlobalHotkeyListener ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _handleSelectionTranslateGlobalKeyDown(ev, source) {
    try {
      this._refreshPrefsFromStorage();
      const d = this._data;
      if (!d || !this._selectionHotkeyActive()) return false;
      if (!this._matchConfiguredSelectionTranslateKeyDown(ev)) return false;
      // 保持“先选区后按添加单词快捷键”独立；同一按键不启动新的划词会话。
      if (this._addWordHotkeyActive() && this._matchSelectionFirstKey(ev) && this._getSelectionFirstPending()) {
        this._debugLog("selection translate global keydown skipped: add-word hotkey owns selection");
        return false;
      }
      const existing = this._selectionTranslateKeyState;
      if (existing && existing.active) {
        // 按键按住时的 repeat keydown = Alt 仍物理按下，续期活动时间
        existing.time = Date.now();
        return true;
      }
      this._selectionTranslateKeyState = {
        active: true,
        spec: this._selectionTranslateHotkeySpec(),
        key: String(ev && ev.key || ""),
        source: source || "unknown",
        time: Date.now(),
      };
      this._debugLog("selection translate global keydown: spec=" + this._selectionTranslateKeyState.spec + ", source=" + source);
      return true;
    } catch (e) {
      this._debugLog("selection translate global keydown ERROR: " + (e && (e.message || String(e))));
      return false;
    }
  },

  _handleSelectionTranslateGlobalKeyUp(ev, source) {
    try {
      const state = this._selectionTranslateKeyState;
      if (!state || !state.active) return false;
      if (!this._matchConfiguredSelectionTranslateKeyUp(ev, state.spec)) return false;
      this._debugLog("selection translate global keyup: spec=" + state.spec + ", source=" + source);
      this._selectionTranslateKeyState = null;
      this._clearSelectionTranslateState("global keyup");
      return true;
    } catch (e) {
      this._debugLog("selection translate global keyup ERROR: " + (e && (e.message || String(e))));
      return false;
    }
  },

  _selectionTranslateHotkeySpec() {
    try {
      if (this._customHotkeyActive()) return this._normalizeHotkeySpecCase(this._data.customHotkey);
      const mod = String((this._data && this._data.hotkeyModifier) || "Ctrl");
      return this._normalizeHotkeySpecCase(mod);
    } catch (e) {
      return "Ctrl";
    }
  },

  _normalizeHotkeySpecCase(spec) {
    return String(spec || "").split("+").map((part) => {
      const p = part.trim();
      if (!p) return "";
      if (/^ctrl$/i.test(p) || /^control$/i.test(p)) return "Ctrl";
      if (/^alt$/i.test(p)) return "Alt";
      if (/^shift$/i.test(p)) return "Shift";
      if (/^meta$/i.test(p) || /^command$/i.test(p)) return "Meta";
      return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
    }).filter(Boolean).join("+");
  },

  // 校验当前鼠标事件上配置所需的修饰键是否仍然实际按下。
  // 用于 Alt+Tab 等丢失 keyup 后，在建立新划词会话前清除残留状态。
  _isSelectionTranslateModifierDown(ev, spec) {
    try {
      const p = this._parseHotkeySpec(spec);
      if (!p || !ev) return false;
      // 纯修饰键配置：如 "Alt" / "Ctrl" / "Shift"，要求该键按下且其余修饰键未按下。
      if (p.key === "ctrl" || p.key === "control") return !!ev.ctrlKey && !ev.altKey && !ev.shiftKey && !ev.metaKey;
      if (p.key === "alt") return !!ev.altKey && !ev.ctrlKey && !ev.shiftKey && !ev.metaKey;
      if (p.key === "shift") return !!ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey;
      // 组合键配置：如 "Alt+Z"，校验声明的修饰键均按下。
      if (p.ctrl && !ev.ctrlKey) return false;
      if (p.alt && !ev.altKey) return false;
      if (p.shift && !ev.shiftKey) return false;
      return true;
    } catch (e) {
      return false;
    }
  },

  _matchConfiguredSelectionTranslateKeyDown(ev) {
    try {
      const spec = this._selectionTranslateHotkeySpec();
      const p = this._parseHotkeySpec(spec);
      if (!p || !ev) return false;
      const key = String(ev.key || "").toLowerCase();
      if (p.key === "ctrl" || p.key === "alt" || p.key === "shift") {
        const requiredCtrl = p.ctrl && p.key !== "ctrl";
        const requiredAlt = p.alt && p.key !== "alt";
        const requiredShift = p.shift && p.key !== "shift";
        const keyMatches =
          (p.key === "ctrl" && (key === "control" || key === "ctrl")) ||
          (p.key === "alt" && key === "alt") ||
          (p.key === "shift" && key === "shift");
        return keyMatches &&
          (!requiredCtrl || !!ev.ctrlKey) &&
          (!requiredAlt || !!ev.altKey) &&
          (!requiredShift || !!ev.shiftKey);
      }
      if (!key || key !== String(p.key || "").toLowerCase()) return false;
      return (!!ev.ctrlKey) === (!!p.ctrl) && (!!ev.altKey) === (!!p.alt) && (!!ev.shiftKey) === (!!p.shift);
    } catch (e) {
      return false;
    }
  },

  _matchConfiguredSelectionTranslateKeyUp(ev, spec) {
    try {
      const p = this._parseHotkeySpec(spec);
      const key = String(ev && ev.key || "").toLowerCase();
      if (!p || !key) return false;
      if (p.key === "ctrl") return key === "control" || key === "ctrl";
      if (p.key === "alt") return key === "alt";
      if (p.key === "shift") return key === "shift";
      return key === String(p.key || "").toLowerCase();
    } catch (e) {
      return false;
    }
  },

  _handleAddWordTrigger({ source, doc, btn, append, reader, text }) {
    try {
      if (!reader || !text) return;
      if (this._tempEditState) {
        this._restoreButtonFromTempEdit();
      }
      // 入口传入的 btn 可能是旧节点，也可能是 append 前创建的节点。
      // 统一入口只接受当前 popup 中仍连接的本插件按钮。
      if (!btn || !btn.isConnected || !btn.classList || !btn.classList.contains("wordtranslator-add-btn")) {
        btn = doc && doc.querySelector ? doc.querySelector(".wordtranslator-add-btn") : null;
      }
      if (!btn && doc && typeof append === "function") {
        const created = this._createAddWordButton(doc, reader, text, this._getAddWordButtonHTML((this._data && this._data.contextMenuLabel) || "添加单词并翻译"));
        append(created);
        // append() 可能通过 cloneInto 跨文档传递元素；绝不能继续使用 created。
        btn = doc.querySelector ? doc.querySelector(".wordtranslator-add-btn") : null;
        if (!btn && created.isConnected) btn = created;
        this._lastSelectionPopup = { doc, reader, button: btn, text, time: Date.now() };
        this._debugLog("add trigger button appended: queried=" + !!btn + ", connected=" + !!(btn && btn.isConnected));
      }
      this._debugLog("add trigger: source=" + source + ", word=" + JSON.stringify(text));
      if (doc && btn && btn.isConnected) {
        this._showTempEditArea(doc, btn, reader, text, "");
      } else {
        this._debugLog("temp edit skipped: reason=button-not-connected, source=" + source + ", hasDoc=" + !!doc + ", hasButton=" + !!btn + ", buttonConnected=" + !!(btn && btn.isConnected));
      }
      this._addWordForReader(reader, text).catch((err) => {
        this._debugLog("add trigger ERROR: source=" + source + ", " + (err && (err.stack || err.message || String(err))));
      });
    } catch (e) {
      this._debugLog("_handleAddWordTrigger ERROR: " + (e && (e.message || String(e))));
    }
  },

  _fireAddWordHotkey() {
    try {
      this._refreshPrefsFromStorage();
      if (!this._data || !this._data.addWordHotkeyEnabled) return;
      if (!this._data.selectionFirstEnabled) {
        this._debugLog("addWord hotkey ignored: selectionFirst disabled");
        return;
      }
      const now = Date.now();
      if (this._addWordHotkeyFired && now - this._addWordHotkeyFired < 1000) return;
      const pending = this._getSelectionFirstPending();
      if (!pending) {
        this._debugLog("addWord hotkey pressed but no selected text cached");
        return;
      }
      this._addWordHotkeyFired = now;
      this._debugLog("addWord hotkey fired: word=" + JSON.stringify(pending.text));
      this._selectionFirstPending = null;
      this._triggerHotkeyTranslate(pending);
    } catch (e) {
      this._debugLog("_fireAddWordHotkey ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // ==============================================================
  // 鼠标侧键桥接（XButton1/XButton2 系统层检测）
  // 编译 bridge-hook.cs 为 exe 并直接启动（WH_MOUSE_LL 全局钩子）。
  // exe 写事件文件，插件 100ms 轮询读取。
  // ==============================================================

  _getSubprocess() {
    // 懒加载 Subprocess 模块
    if (!this._subprocessModule) {
      if (typeof ChromeUtils !== "undefined" && typeof ChromeUtils.importESModule === "function") {
        this._subprocessModule = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs").Subprocess;
      } else {
        this._subprocessModule = ChromeUtils.import("resource://gre/modules/Subprocess.jsm").Subprocess;
      }
    }
    return this._subprocessModule;
  },

  async _readAddonResource(uri) {
    // 从 addon 资源 URI 读取文本内容（chrome:// 或 resource://）
    // 优先 fetch（Zotero 7+），兜底 NetUtil.asyncFetch（bootstrap 作用域保证可用）
    try {
      if (typeof fetch === "function") {
        const response = await fetch(uri);
        if (response && response.ok) return await response.text();
      }
    } catch (e) {}
    try {
      if (typeof NetUtil !== "undefined") {
        return await new Promise(function (resolve) {
          try {
            NetUtil.asyncFetch(uri, function (stream, status) {
              try {
                if (stream && Components.isSuccessCode(status)) {
                  const content = NetUtil.readInputStreamToString(stream, stream.available(), { charset: "utf-8" });
                  resolve(content);
                } else {
                  resolve("");
                }
              } catch (e2) { resolve(""); }
            });
          } catch (e3) { resolve(""); }
        });
      }
    } catch (e) {}
    return "";
  },

  _writeTextFile(path, content, withBom) {
    try {
      if (withBom && String(content).charCodeAt(0) !== 0xFEFF) content = "\uFEFF" + content;
      const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      f.initWithPath(path);
      const stream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      stream.init(f, 0x02 | 0x08 | 0x10, 0o666, 0); // write | create | truncate
      const conv = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
      conv.init(stream, "UTF-8", 4096, 0xFFFD);
      conv.writeString(content);
      conv.close();
      stream.close();
      return true;
    } catch (e) {
      this._debugLog("_writeTextFile ERROR: " + (e && (e.message || e)));
      return false;
    }
  },

  _readTextFile(path) {
    try {
      const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      f.initWithPath(path);
      if (!f.exists() || f.fileSize === 0) return "";
      const stream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
      stream.init(f, 0x01, 0, 0); // readonly
      const conv = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
      conv.init(stream, "UTF-8", 4096, 0xFFFD);
      var str = {}, len = 0, content = "";
      while ((len = conv.readString(4096, str)) > 0) { content += str.value; }
      conv.close();
      stream.close();
      return content;
    } catch (e) { return ""; }
  },

  async _startXButtonBridge() {
    try {
      if (this._xbuttonBridge.active) return;
      this._refreshPrefsFromStorage();
      if (!this._data || !this._data.xbuttonBridgeEnabled) return;

      const dataDir = Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getDataDirPath ?
        Zotero.WordTranslatorStorage.getDataDirPath() : "";
      if (!dataDir) {
        this._debugLog("xbutton bridge: no dataDir, skip");
        return;
      }

      const sep = dataDir.indexOf("\\") >= 0 ? "\\" : "/";
      this._xbuttonBridge.eventFile = dataDir + sep + "bridge-events.json";
      this._xbuttonBridge.exePath = dataDir + sep + "bridge-hook.exe";
      this._xbuttonBridge.hookSourcePath = dataDir + sep + "bridge-hook.cs";

      // 提取 bridge-hook.cs（C# 钩子源文件）
      const extracted = await this._extractBridgeFiles();
      if (!extracted) {
        this._debugLog("xbutton bridge: failed to extract bridge files");
        return;
      }

      // 清理旧事件文件
      try {
        const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        f.initWithPath(this._xbuttonBridge.eventFile);
        if (f.exists()) f.remove(false);
      } catch (e) {}

      const Subprocess = this._getSubprocess();
      if (!Subprocess) {
        this._debugLog("xbutton bridge: Subprocess not available");
        return;
      }
      const zoteroPid = Services && Services.appinfo && Services.appinfo.processID ? Services.appinfo.processID : 0;

      // ── 仅使用 C# WH_MOUSE_LL 钩子 exe（不再有 bridge-fallback.ps1）。
      // 理由：GetAsyncKeyState 轮询对多数游戏鼠标无效（驱动拦截），且
      // bridge-fallback.ps1 文件残留在数据目录会破坏此路径，导致重新打包后失效。
      // 若 exe 编译/启动失败，记录错误并显示错误状态，由重启退避重试。
      let bridgeProc = null;

      const compiled = await this._compileBridgeExe();
      if (compiled) {
        try {
          bridgeProc = await Subprocess.call({
            command: this._xbuttonBridge.exePath,
            arguments: [
              "-EventFile", this._xbuttonBridge.eventFile,
              "-ParentPid", String(zoteroPid),
            ],
            stderr: "ignore",
          });
          this._debugLog("xbutton bridge: hook exe started, PID=" + (bridgeProc.pid || "?"));
          this._writeBridgeDebug("hook exe started, PID=" + (bridgeProc.pid || "?") + ", parentPid=" + zoteroPid);
          this._xbuttonBridge.hookMode = true;
        } catch (e) {
          this._debugLog("xbutton bridge: hook exe launch FAILED: " + (e && (e.message || e)));
          this._writeBridgeDebug("hook exe launch FAILED: " + (e && (e.message || e)));
          bridgeProc = null;
        }
      }

      // 编译或启动失败：记录错误并显示状态，交由保活退避重试
      if (!bridgeProc) {
        this._xbuttonBridge.hookMode = false;
        this._debugLog("xbutton bridge: FAILED to start WH_MOUSE_LL hook (compile or launch)");
        this._writeBridgeDebug("FAILED to start WH_MOUSE_LL hook");
        this._updateXButtonBridgeStatus({ running: false, error: "bridge-failed", confirmed: false, hookMode: false });
        return;
      }

      this._xbuttonBridge.process = bridgeProc;
      this._xbuttonBridge.active = true;
      this._xbuttonBridge.startedAt = Date.now();
      this._xbuttonBridge.restartCount = 0;
      this._xbuttonBridge.lastEventTs = 0;

      // 保活监视
      const self = this;
      bridgeProc.wait().then(function () {
        if (self._xbuttonBridge.process !== bridgeProc) return;
        self._debugLog("xbutton bridge: process exited");
        self._writeBridgeDebug("bridge process exited");
        self._xbuttonBridge.active = false;
        self._xbuttonBridge.process = null;
        if (self._initialized) self._scheduleBridgeRestart();
      });

      // 启动文件轮询
      this._startXButtonPolling();

      this._updateXButtonBridgeStatus({
        running: true,
        pid: bridgeProc.pid || 0,
        confirmed: false,
        hookMode: this._xbuttonBridge.hookMode,
      });

    } catch (e) {
      this._debugLog("_startXButtonBridge ERROR: " + (e && (e.stack || e.message || String(e))));
      this._xbuttonBridge.active = false;
      this._xbuttonBridge.process = null;
    }
  },

  _stopXButtonBridge() {
    // 取消重启定时器
    if (this._xbuttonBridge.restartTimer) {
      clearTimeout(this._xbuttonBridge.restartTimer);
      this._xbuttonBridge.restartTimer = null;
    }
    // 停止文件轮询
    if (this._xbuttonBridge.pollTimer) {
      clearTimeout(this._xbuttonBridge.pollTimer);
      this._xbuttonBridge.pollTimer = null;
    }
    // 杀进程
    if (this._xbuttonBridge.process) {
      try { this._xbuttonBridge.process.kill(); } catch (e) {}
      this._xbuttonBridge.process = null;
    }
    // 清理事件文件
    if (this._xbuttonBridge.eventFile) {
      try {
        const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        f.initWithPath(this._xbuttonBridge.eventFile);
        if (f.exists()) f.remove(false);
      } catch (e) {}
    }
    this._xbuttonBridge.active = false;
    this._xbuttonBridge.hookMode = false;
    this._xbuttonBridge.lastEventTs = 0;
    this._updateXButtonBridgeStatus({ running: false, pid: 0 });
    this._debugLog("xbutton bridge: stopped");
  },

  async _extractBridgeFiles() {
    const hookSourcePath = this._xbuttonBridge.hookSourcePath;
    let anyOk = false;

    // 提取 bridge-hook.cs（C# 钩子源文件，用于编译 exe）
    if (hookSourcePath) {
      try {
        const uri = this._addonRoot + "content/scripts/bridge-hook.cs";
        const content = await this._readAddonResource(uri);
        if (content) {
          const ok = this._writeTextFile(hookSourcePath, content, false);
          this._debugLog("xbutton bridge: hook source extracted (" + (ok ? "ok" : "fail") + ")");
          anyOk = anyOk || ok;
        } else {
          this._debugLog("xbutton bridge: bridge-hook.cs not found in addon");
        }
      } catch (e) {
        this._debugLog("xbutton bridge: bridge-hook.cs extraction error: " + (e && (e.message || e)));
      }
    }

    return anyOk;
  },

  // 向数据目录 bridge-debug.log 追加一行（不受 debugLog 开关控制，用于桥接诊断）。
  _writeBridgeDebug(msg) {
    try {
      const dataDir = this._xbuttonBridge.exePath ?
        (this._xbuttonBridge.exePath.replace(/[\\/][^\\/]+$/, "")) : "";
      if (!dataDir) return;
      const line = "[" + new Date().toISOString() + "] [addon] " + String(msg) + "\n";
      const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      f.initWithPath(dataDir + (dataDir.indexOf("\\") >= 0 ? "\\" : "/") + "bridge-debug.log");
      const wout = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      wout.init(f, 0x02 | 0x08 | 0x10 | 0x1000, 0o666, 0); // write|create|append
      const wconv = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
      wconv.init(wout, "UTF-8", 4096, 0xFFFD);
      wconv.writeString(line);
      wconv.close();
      wout.close();
    } catch (e) {}
  },

  // 编译 bridge-hook.exe。核心策略：
  //   - 若 bridge-hook.exe 已存在且有效 → 跳过编译直接使用（避免「先删旧 exe
  //     → 编译失败 → exe 缺失」的时序问题，这是重载后侧键失效的根因）。
  //   - 仅当 exe 不存在/无效时才编译。编译目标为临时文件（以 .exe 结尾，
  //     确保 Add-Type 生成有效 PE），成功后原子替换为最终路径。
  //   - 编译失败时捕获 Add-Type 错误信息写入 bridge-debug.log 便于诊断。
  async _compileBridgeExe() {
    const exePath = this._xbuttonBridge.exePath;
    const csPath = this._xbuttonBridge.hookSourcePath;
    if (!exePath || !csPath) return false;

    const Subprocess = this._getSubprocess();
    if (!Subprocess) return false;

    // 1) 杀掉所有残留的 bridge-hook.exe 进程，并等待句柄释放。
    //    注意：此时不删除 exe 文件——保留旧 exe 作为兜底。
    try {
      await Subprocess.call({
        command: "C:\\Windows\\System32\\taskkill.exe",
        arguments: ["/F", "/IM", "bridge-hook.exe"],
        stderr: "ignore",
      }).then((p) => p.wait()).catch(() => {});
      await new Promise((r) => setTimeout(r, 300)); // 等 Windows 释放文件句柄
    } catch (e) {}

    // 2) 关键修复：exe 已存在且有效 → 跳过编译，直接使用。
    //    避免「删 exe → 编译失败 → 没有 exe」的时序问题。
    try {
      const exeFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      exeFile.initWithPath(exePath);
      if (exeFile.exists() && exeFile.fileSize > 0) {
        this._debugLog("xbutton bridge: exe exists, skip compile");
        this._writeBridgeDebug("exe exists, skip compile");
        return true;
      }
    } catch (e) {}

    // 3) 仅当 exe 缺失/无效时才编译。
    const tmpExe = exePath + "-tmp.exe";
    let compiled = false;
    for (let attempt = 1; attempt <= 2 && !compiled; attempt++) {
      try {
        const tmp = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        tmp.initWithPath(tmpExe);
        if (tmp.exists()) { try { tmp.remove(false); } catch (e) {} }
      } catch (e) {}

      this._debugLog("xbutton bridge: exe missing, compiling (attempt " + attempt + ")...");
      this._writeBridgeDebug("compile attempt " + attempt + " start (exe missing)");

      const tmpQ = "'" + tmpExe.replace(/'/g, "''") + "'";
      const csQ = "'" + csPath.replace(/'/g, "''") + "'";
      // 编译失败时把 Add-Type 错误信息输出到 stdout（Write-Output），
      // 便于后续读取并写入 bridge-debug.log。
      const psCommand = "try { Add-Type -OutputAssembly " + tmpQ +
        " -OutputType ConsoleApplication -TypeDefinition (Get-Content " + csQ +
        " -Raw) -ErrorAction Stop } catch { Write-Output ('CSHARP_ERROR: ' + $_.Exception.Message); exit 1 }";

      try {
        const compileProc = await Subprocess.call({
          command: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
          arguments: [
            "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-Command", psCommand,
          ],
          stderr: "pipe",
          stdout: "pipe",
        });
        // wait() 返回退出码（数字）。不要用对象解构——wait() 不返回对象。
        const exitCode = await compileProc.wait();
        // 读取编译输出，捕获 Add-Type 错误信息
        let outText = "";
        try {
          if (compileProc.stdout) outText = compileProc.stdout.readString();
        } catch (e2) {}
        if (outText) this._writeBridgeDebug("compile output: " + outText);

        const tmp = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        tmp.initWithPath(tmpExe);
        if (exitCode === 0 && tmp.exists() && tmp.fileSize > 0) {
          this._writeBridgeDebug("compile OK to temp, size=" + tmp.fileSize);
          compiled = true;
          break;
        }
        this._writeBridgeDebug("compile attempt " + attempt + " failed, exitCode=" + exitCode);
      } catch (e) {
        this._writeBridgeDebug("compile attempt " + attempt + " ERROR: " + (e && (e.message || e)));
      }
    }

    if (!compiled) {
      this._debugLog("xbutton bridge: compile FAILED (no exe produced)");
      this._writeBridgeDebug("compile FAILED after retries");
      return false;
    }

    // 4) 原子替换：把临时编译产物安装为最终 bridge-hook.exe（带重试 + 再次 taskkill）
    const tmp = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
    tmp.initWithPath(tmpExe);
    for (let retry = 0; retry < 4; retry++) {
      try {
        // 删除旧 exe（进程已被杀，一般可删；若被锁则走 catch 重试）
        const oldExe = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        oldExe.initWithPath(exePath);
        if (oldExe.exists()) { try { oldExe.remove(false); } catch (e) {} }

        // 移动临时文件 → 最终路径（同一目录：moveTo 需父目录 + 叶名）
        const leaf = exePath.indexOf("\\") >= 0 ? exePath.substring(exePath.lastIndexOf("\\") + 1) : exePath.split("/").pop();
        tmp.moveTo(null, leaf);

        const fe = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        fe.initWithPath(exePath);
        if (fe.exists() && fe.fileSize > 0) {
          this._debugLog("xbutton bridge: exe installed, size=" + fe.fileSize);
          this._writeBridgeDebug("exe installed, size=" + fe.fileSize);
          // 清理临时文件
          try { tmp.remove(false); } catch (e) {}
          return true;
        }
        this._writeBridgeDebug("install verify failed (exe not found after move)");
      } catch (e) {
        this._writeBridgeDebug("install attempt " + (retry + 1) + " failed: " + (e && (e.message || e)));
        // 被锁 → 再杀一次 + 等待
        try {
          await Subprocess.call({
            command: "C:\\Windows\\System32\\taskkill.exe",
            arguments: ["/F", "/IM", "bridge-hook.exe"],
            stderr: "ignore",
          }).then((p) => p.wait()).catch(() => {});
          await new Promise((r) => setTimeout(r, 700));
        } catch (e2) {}
      }
    }

    this._debugLog("xbutton bridge: exe install FAILED after retries (temp exe at " + tmpExe + ")");
    this._writeBridgeDebug("exe install FAILED after retries");
    return false;
  },

  _startXButtonPolling() {
    var self = this;
    function poll() {
      if (!self._xbuttonBridge.active) return;
      self._xbuttonBridge.pollTimer = setTimeout(function () {
        try { self._checkXButtonEvent(); } catch (e) {}
        poll();
      }, 100); // 100ms 轮询
    }
    poll();
  },

  // ---- 共享事件处理（文件轮询用） ----

  _processXButtonEvent(event, source) {
    if (!event || typeof event !== "object") return;

    // 桥接启动确认标记
    if (event._bridgeInit === true) {
      if (event.fallback) {
        this._xbuttonBridge.hookMode = false;
        this._debugLog("xbutton bridge: fallback mode confirmed via file");
        this._writeBridgeDebug("fallback mode confirmed");
      } else {
        this._xbuttonBridge.hookMode = true;
        this._debugLog("xbutton bridge: WH_MOUSE_LL hook confirmed via file"
          + (event.error ? " (error: " + event.error + ")" : ""));
        this._writeBridgeDebug("WH_MOUSE_LL hook confirmed");
      }
      this._updateXButtonBridgeStatus({
        running: true,
        pid: this._xbuttonBridge.process ? this._xbuttonBridge.process.pid : 0,
        confirmed: true,
        hookMode: this._xbuttonBridge.hookMode,
        hookError: event.error || "",
      });
      return;
    }

    // 钩子编译失败标记
    if (event._bridgeInit === false) {
      this._debugLog("xbutton bridge: hook init failed: " + (event.error || "unknown"));
      this._xbuttonBridge.hookMode = false;
      this._updateXButtonBridgeStatus({
        running: false, error: "hook-init-failed: " + (event.error || ""),
      });
      return;
    }

    // 普通 XButton 事件

    // ts 去重
    if (event.ts && this._xbuttonBridge.lastEventTs === event.ts) return;
    if (event.ts) this._xbuttonBridge.lastEventTs = event.ts;

    // 检查时效性（2 秒内有效）
    var now = Date.now();
    var ts = event.ts || 0;
    if (now - ts > 2000) return;

    // 刷新配置并检查是否启用
    this._refreshPrefsFromStorage();
    if (!this._addWordHotkeyActive()) return;
    if (!this._getSelectionFirstPending()) return;

    // 检查是否匹配当前配置的侧键模式
    var mode = this._data && this._data.addWordHotkeyMode;
    var isX1 = (event.x1 === 1) && (mode === "xbutton1" || mode === "xbutton-both");
    var isX2 = (event.x2 === 1) && (mode === "xbutton2" || mode === "xbutton-both");
    if (!isX1 && !isX2) return;

    this._debugLog("xbutton bridge: XButton" + (event.x1 ? "1" : "2") + " triggered via " + source + ", mode=" + mode);
    this._fireAddWordHotkey();
  },

  _checkXButtonEvent() {
    const eventFile = this._xbuttonBridge.eventFile;
    if (!eventFile) return;

    // 读事件文件
    var content = null;
    try {
      var f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      f.initWithPath(eventFile);
      if (!f.exists() || f.fileSize === 0) return;

      var stream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
      stream.init(f, 0x01, 0, 0); // readonly
      var conv = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
      conv.init(stream, "UTF-8", 4096, 0xFFFD);
      var str = {}, len = 0;
      content = "";
      while ((len = conv.readString(4096, str)) > 0) {
        content += str.value;
      }
      conv.close();
      stream.close();
    } catch (e) {
      // 文件可能正在被写入，忽略
      return;
    }

    if (!content) return;

    // 解析事件
    var event = null;
    try { event = JSON.parse(content); } catch (e) { return; }

    // 立即删除事件文件（防止重复触发）
    try {
      var f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      f.initWithPath(eventFile);
      if (f.exists()) f.remove(false);
    } catch (e) {}

    // 交给共享处理器
    this._processXButtonEvent(event, "file");
  },

  _scheduleBridgeRestart() {
    var rc = this._xbuttonBridge.restartCount;
    if (rc >= 5) {
      this._debugLog("xbutton bridge: too many restarts (" + rc + "), giving up");
      this._updateXButtonBridgeStatus({ running: false, error: "max-restarts" });
      return;
    }
    var delay = Math.min(1000 * Math.pow(2, rc), 30000); // 1s, 2s, 4s, 8s, 16s, 30s
    this._xbuttonBridge.restartCount = rc + 1;
    this._debugLog("xbutton bridge: restart in " + delay + "ms (attempt " + (rc + 1) + ")");
    var self = this;
    this._xbuttonBridge.restartTimer = setTimeout(function () {
      self._xbuttonBridge.restartTimer = null;
      if (!self._xbuttonBridge.active && self._initialized) {
        self._startXButtonBridge();
      }
    }, delay);
  },

  _updateXButtonBridgeStatus(status) {
    try {
      var json = JSON.stringify(status);
      if (typeof Zotero !== "undefined" && Zotero.Prefs && typeof Zotero.Prefs.set === "function") {
        Zotero.Prefs.set("extensions.zotero.wordtranslator.xbuttonBridgeStatus", json, true);
      } else if (typeof Services !== "undefined" && Services.prefs) {
        Services.prefs.setStringPref("extensions.zotero.wordtranslator.xbuttonBridgeStatus", json);
      }
    } catch (e) {
      this._debugLog("_updateXButtonBridgeStatus ERROR: " + (e && (e.message || e)));
    }
  },

  // 偏好页「重启桥接」按钮：先停止再启动
  restartXButtonBridge() {
    this._debugLog("xbutton bridge: manual restart requested");
    this._stopXButtonBridge();
    this._xbuttonBridge.restartCount = 0;
    this._startXButtonBridge();
  },

  // 偏好页开关保存后调用：根据最新配置立即启停桥接。
  syncXButtonBridge() {
    this._refreshPrefsFromStorage(true);
    if (this._data && this._data.xbuttonBridgeEnabled) {
      this._xbuttonBridge.restartCount = 0;
      this._startXButtonBridge();
    } else {
      this._stopXButtonBridge();
    }
  },

  // 偏好页「测试侧键事件」按钮：模拟写一条 XButton1 事件文件，
  // 用于在无鼠标侧键环境下验证 事件文件 → 插件触发 链路。
  testXButtonEvent() {
    try {
      const eventFile = this._xbuttonBridge.eventFile;
      if (!eventFile) {
        this._debugLog("xbutton bridge: no event file (bridge not started?)");
        return;
      }
      const mode = this._data && this._data.addWordHotkeyMode || "xbutton1";
      const event = { ts: Date.now() };
      if (mode === "xbutton2") event.x2 = 1;
      else if (mode === "xbutton-both") { event.x1 = 1; event.x2 = 1; }
      else event.x1 = 1;
      const json = JSON.stringify(event);
      const ok = this._writeTextFile(eventFile, json);
      this._debugLog("xbutton bridge: test event written " + (ok ? "ok" : "FAIL") + ": " + json);
    } catch (e) {
      this._debugLog("testXButtonEvent ERROR: " + (e && (e.message || e)));
    }
  },

  _bindHotkeyForReaderInstance(reader) {
    try {
      if (!reader || !reader.tabID) return;
      const key = "wtHotkeyBound_" + this._addonID;
      if (reader[key]) return;
      reader[key] = true;
      const self = this;
      this._debugLog("hotkey bind start: itemID=" + (reader && reader.itemID) + ", tabID=" + (reader && reader.tabID));
      // 先绑阅读器主窗口 iframe（稳定存在；PDF iframe 事件会冒泡到这里）
      try {
        this._bindHotkeyModifierListener(reader._iframeWindow, reader);
      } catch (e) {}
      // PDF.js 视图 iframe 需要等初始化完成，轮询等待
      this._waitForHotkeyWindow(reader, 0);
    } catch (e) {
      this._debugLog("_bindHotkeyForReaderInstance ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _waitForHotkeyWindow(reader, attempt) {
    try {
      const internal = reader && reader._internalReader;
      let win = null;
      try {
        const primary = internal && (internal._primaryView || internal.primaryView);
        if (primary) {
          win = primary._iframeWindow || primary.iframeWindow;
        }
      } catch (e) {}
      if (!win) {
        try {
          const secondary = internal && (internal._secondaryView || internal.secondaryView);
          if (secondary) {
            win = secondary._iframeWindow || secondary.iframeWindow;
          }
        } catch (e) {}
      }
      if (win) {
        this._bindHotkeyModifierListener(win, reader);
        return;
      }
      if (attempt < 100) {
        const self = this;
        setTimeout(function () {
          // 插件重载后旧实例的轮询必须立即停止，否则会重新绑定已清理的窗口监听。
          if (!self._initialized) return;
          self._waitForHotkeyWindow(reader, attempt + 1);
        }, 100);
      } else {
        this._debugLog("hotkey wait timeout: tabID=" + (reader && reader.tabID));
      }
    } catch (e) {
      this._debugLog("_waitForHotkeyWindow ERROR: " + (e && (e.message || String(e))));
    }
  },

  _bindHotkeyResetListener(win, role) {
    try {
      if (!win) return;
      if (win.__wordTranslatorHotkeyResetBound) return;
      const self = this;
      if (!this._hotkeyResetHandlers) this._hotkeyResetHandlers = new Map();
      const relRecs = [];
      const relAdd = (type, fn) => {
        win.addEventListener(type, fn, true);
        relRecs.push({ target: win, type, handler: fn, capture: true });
      };
      const clear = (reason) => {
        // 连续划词保护：快捷键仍激活且 keyState.time 在近期（keydown/repeat、
        // mousedown、mouseup、触发翻译都会续期）。翻译触发后临时编辑区/弹窗引发的
        // 内部 blur/deactivate 事件风暴若清空状态，第二次划词将无法建立会话
        // （日志证实首次触发后 keyState+session 被清导致后续划词无响应）。
        // 真正的 Alt+Tab 残留由 keyup 丢失场景 + mousedown 修饰键实测校验兜底。
        const ks = self._selectionTranslateKeyState;
        if (ks && ks.active && Date.now() - (ks.time || 0) < 30000) {
          self._debugLog("selection translate clear skipped: hotkey active + recent activity, reason=" + reason);
          return;
        }
        const session = self._selectionTranslateSession;
        const isMainWindow = role === "main-window";

        // 主窗口 blur 表示 Zotero 整体失去激活（例如 Alt+Tab）。此时
        // Windows 可能不会再把匹配的 keyup 发回 Zotero，必须主动清除。
        if (reason === "window blur" && isMainWindow) {
          self._selectionTranslateKeyState = null;
          self._clearSelectionTranslateState("main-window-blur");
          self._debugLog("selection translate main window blur: global state cleared");
          return;
        }

        // 主窗口 deactivate：它在 Reader/popup/临时编辑区域的内部焦点切换时
        // 也会频繁触发（日志已证实），不能无条件当作应用被切出。
        // 当存在进行中的选区/弹窗状态时保留会话，避免破坏连续划词。
        if (reason === "window deactivate" && isMainWindow) {
          if (
            session &&
            session.active &&
            (session.mouseDown || session.selectionReady || session.popupContext)
          ) {
            self._debugLog(
              "selection translate deactivate ignored: pending selection state, " +
              "mouseDown=" + session.mouseDown +
              ", selectionReady=" + session.selectionReady +
              ", popupContext=" + !!session.popupContext
            );
            return;
          }
          self._selectionTranslateKeyState = null;
          self._clearSelectionTranslateState("main-window-deactivate");
          self._debugLog("selection translate main window deactivation: global state cleared");
          return;
        }

        // 方案 A：部分桌面切换场景可能不向顶层 Window 派发 blur，
        // 但主文档会进入 hidden；将其作为 Alt+Tab 丢失 keyup 的兜底。
        if (reason === "document hidden" && isMainWindow) {
          self._selectionTranslateKeyState = null;
          self._clearSelectionTranslateState("main-window-hidden");
          self._debugLog("selection translate main document hidden: global state cleared");
          return;
        }

        // Reader/PDF 内部 blur 可能只是 popup 或临时编辑区域夺取焦点；
        // 保留原有保护逻辑，不能把它等同于应用被切出。
        if (
          reason === "window blur" &&
          session &&
          session.active &&
          (session.mouseDown || session.selectionReady || session.popupContext)
        ) {
          self._debugLog(
            "selection translate blur ignored: pending selection state, " +
            "mouseDown=" + session.mouseDown +
            ", selectionReady=" + session.selectionReady +
            ", popupContext=" + !!session.popupContext
          );
          return;
        }
        // 窗口 blur 不等于配置快捷键已经释放；全局 keyup 才是正常结束条件。
        if (reason !== "window blur" || !self._selectionTranslateKeyState) {
          self._clearSelectionTranslateState(reason);
        } else {
          self._debugLog("selection translate blur ignored: global key state active");
        }
      };
      relAdd("blur", () => clear("window blur"));
      relAdd("pagehide", () => clear("pagehide"));
      // 方案 B：XUL 顶层窗口失活时派发 deactivate；用于捕获 Alt+Tab
      // 场景中可能丢失的 modifier keyup。
      if (role === "main-window") {
        relAdd("deactivate", () => clear("window deactivate"));
      }
      // 全部监听注册成功后才写入 handlers 表并标记“已绑定”：
      // 旧版先标记后注册，注册路径一旦抛错（被 catch 吞掉）监听永不重建。
      this._hotkeyResetHandlers.set(win, relRecs);
      win.__wordTranslatorHotkeyResetBound = true;
    } catch (e) {
      this._debugLog("bindHotkeyResetListener ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _bindHotkeyModifierListener(win, reader) {
    try {
      if (!win) return;
      if (this._hotkeyBoundWindows && this._hotkeyBoundWindows.has(win)) return;
      if (!this._hotkeyBoundWindows) this._hotkeyBoundWindows = new Set();
      this._hotkeyBoundWindows.add(win);
      this._bindHotkeyResetListener(win, "reader-window");
      const self = this;
      if (!this._hotkeyReaderHandlers) this._hotkeyReaderHandlers = new Map();
      const winRecs = [];
      const winAdd = (type, fn) => {
        win.addEventListener(type, fn, true);
        winRecs.push({ target: win, type, handler: fn, capture: true });
      };
      // PDF/Reader 窗口也把按键交给同一个全局状态函数；这里不是为每个按键单独注册。
      winAdd("keydown", function (ev) {
        try { self._handleSelectionTranslateGlobalKeyDown(ev, "reader-window"); } catch (e) {}
      });
      // 鼠标左键只负责“快捷键-划词翻译”的一次选区边界：
      // keydown 开始会话 → mousedown 开始选择 → mouseup 检查选区 → popup 触发。
      winAdd("mousedown", function (ev) {
        try {
          if (ev.button !== 0) return;
          const keyState = self._selectionTranslateKeyState;
          // Alt+Tab 等场景可能丢失 modifier keyup，导致 _selectionTranslateKeyState
          // 残留为 active（即使 _selectionTranslateSession 也残留 active）。在每次
          // 左键 mousedown 都用本事件携带的实时修饰键状态实测校验：若配置所需的
          // modifier 已不再实际按下，则清除残留状态并拒绝本次划词翻译。
          if (keyState && keyState.active) {
            const staleSpec = keyState.spec || self._selectionTranslateHotkeySpec();
            if (!self._isSelectionTranslateModifierDown(ev, staleSpec)) {
              self._debugLog(
                "selection translate stale state cleared on mousedown: spec=" +
                staleSpec +
                ", altKey=" + !!ev.altKey +
                ", ctrlKey=" + !!ev.ctrlKey +
                ", shiftKey=" + !!ev.shiftKey +
                ", metaKey=" + !!ev.metaKey
              );
              self._selectionTranslateKeyState = null;
              self._clearSelectionTranslateState("stale modifier on mousedown");
              return;
            }
          }
          let session = self._selectionTranslateSession;
          // 全局按键状态已经激活且校验通过时，由当前 Reader 的左键 mousedown 建立本 Reader 会话。
          if ((!session || !session.active) && keyState && keyState.active) {
            session = self._selectionTranslateSession = {
              active: true,
              reader: reader,
              win: win,
              doc: win.document || null,
              mouseDown: false,
              selectionReady: false,
              selectionText: "",
              selectionTime: 0,
              popupContext: null,
              sequence: Date.now(),
            };
            self._debugLog("selection translate session attached: reader=" + (reader && reader.tabID));
          }
          if (!session || !session.active || session.win !== win) return;
          // 划词活动续期 keyState.time：连续划词时 blur/deactivate 清理依赖它判断
          // “快捷键仍激活且有近期活动”，避免首次翻译触发后状态被清空。
          if (keyState) keyState.time = Date.now();
          session.mouseDown = true;
          session.selectionReady = false;
          session.selectionText = "";
          session.selectionTime = Date.now();
          session.popupContext = null;
          self._debugLog("selection translate mouse down: reader=" + (session.reader && session.reader.tabID));
        } catch (e) {}
      });
      winAdd("mouseup", function (ev) {
        try {
          const session = self._selectionTranslateSession;
          if (!session || !session.active || session.win !== win || ev.button !== 0) return;
          // 不在此处读取 DOM selection：全插件统一以 popup 事件报告的
          // annotation.text（Zotero 官方选区文本）为唯一触发来源。
          // getSelection() 在多层 iframe 结构下取到的不是 PDF text layer 的
          // 真实选区（实测会返回错位文本或空值），该路径已彻底废弃。
          session.mouseDown = false;
          session.selectionText = "";
          session.selectionReady = true;
          session.selectionTime = Date.now();
          if (self._selectionTranslateKeyState) self._selectionTranslateKeyState.time = Date.now();
          self._debugLog("selection translate mouse up: result=selection-ready, text=" + JSON.stringify((session.popupContext && session.popupContext.text) || ""));
          self._tryTriggerSelectionTranslate(session);
        } catch (e) {}
      });
      winAdd("keyup", function (ev) {
        try { self._handleSelectionTranslateGlobalKeyUp(ev, "reader-window"); } catch (e) {}
      });
      // —— 键盘：“先选区后按绑定键” ——
      winAdd("keydown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._addWordHotkeyActive()) return;
          if (self._matchSelectionFirstKey(ev)) {
            self._fireAddWordHotkey();
          }
        } catch (e) {}
      });
      this._hotkeyReaderHandlers.set(win, winRecs);
      this._debugLog("hotkey bound to iframe window");
    } catch (e) {
      this._debugLog("_bindHotkeyModifierListener ERROR: " + (e && (e.message || String(e))));
    }
  },

  _tryTriggerSelectionTranslate(session) {
    try {
      if (!session || !session.active || session.mouseDown || !session.selectionReady) return false;
      const popup = session.popupContext;
      if (!popup) {
        this._debugLog("selection translate waiting popup: text=" + JSON.stringify(session.selectionText));
        return false;
      }
      if (Date.now() - popup.time > 1500) {
        this._debugLog("selection translate popup-skip: reason=stale");
        session.popupContext = null;
        return false;
      }
      const popupText = this._normalizeSelectionTranslateText(popup.text);
      const selectionText = this._normalizeSelectionTranslateText(session.selectionText);
      const sameReader = popup.reader === session.reader;
      if (!sameReader) {
        this._debugLog("selection translate popup-skip: reader=mismatch, text=" + JSON.stringify(popupText));
        return false;
      }
      // 触发文本以 popup 事件报告的 annotation.text 为准（Zotero 官方选区文本，
      // 全插件唯一可靠来源）；DOM getSelection() 在多层 iframe 下不可信，不再使用。
      const triggerText = popupText || selectionText;
      if (!triggerText) {
        this._debugLog("selection translate popup-skip: reason=empty-text");
        return false;
      }
      const popupDoc = popup.doc;
      const popupButton = popup.button && popup.button.isConnected
        ? popup.button
        : (popupDoc && popupDoc.querySelector ? popupDoc.querySelector(".wordtranslator-add-btn") : null);
      session.selectionReady = false;
      session.selectionText = "";
      session.selectionTime = 0;
      session.popupContext = null;
      // 触发成功 = 划词活动，续期 keyState.time（连续划词保护依赖）。
      if (this._selectionTranslateKeyState) this._selectionTranslateKeyState.time = Date.now();
      this._debugLog("selection translate trigger: text=" + JSON.stringify(triggerText));
      this._handleAddWordTrigger({
        source: "hotkey-selection",
        doc: popupDoc,
        btn: popupButton,
        // append 只能在 renderTextSelectionPopup 回调同步执行；
        // mouseup 阶段绝不能再次调用已失效的 append。
        append: null,
        reader: session.reader,
        text: triggerText,
      });
      return true;
    } catch (e) {
      this._debugLog("_tryTriggerSelectionTranslate ERROR: " + (e && (e.stack || e.message || String(e))));
      return false;
    }
  },

  _isSelectionTextAllowed(text) {
    const value = String(text || "").trim();
    if (!value) return { allowed: false, reason: "empty" };
    const mode = this._data && this._data.selectionMode === "sentence" ? "sentence" : "word";
    // 句子模式放宽单词模式的 500 字符限制，但保留 5000 字符安全上限，
    // 防止误选整篇 PDF 后直接提交过大的 API 请求。
    const maxLength = mode === "sentence" ? 5000 : 500;
    if (value.length > maxLength) {
      return { allowed: false, reason: mode === "sentence" ? "sentence-mode-too-long" : "word-mode-too-long", mode, maxLength };
    }
    return { allowed: true, reason: mode === "sentence" ? "sentence-mode" : "word-mode", mode, maxLength };
  },

  _onRenderTextSelectionPopup(event) {
    const { reader, doc, params, append } = event;
    try {
      this._refreshPrefsFromStorage();
      this._debugLog(
        "popup event: reader.itemID=" + (reader && reader.itemID) +
        ", tabID=" + (reader && reader.tabID) +
        ", keys=" + Object.keys(reader || {}).slice(0, 12).join(",")
      );
    } catch (e) {}
    if (!this._data || !this._data.enabled) return;
    const text = (params && params.annotation && params.annotation.text || "").trim();
    this._debugLog("popup text: len=" + text.length + ", text=" + JSON.stringify(text.slice(0, 120)));
    if (!text) {
      this._debugLog("popup skip: no selected text");
      return;
    }
    const selectionCheck = this._isSelectionTextAllowed(text);
    if (!selectionCheck.allowed) {
      this._debugLog(
        "popup skip: reason=" + selectionCheck.reason +
        ", mode=" + (selectionCheck.mode || "word") +
        ", len=" + text.length +
        ", max=" + (selectionCheck.maxLength || 0)
      );
      return;
    }

    // 快捷键-划词翻译：缓存当前选中文本。
    // 鼠标/按键事件实际发生在 PDF.js 的 iframe window，popup 出现时绑定一次。
    try {
      const hotkeyWin = this._getHotkeyTargetWindow(reader);
      if (hotkeyWin) this._bindHotkeyModifierListener(hotkeyWin, reader);
    } catch (e) {
      this._debugLog("hotkey bind ERROR: " + (e && (e.stack || e.message || String(e))));
    }
    const session = this._selectionTranslateSession;
    const popupText = this._normalizeSelectionTranslateText(text);
    if (session && session.active) {
      const popupWindow = doc && doc.defaultView;
      const sameReader = session.reader === reader;
      if (!sameReader) {
        this._debugLog("selection translate popup-skip: reader=mismatch, doc=not-checked");
        return;
      }
      // Reader 的 append 只在本次 renderTextSelectionPopup 回调栈内有效。
      // 因此必须在这里同步创建/挂载本插件按钮，不能把 append 留到 mouseup 再调用。
      let popupButton = doc && doc.querySelector ? doc.querySelector(".wordtranslator-add-btn") : null;
      if (!popupButton && typeof append === "function") {
        try {
          const label = this._data.contextMenuLabel || "添加单词并翻译";
          const created = this._createAddWordButton(doc, reader, popupText, this._getAddWordButtonHTML(label));
          append(created);
          popupButton = doc.querySelector ? doc.querySelector(".wordtranslator-add-btn") : null;
          if (!popupButton && created.isConnected) popupButton = created;
          this._debugLog("selection translate popup button mounted synchronously: connected=" + !!(popupButton && popupButton.isConnected));
        } catch (e) {
          this._debugLog("selection translate popup button mount ERROR: " + (e && (e.message || String(e))));
        }
      }
      session.popupContext = {
        reader,
        doc,
        button: popupButton,
        append: null,
        text: popupText,
        time: Date.now(),
      };
      this._debugLog("selection translate popup cached: text=" + JSON.stringify(popupText) + ", mouseDown=" + session.mouseDown + ", selectionReady=" + session.selectionReady + ", doc=session-doc? " + (doc === session.doc));
      this._tryTriggerSelectionTranslate(session);
      return;
    }
    // 为“先选区后按添加单词快捷键”保留最新普通选区上下文。
    this._selectionFirstPending = { reader: reader, text: text, doc: doc, append: append, time: Date.now() };
    if (this._data.autoTranslate) {
      // 防抖去重：相同文本 2 秒内不重复自动添加
      const now = Date.now();
      if (this._lastAutoWord === text && now - (this._lastAutoTime || 0) < 2000) {
        return;
      }
      this._lastAutoWord = text;
      this._lastAutoTime = now;
      this._debugLog("autoTranslate: word=" + JSON.stringify(text) + ", reader.itemID=" + (reader && reader.itemID));
      const autoButton = doc.querySelector(".wordtranslator-add-btn");
      this._handleAddWordTrigger({ source: "auto", doc, btn: autoButton, append, reader, text });
      return;
    }
    // 先选区后按“添加单词”快捷键，以及普通 popup 按钮创建逻辑保持不变。
    const label = this._data.contextMenuLabel || "添加单词并翻译";
    const existingButton = doc.querySelector(".wordtranslator-add-btn");
    if (existingButton) {
      existingButton.innerHTML = this._getAddWordButtonHTML(label);
      this._lastSelectionPopup = { doc, reader, button: existingButton, text, time: Date.now() };
      return;
    }

    // Item Pane 标题和侧栏导航使用统一的 icon5.ico；
    const btn = this._createAddWordButton(doc, reader, text, this._getAddWordButtonHTML(label));
    append(btn);
    // 与统一触发入口一致：缓存 append 后 popup 中真实存在的节点。
    const mountedButton = doc.querySelector(".wordtranslator-add-btn") || (btn.isConnected ? btn : null);
    this._lastSelectionPopup = { doc, reader, button: mountedButton, text, time: Date.now() };
  },

  // 快捷键-划词翻译：组合键按下时触发翻译
  _getHotkeyTargetWindow(reader) {
    try {
      const internal = reader && reader._internalReader;
      if (internal) {
        try {
          const primary = internal._primaryView || internal.primaryView;
          if (primary) {
            const w = primary._iframeWindow || primary.iframeWindow;
            if (w) return w;
          }
        } catch (e) {}
        try {
          const secondary = internal._secondaryView || internal.secondaryView;
          if (secondary) {
            const w = secondary._iframeWindow || secondary.iframeWindow;
            if (w) return w;
          }
        } catch (e) {}
      }
    } catch (e) {}
    try {
      if (reader && reader._iframeWindow) return reader._iframeWindow;
    } catch (e) {}
    return null;
  },

  _getHotkeyTargetDoc(reader, fallbackDoc) {
    try {
      const w = this._getHotkeyTargetWindow(reader);
      if (w && w.document) return w.document;
    } catch (e) {}
    return fallbackDoc || null;
  },

  // 创建"添加单词并翻译"按钮（带 SVG 图标）
  _createAddWordButton(doc, reader, text, btnHTML) {
    const btn = doc.createElement("button");
    btn.className = "toolbar-button wide-button wordtranslator-add-btn";
    btn.setAttribute("data-tabstop", "1");
    btn.innerHTML = btnHTML || "";
    btn.addEventListener("click", (ev) => {
      try {
        ev.preventDefault();
        ev.stopPropagation();
        this._debugLog(
          "selection button clicked: word=" + JSON.stringify(text) +
          ", reader.itemID=" + (reader && reader.itemID) +
          ", reader.itemId=" + (reader && reader.itemId) +
          ", reader.tabID=" + (reader && reader.tabID)
        );

        this._handleAddWordTrigger({
          source: "button",
          doc,
          btn,
          reader,
          text,
        });
      } catch (err) {
        this._debugLog("btn click ERROR: " + (err && (err.stack || err.message || String(err))));
      }
    }, true);
    return btn;
  },

  _formatTempEditText(word, translation) {
    const w = String(word || "").trim();
    const t = String(translation || "").trim() || this.STATUS_TRANSLATING;
    return w ? w + " -- " + t : t;
  },

  _getAddWordButtonHTML(label) {
    const text = String(label || "添加单词并翻译");
    const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // 方案 A：使用内联 SVG 图标，不依赖 chrome:// 外部资源加载。
    // PDF 划词弹窗运行在 PDF.js iframe 沙箱中，无法加载 chrome:// 图片，
    // 因此改用与参考插件(zotero-pdf-translate)一致的内联 SVG 方式，确保稳定显示。
    const iconSVG = '<svg class="wordtranslator-add-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle;flex:0 0 16px;" aria-hidden="true"><rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="Highlight"/><text x="8" y="8" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="HighlightText">word</text><text x="8" y="13" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="3.5" fill="HighlightText">翻译</text></svg>';
    return iconSVG + "<span>" + safe + "</span>";
  },

  // 把按钮原地替换为可编辑文本框；已有编辑框时先恢复按钮
  _showTempEditArea(doc, btn, reader, text, translation) {
    try {
      if (this._tempEditState) this._restoreButtonFromTempEdit();
      if (!doc || !btn || !btn.isConnected) return;
      const textarea = doc.createElement("textarea");
      textarea.className = "wordtranslator-temp-edit";
      textarea.rows = 1;
      textarea.value = this._formatTempEditText(text, translation);
      textarea.placeholder = this.STATUS_TRANSLATING;
      textarea.setAttribute("data-tabstop", "1");
      textarea.style.resize = "both";
      textarea.style.boxSizing = "border-box";
      textarea.style.width = "100%";
      textarea.style.maxWidth = "100%";
      textarea.style.minWidth = "0";
      textarea.style.minHeight = "1.8em";
      textarea.style.height = "auto";
      textarea.style.lineHeight = "1.35";
      textarea.style.padding = "2px 4px";
      textarea.style.margin = "4px 0";
      textarea.style.fontSize = "inherit";
      textarea.style.whiteSpace = "pre-wrap";
      textarea.style.overflowWrap = "anywhere";
      textarea.style.overflowY = "hidden";
      textarea.addEventListener("input", () => this._resizeTempEditArea(textarea));
      btn.replaceWith(textarea);
      this._resizeTempEditArea(textarea);
      this._tempEditState = {
        doc: doc,
        btn: btn,
        textarea: textarea,
        reader: reader || null,
        text: String(text || "").trim(),
      };
      this._lastSelectionPopup = {
        doc,
        reader,
        button: textarea,
        textarea,
        text: String(text || "").trim(),
        time: Date.now(),
      };
      try {
        textarea.focus();
        textarea.select();
      } catch (e) {}
      this._bindTempEditAutoClose();
    } catch (e) {
      this._debugLog("_showTempEditArea ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _resizeTempEditArea(textarea) {
    try {
      if (!textarea) return;
      // 双保险：先强制按内容自然高度，再逐次读取 scrollHeight
      const prevHeight = parseFloat(textarea.style.height || "0") || 0;
      textarea.style.height = "auto";
      textarea.style.overflowY = "hidden";
      const view = textarea.ownerDocument && textarea.ownerDocument.defaultView;
      const style = view && view.getComputedStyle ? view.getComputedStyle(textarea) : null;
      const lineHeight = parseFloat(style && style.lineHeight) || 18;
      // 长句原文 + "-- 译文"可能超过单行；最大放宽到 10 行，避免内容被截断
      const maxHeight = lineHeight * 10;
      const minHeight = lineHeight * 1.35;
      // 弹窗隐藏/尚未渲染时 scrollHeight 可能为 0：保持原高度不塌缩，交给下方 rAF 重测
      const raw = textarea.scrollHeight || 0;
      const next = raw > 0 ? Math.max(minHeight, Math.min(raw, maxHeight)) : Math.max(minHeight, prevHeight);
      textarea.style.height = next + "px";
      textarea.style.overflowY = (textarea.scrollHeight || 0) > maxHeight ? "auto" : "hidden";
      // PDF.js 沙箱中 scrollHeight 在设置 height=auto 后可能尚未重排，下一帧再校正
      // 一次；偏大或偏小都校正（流式输出时每次增量都会再触发本函数，可自我修复）
      try {
        const win = view || (textarea.ownerDocument && textarea.ownerDocument.defaultView);
        if (win && typeof win.requestAnimationFrame === "function") {
          win.requestAnimationFrame(() => {
            try {
              if (!textarea || !textarea.isConnected) return;
              const sc = textarea.scrollHeight || 0;
              if (sc <= 0) return;
              const h = Math.max(minHeight, Math.min(sc, maxHeight));
              const cur = parseFloat(textarea.style.height || "0") || 0;
              if (Math.abs(h - cur) > 0.5) {
                textarea.style.height = h + "px";
                textarea.style.overflowY = sc > maxHeight ? "auto" : "hidden";
              }
            } catch (e) {}
          });
        }
      } catch (e) {}
    } catch (e) {}
  },

  // 翻译完成后更新临时编辑框内容
  _updateTempEditArea(word, translation) {
    const st = this._tempEditState;
    if (!st || !st.textarea || !st.textarea.isConnected) return;
    try {
      const cur = String(st.text || "").trim().toLowerCase();
      const tgt = String(word || "").trim().toLowerCase();
      if (!cur || cur !== tgt) return;
      st.textarea.value = this._formatTempEditText(st.text, translation);
      st.textarea.placeholder = translation ? "" : this.STATUS_TRANSLATING;
      this._resizeTempEditArea(st.textarea);
    } catch (e) {
      this._debugLog("_updateTempEditArea ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // 取消选中/外部点击/下一次翻译时：编辑框恢复为按钮
  _restoreButtonFromTempEdit() {
    const st = this._tempEditState;
    if (!st) return;
    this._tempEditState = null;
    this._unbindTempEditAutoClose();
    try {
      const { doc, textarea, reader, text } = st;
      if (!doc || !textarea || !textarea.isConnected) return;
      const label = (this._data && this._data.contextMenuLabel) || "添加单词并翻译";
      const btn = this._createAddWordButton(doc, reader, text, this._getAddWordButtonHTML(label));
      textarea.replaceWith(btn);
      this._lastSelectionPopup = {
        doc,
        reader,
        button: btn,
        text,
        time: Date.now(),
      };
    } catch (e) {
      this._debugLog("_restoreButtonFromTempEdit ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // 外部 mousedown（PDF 页面/弹出层）时自动恢复按钮
  _bindTempEditAutoClose() {
    try {
      if (this._tempEditBound) return;
      const st = this._tempEditState;
      if (!st) return;
      const handler = (ev) => {
        const s = this._tempEditState;
        if (!s || !s.textarea || !s.textarea.isConnected) {
          this._restoreButtonFromTempEdit();
          return;
        }
        const t = ev.target;
        if (t && (t === s.textarea || (s.textarea.contains && s.textarea.contains(t)))) return;
        this._restoreButtonFromTempEdit();
      };
      this._tempEditBound = true;
      this._tempEditCloseHandler = handler;
      const win = this._getHotkeyTargetWindow(st.reader);
      if (win && win.document) {
        win.document.addEventListener("mousedown", handler, true);
      }
      if (st.doc && st.doc.defaultView) {
        st.doc.defaultView.addEventListener("mousedown", handler, true);
      }
    } catch (e) {
      this._debugLog("_bindTempEditAutoClose ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _unbindTempEditAutoClose() {
    try {
      if (!this._tempEditBound) return;
      this._tempEditBound = false;
      const handler = this._tempEditCloseHandler;
      this._tempEditCloseHandler = null;
      if (!handler) return;
      const st = this._tempEditState;
      const win = st ? this._getHotkeyTargetWindow(st.reader) : null;
      if (win && win.document) {
        win.document.removeEventListener("mousedown", handler, true);
      }
      if (st && st.doc && st.doc.defaultView) {
        st.doc.defaultView.removeEventListener("mousedown", handler, true);
      }
    } catch (e) {
      this._debugLog("_unbindTempEditAutoClose ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // 解析键盘快捷键 spec，如 "ctrl+d"、"alt+1"、"ctrl"、"shift"。
  _parseHotkeySpec(spec) {
    try {
      if (!spec) return null;
      const parts = String(spec).toLowerCase().split("+").map(function (x) { return x.trim(); }).filter(Boolean);
      if (!parts.length) return null;
      const last = parts[parts.length - 1];
      if (parts.length === 1) {
        if (last === "ctrl" || last === "control") return { key: "ctrl" };
        if (last === "alt") return { key: "alt" };
        if (last === "shift") return { key: "shift" };
      }
      return {
        ctrl: parts.indexOf("ctrl") >= 0 || parts.indexOf("control") >= 0,
        alt: parts.indexOf("alt") >= 0,
        shift: parts.indexOf("shift") >= 0,
        key: last,
      };
    } catch (e) {
      return null;
    }
  },

  // 匹配键盘事件（keydown/keyup）与自定义快捷键 spec
  _matchCustomHotkeyKey(ev, spec) {
    try {
      const p = this._parseHotkeySpec(spec);
      if (!p || p.mouse) return false;
      const k = (ev.key || "").toLowerCase();
      if (!k || k === "control" || k === "shift" || k === "alt" || k === "meta") return false;
      if (k !== p.key) return false;
      return (
        (!!ev.ctrlKey) === (!!p.ctrl) &&
        (!!ev.altKey) === (!!p.alt) &&
        (!!ev.shiftKey) === (!!p.shift)
      );
    } catch (e) {
      return false;
    }
  },

  // 匹配"事件时记录的修饰键状态"与自定义键盘 spec（不依赖 ev 对象，供 popup 路径使用）
  _matchCustomHotkeyMods(p, mods) {
    try {
      if (!p || !mods) return false;
      if (p.key === "ctrl") return !!mods.ctrl && !mods.alt && !mods.shift;
      if (p.key === "alt") return !!mods.alt && !mods.ctrl && !mods.shift;
      if (p.key === "shift") return !!mods.shift && !mods.ctrl && !mods.alt;
      return (
        (!!mods.ctrl) === (!!p.ctrl) &&
        (!!mods.alt) === (!!p.alt) &&
        (!!mods.shift) === (!!p.shift)
      );
    } catch (e) {
      return false;
    }
  },

  // 当前是否启用自定义快捷键（划词翻译）
  _customHotkeyActive() {
    return !!(this._data && this._data.customHotkeyEnabled && this._data.customHotkey);
  },

  // 划词翻译快捷键是否处于可用状态：
  // 预设组合键（hotkeyEnabled）与自定义快捷键（customHotkeyEnabled）二选一，任一开启即视为可用。
  _selectionHotkeyActive() {
    return !!(this._data && (this._data.hotkeyEnabled || this._data.customHotkeyEnabled));
  },

  // 当前是否启用“添加单词”快捷键（合并方案：先选区后按绑定键）
  // mode: "ctrl" | "alt" | "shift" | "custom"
  _addWordHotkeyActive() {
    if (!this._data || !this._data.addWordHotkeyEnabled) return false;
    const mode = this._data.addWordHotkeyMode || "custom";
    if (mode === "ctrl" || mode === "alt" || mode === "shift") return true;
    if (mode === "custom") return !!this._data.addWordHotkey;
    // 侧键模式：依赖桥接进程是否运行
    if (mode === "xbutton1" || mode === "xbutton2" || mode === "xbutton-both") {
      return this._xbuttonBridge.active === true;
    }
    return false;
  },

  // 当前“添加单词”快捷键对应的实际 spec（用于运行时匹配）
  _addWordHotkeySpec() {
    if (!this._data) return "";
    const mode = this._data.addWordHotkeyMode || "custom";
    if (mode === "ctrl" || mode === "alt" || mode === "shift") return mode;
    if (mode === "custom") return this._data.addWordHotkey || "";
    return "";
  },

  // “先选区后按绑定键”：按下绑定键（keydown 触发，不要求 keyup）时，
  // 若当前缓存了选中文本（_hotkeyPending），则立即执行「添加单词并翻译」。
  _matchSelectionFirstKey(ev) {
    try {
      if (!ev) return false;
      const d = this._data;
      if (!d) return false;
      if (d.addWordHotkeyMode === "ctrl") {
        return (ev.key === "Control" || ev.key === "ctrl") && !ev.altKey && !ev.shiftKey;
      }
      if (d.addWordHotkeyMode === "alt") {
        return (ev.key === "Alt" || ev.key === "alt") && !ev.ctrlKey && !ev.shiftKey;
      }
      if (d.addWordHotkeyMode === "shift") {
        // Shift 在 PDF 中用于整段连选（点 A → Shift+点 B），仅作为“先选区后按绑定键”的绑定键使用
        return (ev.key === "Shift" || ev.key === "shift") && !ev.ctrlKey && !ev.altKey;
      }
      if (d.addWordHotkeyMode === "custom") {
        const p = this._parseHotkeySpec(d.addWordHotkey || "");
        if (!p || p.mouse) return false;
        const k = (ev.key || "").toLowerCase();
        // 纯修饰键录制（如 Ctrl / Alt / Shift）
        if (p.key === "ctrl" || p.key === "alt" || p.key === "shift") {
          return (
            (p.key === "ctrl" && k === "control") ||
            (p.key === "alt" && k === "alt") ||
            (p.key === "shift" && k === "shift")
          );
        }
        if (!k || k === "control" || k === "shift" || k === "alt" || k === "meta") return false;
        return (
          k === p.key &&
          (!!ev.ctrlKey) === (!!p.ctrl) &&
          (!!ev.altKey) === (!!p.alt) &&
          (!!ev.shiftKey) === (!!p.shift)
        );
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  // Refresh self._data from storage. Used so that toggling
  // "addWordHotkeyEnabled" / "customHotkeyEnabled" in the preferences takes effect
  // immediately, without requiring a Zotero restart.
  // 节流策略：默认 250ms 内只读一次磁盘，避免高频热路径（mousedown/keydown/keyup）
  // 反复 IO 造成卡顿（特别是自定义快捷键 Ctrl+C 等组合键时表现明显）。
  // 同时使用 mtime 对比——文件未变化则完全跳过反序列化。
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

  _normalizeSelectionTranslateText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  },

  _matchSelectionTranslateKey(ev) {
    try {
      const p = this._parseHotkeySpec(this._data && this._data.customHotkey);
      if (!p) return false;
      const key = String(ev && ev.key || "").toLowerCase();
      if (!key) return false;
      if (p.key === "ctrl") return key === "control" || key === "ctrl";
      if (p.key === "alt") return key === "alt";
      if (p.key === "shift") return key === "shift";
      if (key !== String(p.key || "").toLowerCase()) return false;
      return (
        (!!ev.ctrlKey) === (!!p.ctrl) &&
        (!!ev.altKey) === (!!p.alt) &&
        (!!ev.shiftKey) === (!!p.shift)
      );
    } catch (e) {
      return false;
    }
  },

  _clearSelectionTranslateState(reason) {
    this._debugLog("clear selection translate state: " + (reason || "unknown"));
    this._selectionTranslateSession = null;
  },

  _hasFreshPendingSelection() {
    const pending = this._selectionFirstPending;
    return !!(pending && pending.text && Date.now() - (pending.time || 0) <= 10000);
  },

  // 判断 keyup 释放的是否为当前划词翻译快捷键的按键本体
  _isSelectionHotkeyKeyUp(ev) {
    try {
      if (!ev) return false;
      const key = String(ev.key || "").toLowerCase();
      if (this._customHotkeyActive()) {
        const p = this._parseHotkeySpec(this._data.customHotkey);
        if (!p || p.mouse) return false;
        if (p.key === "alt") return key === "alt";
        if (p.key === "ctrl") return key === "control" || key === "ctrl";
        if (p.key === "shift") return key === "shift";
        return key === String(p.key || "").toLowerCase();
      }
      const mod = (this._data && this._data.hotkeyModifier) || "ctrl";
      if (mod === "alt") return key === "alt";
      if (mod === "ctrl") return key === "control" || key === "ctrl";
      if (mod === "ctrl+alt") return key === "control" || key === "ctrl" || key === "alt";
      return false;
    } catch (e) {
      return false;
    }
  },

  // 当前选中文本是否有有效“先选区后按绑定键”缓存
  _getSelectionFirstPending() {
    const pending = this._selectionFirstPending;
    if (!pending || !pending.text) return null;
    if (Date.now() - (pending.time || 0) > 10000) return null;
    return pending;
  },

  _inSelectionHotkeySession() {
    const session = this._selectionTranslateSession;
    if (!session) return false;
    const sourceText = this._normalizeSelectionTranslateText(session.selectionText);
    return !!(session.active && sourceText && session.selectionReady && !session.mouseDown);
  },

  // 先选区后按“添加单词”快捷键的适配器；不属于快捷键-划词翻译会话。
  _triggerHotkeyTranslate(pending) {
    try {
      if (!pending || !pending.reader || !pending.text) return;
      const now = Date.now();
      const key = String((pending.reader && pending.reader.tabID) || "") + "|" + String(pending.text || "");
      if (this._lastHotkeyKey === key && now - (this._lastHotkeyTime || 0) < 500) {
        return;
      }
      this._lastHotkeyKey = key;
      this._lastHotkeyTime = now;
      const popup = this._lastSelectionPopup;
      const pendingDoc = pending.doc || null;
      const popupDoc = popup && popup.doc || null;
      const doc = pendingDoc || popupDoc;
      let btn = pending.btn || null;
      if (!btn && doc && doc.querySelector) {
        btn = doc.querySelector(".wordtranslator-add-btn");
      }
      if (!btn && popup && popup.doc === doc && popup.button &&
          popup.button.classList && popup.button.classList.contains("wordtranslator-add-btn")) {
        btn = popup.button;
      }

      this._debugLog(
        "hotkey adapter: word=" + JSON.stringify(pending.text) +
        ", hasPendingDoc=" + !!pendingDoc +
        ", hasPendingAppend=" + (typeof pending.append === "function") +
        ", hasPopupDoc=" + !!popupDoc +
        ", hasPopupButton=" + !!(popup && popup.button) +
        ", hasButton=" + !!btn +
        ", buttonConnected=" + !!(btn && btn.isConnected)
      );
      this._debugLog("hotkey translate: word=" + JSON.stringify(pending.text));

      // 快捷键路径只负责适配选区缓存，UI 生命周期和业务处理统一交给入口函数。
      this._handleAddWordTrigger({
        source: "hotkey",
        doc,
        btn,
        append: pending.append || null,
        reader: pending.reader,
        text: pending.text,
      });
    } catch (e) {
      this._debugLog("_triggerHotkeyTranslate ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _getReaderItemID(reader) {
    if (!reader) return null;

    const candidates = [
      reader.itemID,
      reader.itemId,
      reader._itemID,
      reader.item && reader.item.id,
    ];

    for (const value of candidates) {
      if (value !== undefined && value !== null && value !== "") {
        const id = Number(value);
        if (Number.isFinite(id) && id > 0) {
          return id;
        }
      }
    }

    try {
      if (reader.tabID && Zotero.Reader && Zotero.Reader.getByTabID) {
        const r = Zotero.Reader.getByTabID(reader.tabID);
        if (r) {
          const id = Number(r.itemID || r.itemId);
          if (Number.isFinite(id) && id > 0) {
            return id;
          }
        }
      }
    } catch (e) {
      this._debugLog(
        "_getReaderItemID ERROR: " +
        (e && (e.stack || e.message || String(e)))
      );
    }

    return null;
  },

  /**
   * 将 reader 的 itemID 解析为 Item Pane 实际使用的条目 ID
   * Zotero 中 PDF 附件与 Item Pane 使用的条目 ID 可能不同，需要转换
   * 返回 null 表示解析失败，调用方应使用原始 ID 作为 fallback
   */
  _getItemPaneID(attachmentOrItemID) {
    try {
      let itemID = Number(attachmentOrItemID);
      if (!Number.isFinite(itemID) || itemID <= 0) return null;

      const item = Zotero.Items.get(itemID);
      if (!item) return null;
      // 附件 -> 父条目
      if (typeof item.isAttachment === "function" ? item.isAttachment() : item.isAttachment) {
        if (item.parentID) {
          const parentID = Number(item.parentID);
          this._debugLog("resolve pane ID: attachment " + itemID + " -> parent " + parentID);
          return parentID;
        }
        // 无父条目的附件，直接用自身 ID
        return itemID;
      }
      // 普通条目 -> 直接用自身 ID
      return itemID;
    } catch (e) {
      this._debugLog(
        "_getItemPaneID ERROR: " +
        (e && (e.stack || e.message || String(e)))
      );
      return null;
    }
  },

  async _addWordForReader(reader, word) {
    this._debugLog(
      "_addWordForReader called: word=" + JSON.stringify(word) +
      ", reader=" + !!reader +
      ", reader.itemID=" + (reader && reader.itemID)
    );

    const readerItemID = this._getReaderItemID(reader);
    if (!readerItemID) {
      this._debugLog(
        "_addWordForReader ABORT: itemID empty; reader keys=" +
        Object.keys(reader || {}).join(",")
      );
      try {
        Services.prompt.alert(
          Zotero.getMainWindow(),
          "Word Translator",
          "无法获取当前 PDF 对应的条目 ID。请查看 startup-debug.log。"
        );
      } catch (e) {}
      return;
    }

    // 将 reader.itemID（PDF 附件 ID）转换为 Item Pane 所需的条目 ID
    const paneID = this._getItemPaneID(readerItemID) || readerItemID;
    this._debugLog(
      "_addWordForReader resolve: readerItemID=" + readerItemID +
      ", paneID=" + paneID
    );

    const normWord = String(word || "").trim();
    if (!normWord) {
      this._debugLog("_addWordForReader ABORT: word empty");
      return;
    }
    const list = this._itemWords.get(Number(paneID)) || [];
    const existingCard = list.find(function (c) {
      return c && String(c.word || "").toLowerCase() === normWord.toLowerCase();
    });
    if (existingCard) {
      // 状态判断走 pending 布尔与常量，不再比较显示字符串：
      // 翻译中残留或上次失败 → 复用卡片重新翻译；已有真实译文 → 视为最近使用，跳过 API。
      if (existingCard.pending || existingCard.translation === this.STATUS_FAILED) {
        this._debugLog("_addWordForReader re-translate (pending or failed): " + JSON.stringify(normWord));
        existingCard.translation = this.STATUS_TRANSLATING;
        existingCard.pending = true;
        // 移动到末尾（最近使用）
        const existingIndex = list.indexOf(existingCard);
        if (existingIndex >= 0 && existingIndex !== list.length - 1) {
          list.splice(existingIndex, 1);
          list.push(existingCard);
          this._itemWords.set(Number(paneID), list);
          this._persistWordsForItem(Number(paneID));
          this._applyWordBookView(Number(paneID), { source: "duplicate-reorder" });
        }
        // 复用 existingCard，跳过下面 card 创建
        var card = existingCard;
      } else {
        this._debugLog("_addWordForReader skip (duplicate): " + JSON.stringify(normWord));
        try {
          this._updateTempEditArea(normWord, String(existingCard.translation || "").trim());
          const existingIndex = list.indexOf(existingCard);
          if (existingIndex >= 0 && existingIndex !== list.length - 1) {
            list.splice(existingIndex, 1);
            list.push(existingCard);
            this._itemWords.set(Number(paneID), list);
            this._persistWordsForItem(Number(paneID));
            this._applyWordBookView(Number(paneID), { source: "duplicate-reorder" });
          }
        } catch (e) {
          this._debugLog("duplicate recent-use update ERROR: " + (e && (e.message || String(e))));
        }
        return;
      }
    }
    if (typeof card === "undefined") {
      var card = { word: normWord, translation: this.STATUS_TRANSLATING, pending: true };
      list.push(card);
      this._itemWords.set(Number(paneID), list);
      this._persistWordsForItem(Number(paneID));
    }
    try {
      const st = this._getWordBookViewState(Number(paneID));
      if (st && st.page !== 1) {
        st.page = 1;
        this._wordBookViewState.set(Number(paneID), st);
      }
    } catch (e) {}

    this._applyWordBookView(Number(paneID), { source: "addWord" });
    // P4：词典提前异步补全，不等翻译结果——卡片先显示翻译中 + 词典行
    try {
      if (Zotero.WordTranslatorDict && typeof Zotero.WordTranslatorDict.lookup === "function") {
        this._enrichDict(normWord);
      }
    } catch (e) {}

    try {
      const api = this.getActiveApi();
      this._debugLog(
        "translate start: api=" + JSON.stringify(api ? {
          name: api.name, provider: api.provider,
          baseUrl: api.baseUrl, model: api.model, hasKey: !!api.apiKey
        } : null)
      );
      // 流式增量上屏：onChunk 实时更新临时编辑框（逐 chunk 长高，原始设计意图）。
      // OpenAI 兼容路径为真流式；适配器类 provider 拿到完整结果后回调一次。
      const result = await this._translateWithTimeout(word, null, (partial) => {
        try { this._updateTempEditArea(normWord, partial); } catch (e0) {}
      });
      card.translation = result || this.STATUS_FAILED;
      this._debugLog("translate success: " + JSON.stringify(card.translation));
    } catch (e) {
      card.translation = this.STATUS_FAILED;
      this._debugLog("translate ERROR: " + (e && (e.stack || e.message || String(e))));
    } finally {
      card.pending = false;
      this._flushAndPersistWords();
      this._applyWordBookView(Number(paneID), { source: "translate-finish" });
      // Beta: udpate temp edit area
      try {
        this._updateTempEditArea(normWord, card.translation);
      } catch (e) {
        this._debugLog("_updateTempEditArea ERROR in finally: " + (e && (e.message || String(e))));
      }
      // 兜底：若当前激活的 Item Pane 与本卡片归属的 paneID 相同，
      // 直接重渲染当前 body，确保单词本立即显示新卡片/新翻译
      try {
        const win = Zotero.getMainWindow();
        const doc = win && win.document;
        const zp = doc && doc.getElementById && doc.getElementById("zotero-item-pane");
        const curItemId = zp && zp.getAttribute && zp.getAttribute("data-itemid");
        if (curItemId && Number(curItemId) === Number(paneID)) {
          await this._rerenderCurrentItemPane("addWord-finish");
        }
      } catch (e2) {}
      this._debugLog("_addWordForReader finished: paneID=" + paneID);
    }
  },

  // 字典服务：查词并补全卡片学词信息。lookup 命中即写内存缓存，
  // 这里只需重绘一次让卡片显示 [音标] 词性.释义 行。全程后台、静默。
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

  _refreshItemPane(itemID, viewInfo) {
    const id = Number(itemID);
    if (!Number.isFinite(id) || id <= 0) return;
    this._debugLog("_refreshItemPane: id=" + id + ", hasViewInfo=" + !!viewInfo);
    try {
      const pane = this._currentPaneContext;
      const win = Zotero.getMainWindow();
      const doc = pane && pane.doc && pane.doc.defaultView ? pane.doc : (win && win.document);
      const body = pane && pane.body && pane.body.isConnected
        ? pane.body
        : (doc && doc.querySelector && doc.querySelector(".wordtranslator-pane-body"));
      if (!body || !this._renderPaneBody) return;
      this._currentPaneContext = {
        doc,
        body,
        itemID: id,
        paneUID: body.dataset && body.dataset.wtPaneUid || null,
      };
      try { body.dataset.paneItemID = String(id); } catch (e) {}
      this._renderPaneBody(doc, body, { id, viewInfo: viewInfo || null });
    } catch (e) {
      this._debugLog("_refreshItemPane ERROR: " + (e && (e.message || String(e))));
    }
  },

  _deleteWordForItem(itemID, index) {
    const id = Number(itemID);
    const list = this._itemWords.get(id);
    if (!list) return;
    list.splice(index, 1);
    this._itemWords.set(id, list);
    this._persistWordsForItem(id);
    this._applyWordBookView(id, { source: "delete" });
  },

  _normalizeHighlight(value) {
    const hl = String(value || "");
    return (hl === "amber" || hl === "sage" || hl === "blue" || hl === "rose") ? hl : "";
  },

  _getDefaultHighlight() {
    return this._normalizeHighlight(this._data && this._data.defaultHighlight) || "amber";
  },

  _setDefaultHighlight(color) {
    const next = this._normalizeHighlight(color);
    if (!next || !this._data || this._data.defaultHighlight === next) return;
    this._data.defaultHighlight = next;
    this._saveData();
  },

  _setCardHighlight(itemID, index, color, remember) {
    const id = Number(itemID);
    const list = this._itemWords.get(id);
    const card = list && list[index];
    if (!card) return;
    const next = this._normalizeHighlight(color);
    if (next) {
      card.highlight = next;
      if (remember) this._setDefaultHighlight(next);
    } else {
      delete card.highlight;
    }
    this._persistWordsForItem(id);
    this._applyWordBookView(id, { source: "highlight" });
  },

  _toggleCardHighlight(itemID, index) {
    const id = Number(itemID);
    const list = this._itemWords.get(id);

    const card = list && list[index];
    if (!card) return;
    this._setCardHighlight(id, index, card.highlight ? "" : this._getDefaultHighlight(), false);
  },

  // P6：卡片级字典显示模式（dictMode 覆盖全局 dictDisplayMode；再次点击当前模式取消单独控制）
  _setCardDictMode(itemID, index, mode) {
    const id = Number(itemID);
    const list = this._itemWords.get(id);
    const card = list && list[index];
    if (!card) return;
    if (card.dictMode === mode) {
      // 再次点击当前模式 → 取消单独控制，回落全局
      delete card.dictMode;
    } else if (mode === "he" || mode === "dan" || mode === "dian") {
      card.dictMode = mode;
    } else {
      delete card.dictMode;
    }
    this._persistWordsForItem(id);
    this._applyWordBookView(id, { source: "dict-mode" });
  },

  _hideCardMenu() {
    const menu = this._cardMenu;
    if (!menu) return;
    try { if (menu.onDoc) menu.doc.removeEventListener("mousedown", menu.onDoc, true); } catch (e) {}
    try { if (menu.onKey) menu.doc.removeEventListener("keydown", menu.onKey, true); } catch (e) {}
    try { if (menu.onScroll) menu.doc.removeEventListener("scroll", menu.onScroll, true); } catch (e) {}
    try { if (menu.el && menu.el.parentNode) menu.el.parentNode.removeChild(menu.el); } catch (e) {}
    this._cardMenu = null;
  },

  // P5/P6：字典显示模式文案（合/单/典）
  _dictModeLabel(mode) {
    return mode === "dan" ? "单" : mode === "dian" ? "典" : "合";
  },
  _dictModeTooltip(mode) {
    return mode === "dan" ? "只显示[单词 -- 翻译]" : mode === "dian" ? "只显示字典" : "显示[单词 -- 翻译]和字典";
  },

  // 🔊 播放器注册表：每个引擎独立实现、只读自己的源，杜绝跨引擎状态残留。
  // 引擎键与偏好页 ttsEngine 值一致；新增引擎 = 增注册 + 条目数据带对应 audio 字段。
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
        body: JSON.stringify({ model: "tts-1", input: word, voice: "alloy", response_format: "mp3" }),
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

  _showCardMenu(ev, itemID, index, card) {
    this._hideCardMenu();
    try {
      const cardEl = ev && ev.currentTarget;
      const doc = (cardEl && cardEl.ownerDocument) || (ev.target && ev.target.ownerDocument);
      if (!doc || !cardEl) {
        this._debugLog("_showCardMenu abort: doc=" + !!doc + ", cardEl=" + !!cardEl);
        return;
      }
      const self = this;
      const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
      const txt = (s) => this._createTxt(doc, s);
      const current = this._normalizeHighlight(card && card.highlight);
      const colors = [
        { id: "amber", label: "琥珀" },
        { id: "sage", label: "苔绿" },
        { id: "blue", label: "雾蓝" },
        { id: "rose", label: "玫瑰" },
      ];

      const menu = el("div", { class: "wt-card-menu", role: "menu" });
      colors.forEach((c) => {
        const btn = el("button", {
          type: "button",
          class: "wt-hl-swatch wt-hl-swatch-" + c.id + (current === c.id ? " is-active" : ""),
          title: c.label,
          "aria-label": c.label,
        });
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          self._hideCardMenu();
          self._setCardHighlight(itemID, index, c.id, true);
        });
        menu.append(btn);
      });
      // P6：字典显示模式（卡片级，覆盖全局；仅对具字典对象卡片起效）
      const curMode = (card && card.dictMode) || "";
      const modes = [
        { id: "he", label: "合" },
        { id: "dan", label: "单" },
        { id: "dian", label: "典" },
      ];
      modes.forEach((m) => {
        const mb = el("button", {
          type: "button",
          class: "wt-card-menu-btn wt-dict-mode-btn" + (curMode === m.id ? " is-active" : ""),
          title: self._dictModeTooltip(m.id),
          "aria-label": m.label,
        }, [txt(m.label)]);
        mb.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          self._hideCardMenu();
          self._setCardDictMode(itemID, index, m.id);
        });
        menu.append(mb);
      });
      const retryBtn = el("button", {
        type: "button",
        class: "wt-card-menu-btn",
        title: "重新翻译",
        "aria-label": "重新翻译",
      }, [txt("↻")]);
      retryBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        self._hideCardMenu();
        self._retryTranslationForCard(itemID, index, card);
      });
      const delBtn = el("button", {
        type: "button",
        class: "wt-card-menu-btn",
        title: "删除",
        "aria-label": "删除",
      }, [txt("✕")]);
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        self._hideCardMenu();
        self._deleteWordForItem(itemID, index);
      });
      menu.append(retryBtn, delBtn);
      cardEl.append(menu);

      const cardRect = cardEl.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      let left = ev.clientX - cardRect.left;
      let top = ev.clientY - cardRect.top;
      if (left + menuRect.width > cardRect.width) left = Math.max(0, cardRect.width - menuRect.width);
      if (left < 0) left = 0;
      if (top + menuRect.height > cardRect.height) top = Math.max(0, cardRect.height - menuRect.height);
      if (top < 0) top = 0;
      menu.style.left = left + "px";
      menu.style.top = top + "px";

      const onDoc = (e) => {
        if (menu.contains(e.target)) return;
        self._hideCardMenu();
      };
      const onKey = (e) => {
        if ((e.key || "").toLowerCase() === "escape") self._hideCardMenu();
      };
      const onScroll = () => self._hideCardMenu();
      doc.addEventListener("mousedown", onDoc, true);
      doc.addEventListener("keydown", onKey, true);
      doc.addEventListener("scroll", onScroll, true);
      this._cardMenu = { el: menu, doc, onDoc, onKey, onScroll };
      this._debugLog("_showCardMenu: itemID=" + itemID + ", index=" + index);
    } catch (e) {
      this._debugLog("_showCardMenu ERROR: " + (e && (e.stack || e.message || e)));
    }
  },

  // 翻译超时兜底：provider 长时间无响应（如 DeepL 免费版挂起）时按失败处理，
  // 走词典服务兜底显示，避免"翻译中…"永远不结束。
  async _translateWithTimeout(text, timeoutMs, onChunk) {
    const timeout = timeoutMs || 15000;
    let timer = null;
    try {
      return await Promise.race([
        this.translate(text, null, onChunk),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("翻译超时（" + Math.round(timeout / 1000) + " 秒未返回）")), timeout);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  },

  async _retryTranslationForCard(itemID, index, card) {
    const id = Number(itemID);
    const list = this._itemWords.get(id);
    const currentCard = list && list[index];
    if (!list || !currentCard || currentCard !== card) return;

    currentCard.translation = this.STATUS_TRANSLATING;
    currentCard.pending = true;
    this._persistWordsForItem(id);
    this._applyWordBookView(id, { source: "retry-translate" });
    // P3：重新翻译同时重查词典（切换字典源后 ↻ 生效）
    try {
      if (Zotero.WordTranslatorDict && typeof Zotero.WordTranslatorDict.lookup === "function") {
        this._enrichDict(currentCard.word);
      }
    } catch (e) {}

    try {
      const result = await this._translateWithTimeout(currentCard.word, null, (partial) => {
        try { this._updateTempEditArea(currentCard.word, partial); } catch (e0) {}
      });
      currentCard.translation = result || this.STATUS_FAILED;
      this._debugLog("retry translate success: " + JSON.stringify(currentCard.translation));
    } catch (e) {
      currentCard.translation = this.STATUS_FAILED;
      this._debugLog("retry translate ERROR: " + (e && (e.stack || e.message || String(e))));
    } finally {
      currentCard.pending = false;
      this._flushAndPersistWords();
      this._applyWordBookView(id, { source: "retry-translate-finish" });
      try {
        this._updateTempEditArea(currentCard.word, currentCard.translation);
      } catch (e) {
        this._debugLog("_updateTempEditArea ERROR in retry finally: " + (e && (e.message || String(e))));
      }
      try {
        const win = Zotero.getMainWindow();
        const doc = win && win.document;
        const zp = doc && doc.getElementById && doc.getElementById("zotero-item-pane");
        const curItemId = zp && zp.getAttribute && zp.getAttribute("data-itemid");
        if (curItemId && Number(curItemId) === id) {
          await this._rerenderCurrentItemPane("retry-translate-finish");
        }
      } catch (e2) {}
    }
  },

  _setActiveApiForItem(itemID, idx) {
    if (!this._data) return;
    this._data.activeApiIndex = Number(idx);
    this._saveData();
  },

  async _openPreferencesPane() {
    try {
      this._debugLog("_openPreferencesPane called");
      // 1. 先尝试使用 Zotero.Utilities.openPreferences 打开本插件配置面板
      try {
        if (Zotero && Zotero.Utilities && typeof Zotero.Utilities.openPreferences === "function") {
          Zotero.Utilities.openPreferences(this._paneID || "wordtranslator-prefs");
          this._debugLog("opened via Zotero.Utilities.openPreferences");
          return;
        }
      } catch (e1) {
        this._debugLog("Zotero.Utilities.openPreferences ERROR: " + (e1 && e1.message || e1));
      }
      // 2. 回退：直接打开 Zotero 偏好设置窗口（不切换到本插件 tab）
      try {
        const win = Zotero.getMainWindow();
        if (win && typeof win.openPreferences === "function") {
          win.openPreferences();
          this._debugLog("opened via win.openPreferences");
        } else if (win && win.ZoteroPane && typeof win.ZoteroPane.openPreferences === "function") {
          win.ZoteroPane.openPreferences();
          this._debugLog("opened via win.ZoteroPane.openPreferences");
        } else {
          this._debugLog("no available openPreferences API");
        }
      } catch (e2) {
        this._debugLog("openPreferences fallback ERROR: " + (e2 && e2.message || e2));
      }
    } catch (e) {
      this._debugLog("_openPreferencesPane ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _onZoomFontSize(itemID, delta) {
    try {
      if (!this._data) { this._debugLog("_onZoomFontSize ABORT: no data"); return; }
      const MIN = 9, MAX = 24, STEP = 1;
      const cur = Number(this._data.fontSize) || 13;
      let next = cur + delta * STEP;
      if (next < MIN) next = MIN;
      if (next > MAX) next = MAX;
      this._data.fontSize = next;
      this._saveData();
      // 放大/缩小同样借官方 item pane 刷新重渲染，避免写进孤儿 body（与其他按钮一致）
      this._triggerPaneRefresh();
      this.applyFontSizeToPane();
      this._debugLog("_onZoomFontSize: " + cur + " -> " + next);
    } catch (e) {
      this._debugLog("_onZoomFontSize ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  applyFontSizeToPane() {
    try {
      const fs = Number(this._data && this._data.fontSize) || 13;
      // 优先：只对当前 pane 里的 .wt-card-text 设置字号
      const cur = this._currentPane;
      if (cur && cur.body) {
        const nodes = cur.body.querySelectorAll(".wt-card-text");
        for (let i = 0; i < nodes.length; i++) nodes[i].style.fontSize = fs + "px";
        this._debugLog("applyFontSizeToPane: " + fs + "px applied to " + nodes.length + " .wt-card-text via _currentPane");
        return;
      }
      // 回退：扫描主 doc（可能在同一 doc 中）
      const win = Zotero.getMainWindow();
      const doc = win && win.document;
      if (!doc) return;
      const nodes = doc.querySelectorAll(".wt-card-text");
      let n = 0;
      for (let i = 0; i < nodes.length; i++) { nodes[i].style.fontSize = fs + "px"; n++; }
      // 再回退：遍历所有已知 paneUID，对每个用 dataset.wtPaneUid 找 body
      if (n === 0 && this._panelUIDs && this._panelUIDs.size > 0) {
        for (const [itemID, entry] of this._panelUIDs) {
          if (!entry || !entry.paneUID) continue;
          let body = doc.querySelector && doc.querySelector("[data-wt-pane-uid=\"" + entry.paneUID + "\"]");
          if (body) {
            const inner = body.querySelectorAll(".wt-card-text");
            for (let i = 0; i < inner.length; i++) { inner[i].style.fontSize = fs + "px"; n++; }
            continue;
          }
          try {
            const browsers = doc.getElementsByTagName && doc.getElementsByTagName("browser");
            if (browsers) {
              for (let i2 = 0; i2 < browsers.length; i2++) {
                const sd = browsers[i2].contentDocument;
                if (!sd) continue;
                const b = sd.querySelector("[data-wt-pane-uid=\"" + entry.paneUID + "\"]");
                if (b) {
                  const inner = b.querySelectorAll(".wt-card-text");
                  for (let i = 0; i < inner.length; i++) { inner[i].style.fontSize = fs + "px"; n++; }
                  break;
                }
              }
            }
          } catch (e2) { /* ignore */ }
        }
      }
      this._debugLog("applyFontSizeToPane: " + fs + "px applied to " + n + " node(s) (fallback)");
    } catch (e) {
      this._debugLog("applyFontSizeToPane ERROR: " + (e && (e.stack || e.message || String(e))));
    }
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
  async _rerenderCurrentItemPane(reason) {
    try {
      const context = this._currentPaneContext;
      if (context && context.body && context.body.isConnected && Number.isFinite(Number(context.itemID)) && Number(context.itemID) > 0) {
        this._renderPaneBody(context.doc, context.body, { id: Number(context.itemID) });
        this._debugLog("_rerenderCurrentItemPane(" + reason + "): context itemID=" + context.itemID);
        return;
      }
      const win = Zotero.getMainWindow();
      const doc = win && win.document;
      const zp = doc && doc.getElementById && doc.getElementById("zotero-item-pane");
      const curItemId = zp && zp.getAttribute && zp.getAttribute("data-itemid");
      if (curItemId && this._renderPaneBody) {
        const item = await Zotero.Items.getAsync(Number(curItemId));
        const body = doc.querySelector && doc.querySelector(".wordtranslator-pane-body");
        if (item && body) {
          this._renderPaneBody(doc, body, item);
          this._debugLog("_rerenderCurrentItemPane(" + reason + "): itemID=" + item.id);
        }
      }
    } catch (e3) {
      this._debugLog("_rerenderCurrentItemPane(" + reason + ") ERROR: " + (e3 && e3.message || e3));
    }
  },

  _clearAllWordsForItem(itemID) {
    const id = Number(itemID);
    this._itemWords.set(id, []);
    this._wordBookViewState.set(id, { page: 1, search: "" }); // 清空后回到第 1 页并清空搜索
    this._persistWordsForItem(id);
    this._applyWordBookView(id, { source: "clear" });
  },

  // ---------- 注册 Item Pane 面板 ----------
  registerItemPaneSection() {
    try {
      const key = Zotero.ItemPaneManager.registerSection({
        paneID: "wordtranslator",
        pluginID: this._addonID,
        header: {
          l10nID: "wordtranslator-itemPaneSection-header",
          icon: "chrome://wordtranslator/content/icons/wordtranslator-section-16.svg",
        },
        sidenav: {
          l10nID: "wordtranslator-itemPaneSection-sidenav",
          icon: "chrome://wordtranslator/content/icons/wordtranslator-section-20.svg",
          orderable: true,
        },
        bodyXHTML: '<html:div class="wordtranslator-pane-body" style="padding: 8px;"></html:div>',
        onInit: ({ body, refresh }) => {
          try {
            this._paneRefresh = refresh;
            const uid = Zotero.Utilities.randomString(8);
            if (body) {
              body.dataset.wtPaneUid = uid;
              body._wtRefresh = refresh;
            }
            this._debugLog("pane onInit: uid=" + uid + ", hasRefresh=" + !!refresh);
            // 必须始终覆盖，不要检查 isConnected：插件版本更新后旧 body 可能仍连接，
            // 不覆盖会导致后续所有渲染写入旧 body，界面卡死。
            this._currentPaneContext = { doc: body && body.ownerDocument, body, itemID: null, paneUID: uid };
          } catch (e) {
            this._debugLog("pane onInit ERROR: " + (e && (e.stack || e.message || String(e))));
          }
        },
        onDestroy: ({ body }) => {
          const uid = body.dataset.wtPaneUid;
          if (this._currentPaneContext && this._currentPaneContext.body === body) {
            this._currentPaneContext = null;
          }
          if (uid) {
            for (const [itemID, entry] of this._panelUIDs) {
              if (entry.paneUID === uid) this._panelUIDs.delete(itemID);
            }
          }
        },
        onItemChange: ({ item, body, setEnabled }) => {
          setEnabled(true);
          try {
            if (body && item && Number.isFinite(Number(item.id)) && Number(item.id) > 0) {
              const itemID = Number(item.id);
              body.dataset.itemID = String(itemID);
              this._currentPaneContext = {
                doc: body.ownerDocument,
                body,
                itemID,
                paneUID: body.dataset && body.dataset.wtPaneUid || null,
              };
            }
          } catch (e) {}
        },
        onRender: ({ doc, body, item }) => {
          try {
            this._debugLog("pane onRender: itemID=" + (item && item.id) + ", body=" + !!body);
            const rendered = this._renderPaneBody(doc, body, item);
            if (rendered !== false) this._applyPaneL10nFallback(doc, body);
          } catch (e) {
            this._debugLog("onRender ERROR: " + (e && (e.stack || e.message || String(e))));
          }
        },
      });
      if (key) this._paneKey = key;
      this._debugLog("registerItemPaneSection key=" + key);
    } catch (e) {
      this._debugLog("registerItemPaneSection ERROR: " + (e && (e.stack || e.message || e)));
    }
  },

  // DOM 兜底：Fluent 未加载时直接设置 header label 和 sidenav tooltiptext
  _applyPaneL10nFallback(doc, body) {
    try {
      if (!doc || !body) return;
      const isZh = Zotero.locale && Zotero.locale.startsWith("zh");
      const headerLabel = isZh ? "单词本" : "Word List";
      const sidenavTooltip = isZh ? "单词翻译" : "Word Translator";
      // 向上查找 item-pane-section 容器
      let section = body.closest ? body.closest("item-pane-section") : null;
      if (!section) {
        const p = body.parentElement;
        if (p) section = p.closest ? p.closest("item-pane-section") : null;
      }
      if (section) {
        // header label
        const labelEl = section.querySelector ? section.querySelector(".head .title, .head .label, .head label") : null;
        if (labelEl) {
          if (!labelEl.textContent || labelEl.textContent.trim() === "") {
            labelEl.textContent = headerLabel;
          }
        }
        // sidenav tooltiptext（在 sidebar 侧）
        const sidenavBtn = doc.querySelector('[data-pane-id="wordtranslator"]');
        if (sidenavBtn) {
          sidenavBtn.setAttribute("tooltiptext", sidenavTooltip);
          sidenavBtn.setAttribute("title", sidenavTooltip);
        }
      }
      // 另一种结构：直接在 sidenav-toolbar 内查找
      const sidenavBtns = doc.querySelectorAll('[data-pane-id="wordtranslator"], [data-pane="wordtranslator"]');
      for (const btn of sidenavBtns) {
        if (btn.classList && (btn.classList.contains("sidenav-button") || btn.tagName === "toolbarbutton" || btn.getAttribute("data-l10n-id") === "wordtranslator-itemPaneSection-sidenav")) {
          btn.setAttribute("tooltiptext", sidenavTooltip);
          btn.setAttribute("title", sidenavTooltip);
        }
      }
      // 最后兜底：部分 Zotero 版本把 l10n 节点放在独立的主窗口文档中，
      // 通过 data-l10n-id 直接定位并写入原生 tooltip 属性。
      const l10nBtns = doc.querySelectorAll('[data-l10n-id="wordtranslator-itemPaneSection-sidenav"]');
      for (const btn of l10nBtns) {
        btn.setAttribute("tooltiptext", sidenavTooltip);
        btn.setAttribute("title", sidenavTooltip);
      }
    } catch (e) {
      this._debugLog("_applyPaneL10nFallback ERROR: " + (e && (e.stack || e.message || e)));
    }
  },

  _createEl(doc, tag, attrs, children) {
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const e = doc.createElementNS(HTML_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        // null/undefined/false 表示不设置该属性；尤其避免 disabled=null 仍让按钮进入禁用态。
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") e.className = v;
        else if (k === "style") e.style.cssText = v;
        else e.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => e.append(c));
    return e;
  },
  _createTxt(doc, s) {
    return doc.createTextNode(String(s ?? ""));
  },

  _getSortedIndices(raw, mode) {
    if (!raw || !raw.length) return [];
    const indices = raw.map((_, i) => i);
    switch (mode) {
      case "forward":
        return indices;
      case "reverse":
        return indices.slice().reverse();
      case "alpha":
        return indices.slice().sort((a, b) => {
          const wa = (raw[a].word || "").toLowerCase();
          const wb = (raw[b].word || "").toLowerCase();
          return wa.localeCompare(wb);
        });
      default:
        return indices.slice().reverse();
    }
  },

  _registerWordBookSearchStrategy(name, matcher) {
    const key = String(name || "").trim();
    if (!key || typeof matcher !== "function") return false;
    this._wordBookSearchStrategies.set(key, matcher);
    return true;
  },

  _getWordBookSearchStrategy(name) {
    const key = String(name || "").trim();
    if (this._wordBookSearchStrategies.has(key)) return this._wordBookSearchStrategies.get(key);
    return this._wordBookSearchStrategies.get("prefix");
  },

  _getActiveSearchStrategyName() {
    const cfg = this._data && this._data.searchStrategy;
    const key = String(cfg || "prefix").trim();
    return this._wordBookSearchStrategies.has(key) ? key : "prefix";
  },

  _getWordBookSearchMatches(rawWords, search, strategyName) {
    const kw = String(search || "").trim().toLowerCase();
    if (!kw) return rawWords.map((_, index) => index);
    const matcher = this._getWordBookSearchStrategy(strategyName);
    return rawWords.reduce((matches, word, index) => {
      try {
        if (matcher && matcher(word, kw)) matches.push(index);
      } catch (e) {
        this._debugLog("search strategy ERROR: " + (e && (e.message || String(e))));
      }
      return matches;
    }, []);
  },

  // ---------- 单词本分页与搜索（临时界面状态，不写盘） ----------
  _getWordBookViewState(itemID) {
    let st = this._wordBookViewState.get(Number(itemID));
    if (!st) {
      st = { page: 1, search: "" };
      this._wordBookViewState.set(Number(itemID), st);
    }
    return st;
  },

  // 搜索匹配 → 排序 → 分页。返回 { indices, page, pageCount, total }
  _computePagedIndices(rawWords, sortMode, search, page, pageSize, strategyName) {
    const matched = new Set(this._getWordBookSearchMatches(rawWords, search, strategyName));
    const filtered = this._getSortedIndices(rawWords, sortMode)
      .filter((origIdx) => matched.has(origIdx));
    const total = filtered.length;
    const size = Math.max(1, Number(pageSize) || 10);
    const pageCount = Math.max(1, Math.ceil(total / size));
    let cur = Math.max(1, Math.floor(Number(page) || 1));
    if (cur > pageCount) cur = pageCount;
    const start = (cur - 1) * size;
    const indices = filtered.slice(start, start + size);
    return { indices, page: cur, pageCount, total };
  },

  _setWordBookPage(itemID, page) {
    const id = Number(itemID);
    const st = this._getWordBookViewState(id);
    this._debugLog("pagination request: itemID=" + id + ", requestedPage=" + page + ", currentPage=" + st.page);
    this._applyWordBookView(id, { source: "pagination", page: page });
  },

  // 触发层：一次 input 只产生一个搜索事件，防抖后交给统一后置处理器。
  _onWordBookSearchTrigger(itemID, keyword) {
    const id = Number(itemID);
    const value = String(keyword || "");
    this._debugLog("search trigger: itemID=" + id + ", keyword=" + JSON.stringify(value));

    const oldTimer = this._wordBookSearchTimers.get(id);
    if (oldTimer) {
      try { clearTimeout(oldTimer); } catch (e) {}
    }
    const timer = setTimeout(() => {
      this._wordBookSearchTimers.delete(id);
      this._handleWordBookSearchEvent({ type: "input", itemID: id, keyword: value });
      // _refreshItemPane 会重建 input；重建后恢复焦点和光标位置，保证可连续输入。
      try {
        const pane = this._currentPaneContext;
        const input = pane && pane.body && pane.body.isConnected
          ? pane.body.querySelector('input[type="search"]') : null;
        if (input) {
          input.focus();
          const end = String(input.value || "").length;
          if (typeof input.setSelectionRange === "function") input.setSelectionRange(end, end);
        }
      } catch (e) {
        this._debugLog("search focus restore ERROR: " + (e && (e.message || String(e))));
      }
    }, 250);
    this._wordBookSearchTimers.set(id, timer);
  },

  // 搜索事件触发后逻辑：更新视图状态，并统一执行检索、排序、分页和重渲染。
  _handleWordBookSearchEvent(event) {
    const e = event || {};
    const id = Number(e.itemID);
    if (!Number.isFinite(id) || id <= 0) return;
    const st = this._getWordBookViewState(id);
    st.search = String(e.keyword || "");
    st.page = 1;
    this._wordBookViewState.set(id, st);
    this._debugLog("search post-trigger: itemID=" + id + ", strategy=" + (this._getActiveSearchStrategyName()) + ", keyword=" + JSON.stringify(st.search));
    this._applyWordBookView(id, { source: e.type || "search" });
  },

  // 统一的单词本视图更新调度：检索 → 排序 → 分页 → 重渲染。所有业务触发点汇聚于此。
  // 触发 Zotero 官方 item pane 刷新：让 onRender 在"真正显示的 body"上重跑并重锚
  // _currentPaneContext。解决插件重载后手动写 DOM 不被显示的问题（重进 PDF/开关侧边栏等效）。
  _triggerPaneRefresh() {
    try {
      if (Zotero && Zotero.Notifier && typeof Zotero.Notifier.trigger === "function") {
        Zotero.Notifier.trigger("refresh", "itempane", []).catch(function (e) {
          try { Zotero.debug("[WordTranslator] pane refresh notifier ERROR: " + (e && e.message || e)); } catch (e2) {}
        });
      }
      if (this._paneRefresh && typeof this._paneRefresh === "function") {
        try { this._paneRefresh(); } catch (e) { this._debugLog("pane refresh callback ERROR: " + (e && e.message || e)); }
      }
    } catch (e) {
      this._debugLog("_triggerPaneRefresh ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _applyWordBookView(itemID, options) {
    const id = Number(itemID);
    if (!Number.isFinite(id) || id <= 0) return;
    const opts = options || {};
    // 所有会触发单词本重绘的按钮（排序/删除/清空/高亮/重翻译/翻页/搜索等）统一借
    // Zotero 官方 item pane 刷新，确保渲染进真正显示的 body（插件重载后自愈）。
    this._triggerPaneRefresh();
    const st = this._getWordBookViewState(id);
    const rawWords = this._itemWords.get(id) || [];
    const pageSize = Math.max(1, Number(this._data && this._data.pageSize) || 10);
    const strategyName = this._getActiveSearchStrategyName();
    const info = this._computePagedIndices(rawWords, this._sortMode, st.search, opts.page || st.page, pageSize, strategyName);
    st.page = info.page;
    this._wordBookViewState.set(id, st);
    this._debugLog("word-book post-trigger: source=" + (opts.source || "unknown") + ", itemID=" + id + ", strategy=" + strategyName + ", total=" + info.total + ", page=" + info.page + "/" + info.pageCount);
    this._refreshItemPane(id, info);
  },

  // 刷新按钮：自愈能力已由 _applyWordBookView 内部的 _triggerPaneRefresh 统一提供，
  // 这里仅需记录 itemID 到上下文（供 onRender 解析），再走 _applyWordBookView。
  _repairWordBookPane(itemID) {
    const id = Number(itemID);
    try {
      if (Number.isFinite(id) && id > 0 && this._currentPaneContext) {
        try { this._currentPaneContext.itemID = id; } catch (e) {}
      }
      if (Number.isFinite(id) && id > 0) this._applyWordBookView(id, { source: "refresh" });
    } catch (e) {
      this._debugLog("_repairWordBookPane ERROR: " + (e && (e.stack || e.message || String(e))));
      try { if (Number.isFinite(id) && id > 0) this._applyWordBookView(id, { source: "refresh" }); } catch (e2) {}
    }
  },

  // 返回需要显示的"空态/搜索无结果"提示节点；有结果时返回 null
  _getEmptyHint(doc, rawWords, search, pageInfo) {
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
    const txt = (s) => this._createTxt(doc, s);
    const kw = String(search || "").trim();
    if (rawWords.length === 0) {
      return el("div", { style: "color:GrayText;font-size:12px;padding:6px 4px;" }, [
        txt("暂无单词。打开 PDF 划词后，点击「" + (this._data && this._data.contextMenuLabel || "添加单词并翻译") + "」即可加入。")
      ]);
    }
    // 只在过滤后的结果确实为空时才显示"未找到"提示
    if (kw && pageInfo && pageInfo.indices && pageInfo.indices.length === 0) {
      return el("div", { style: "color:GrayText;font-size:12px;padding:6px 4px;" }, [
        txt("未找到与" + kw + "匹配的单词。")
      ]);
    }
    return null;
  },

  _setSortMode(mode) {
    if (mode !== "forward" && mode !== "reverse" && mode !== "alpha") return false;
    this._sortMode = mode;
    if (this._data) {
      this._data.sortMode = mode;
      this._saveData();
    }
    this._debugLog("_setSortMode: mode=" + mode + ", saved=true");
    return true;
  },

  _getSortIconHTML(mode) {
    const icons = {
      forward: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="7 10 3 14 7 18"/></svg>',
      reverse: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="17 10 21 14 17 18"/></svg>',
      alpha: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><text x="2" y="10" font-size="10" font-family="Arial" font-weight="700" fill="currentColor" stroke="none">A</text><text x="11" y="10" font-size="10" font-family="Arial" font-weight="700" fill="currentColor" stroke="none">Z</text><polyline points="19 18 21 14 19 10 17 14 19 18"/></svg>'
    };
    return icons[mode] || icons.reverse;
  },

  _getSortLabel(mode) {
    const map = { forward: "顺序", reverse: "倒序", alpha: "字母" };
    return map[mode] || "倒序";
  },

  _renderPaneBody(doc, body, item) {
    try { this._hideCardMenu(); } catch (e) {}
    // 使用 HTML 命名空间创建元素（body 是 html:div，doc 是 XUL document）
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
    const txt = (s) => this._createTxt(doc, s);

    // 优先级：onRender 传入的 item.id → body.dataset.paneItemID（_refreshItemPane 显式标记）
    // → body.dataset.itemID（onItemChange 保存）→ #zotero-item-pane 的 data-itemid。
    let itemID = Number(item && item.id);
    if (!Number.isFinite(itemID) || itemID <= 0) {
      try {
        const context = this._currentPaneContext;
        if (context && Number.isFinite(Number(context.itemID)) && Number(context.itemID) > 0) {
          itemID = Number(context.itemID);
        }
      } catch (e) {}
    }
    if (!Number.isFinite(itemID) || itemID <= 0) {
      try {
        const explicit = body && body.dataset && body.dataset.paneItemID;
        if (explicit) itemID = Number(explicit);
      } catch (e) {}
    }
    if (!Number.isFinite(itemID) || itemID <= 0) {
      try {
        const stored = body && body.dataset && body.dataset.itemID;
        if (stored) itemID = Number(stored);
      } catch (e) {}
    }
    if (!Number.isFinite(itemID) || itemID <= 0) {
      try {
        const win = Zotero.getMainWindow();
        const zp = win && win.document && win.document.getElementById && win.document.getElementById("zotero-item-pane");
        const cur = zp && zp.getAttribute && zp.getAttribute("data-itemid");
        if (cur) itemID = Number(cur);
      } catch (e) {}
    }
    if (!Number.isFinite(itemID) || itemID <= 0) {
      this._debugLog("_renderPaneBody skipped: invalid itemID; item=" + (item && item.id) + ", context=" + (this._currentPaneContext && this._currentPaneContext.itemID));
      return false;
    }
    body.replaceChildren();

    const rawWords = this._itemWords.get(itemID) || [];

    // 缓存 panelUID 用于后续刷新
    if (body.dataset.wtPaneUid) {
      this._panelUIDs.set(itemID, {
        paneUID: body.dataset.wtPaneUid,
        refresh: body._wtRefresh,
      });
      this._debugLog(
        "pane mapped: itemID=" + itemID +
        ", uid=" + body.dataset.wtPaneUid +
        ", hasRefresh=" + !!body._wtRefresh
      );
    }

    // 头部采用两行布局：第一行是“图标 + 单词本 + 菜单 + 清空”，第二行是 API 和常用操作。
    const header = el("div", { style: "display:flex;flex-direction:column;gap:5px;margin:0 0 8px;width:100%;padding:0 0 6px;border-bottom:1px solid rgba(0,0,0,0.08);box-sizing:border-box;" });
    const titleRow = el("div", { style: "display:flex;align-items:center;gap:6px;width:100%;min-width:0;min-height:26px;" });
    const controlsRow = el("div", { style: "display:flex;align-items:center;gap:5px;width:100%;min-width:0;min-height:26px;flex-wrap:wrap;" });
    const titleGroup = el("div", { style: "display:flex;align-items:center;gap:6px;flex:1;min-width:0;" });
    const titleActions = el("div", { style: "display:flex;align-items:center;gap:6px;flex-shrink:0;" });

    const wordsFileName = itemID + ".json";
    let wordsFileTip = wordsFileName;
    try {
      const p = Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.getWordsFilePath === "function"
        ? Zotero.WordTranslatorStorage.getWordsFilePath(itemID) : "";
      if (p) wordsFileTip = p;
    } catch (e) {}
    const title = el("strong", {
      title: wordsFileTip,
      style: "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;",
    }, [txt("单词本 " + wordsFileName)]);
    titleGroup.append(title);

    const apiSelect = el("select", { style: "flex:1;min-width:0;font-size:12px;padding:2px 6px;", title: "切换翻译 API", "aria-label": "当前翻译 API" });
    this._fillApiSelect(doc, apiSelect);
    apiSelect.addEventListener("change", () => {
      const idx = parseInt(apiSelect.value, 10);
      this._setActiveApiForItem(itemID, idx);
    });
    controlsRow.append(apiSelect);

    const compactButtonStyle = "width:28px;height:26px;padding:0;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:ButtonText;box-sizing:border-box;flex:0 0 28px;";
    const refreshBtn = el("button", { title: "刷新单词本", "aria-label": "刷新单词本", style: compactButtonStyle }, []);
    refreshBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"23 4 23 10 17 10\"></polyline><polyline points=\"1 20 1 14 7 14\"></polyline><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"></path></svg>";
    refreshBtn.addEventListener("click", () => this._repairWordBookPane(itemID));
    controlsRow.append(refreshBtn);

    const settingsBtn = el("button", { title: "设置", "aria-label": "设置", style: compactButtonStyle }, []);
    settingsBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"3\" y1=\"6\" x2=\"21\" y2=\"6\"></line><line x1=\"3\" y1=\"12\" x2=\"21\" y2=\"12\"></line><line x1=\"3\" y1=\"18\" x2=\"21\" y2=\"18\"></line></svg>";
    settingsBtn.addEventListener("click", () => this._openPreferencesPane());
    titleActions.append(settingsBtn);

    const sortBtn = el("button", { title: this._getSortLabel(this._sortMode), "aria-label": "切换排序方式", style: compactButtonStyle }, []);
    if (this._sortMode === "reverse") {
      sortBtn.textContent = "倒";
    } else if (this._sortMode === "forward") {
      sortBtn.textContent = "正";
    } else { // alpha
      sortBtn.innerHTML = this._getSortIconHTML("alpha");
    }
    sortBtn.addEventListener("click", () => {
      const modes = ["reverse", "forward", "alpha"];
      const current = this._sortMode;
      const idx = modes.indexOf(current);
      const next = modes[(idx + 1) % modes.length];
      this._debugLog("sort click: current=" + current + ", next=" + next);
      if (!this._setSortMode(next)) return;
      // 排序改变后回到第 1 页（保留搜索词），统一走 _applyWordBookView。
      this._applyWordBookView(itemID, { source: "sort", page: 1 });
    });
    controlsRow.append(sortBtn);

    const zoomInBtn = el("button", { title: "放大字体", "aria-label": "放大字体", style: compactButtonStyle }, []);
    zoomInBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><text x=\"6\" y=\"17\" font-size=\"14\" font-family=\"Arial, sans-serif\" font-weight=\"700\" stroke=\"none\" fill=\"currentColor\">A</text><polyline points=\"16,4 19,1 22,4\"></polyline><line x1=\"19\" y1=\"1\" x2=\"19\" y2=\"7\"></line></svg>";
    zoomInBtn.addEventListener("click", () => this._onZoomFontSize(itemID, +1));
    controlsRow.append(zoomInBtn);

    const zoomOutBtn = el("button", { title: "缩小字体", "aria-label": "缩小字体", style: compactButtonStyle }, []);
    zoomOutBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><text x=\"6\" y=\"17\" font-size=\"11\" font-family=\"Arial, sans-serif\" font-weight=\"700\" stroke=\"none\" fill=\"currentColor\">A</text><polyline points=\"16,7 19,10 22,7\"></polyline><line x1=\"19\" y1=\"10\" x2=\"19\" y2=\"4\"></line></svg>";
    zoomOutBtn.addEventListener("click", () => this._onZoomFontSize(itemID, -1));
    controlsRow.append(zoomOutBtn);

    const clearBtn = el("button", { title: "清空当前条目的全部单词", "aria-label": "清空当前条目的全部单词", style: "height:26px;padding:0 9px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:12px;line-height:24px;box-sizing:border-box;white-space:nowrap;color:ButtonText;" }, [txt("清空")]);
    clearBtn.addEventListener("click", () => this._clearAllWordsForItem(itemID));
    titleActions.append(clearBtn);

    titleRow.append(titleGroup, titleActions);

    // 第三行：搜索 + 翻页（新增，不影响上面两行排版）
    const pageSize = Math.max(1, Number(this._data && this._data.pageSize) || 10);
    const view = this._getWordBookViewState(itemID);
    const pageInfo = item && item.viewInfo
      ? item.viewInfo
      : this._computePagedIndices(rawWords, this._sortMode, view.search, view.page, pageSize, this._getActiveSearchStrategyName());
    // 若当前页超出范围则自动收拢到最后一页（例如清空/删除后）
    if (view.page !== pageInfo.page) {
      this._wordBookViewState.set(itemID, { page: pageInfo.page, search: view.search });
      view.page = pageInfo.page;
    }
    const navRow = el("div", { style: "display:flex;align-items:center;gap:6px;width:100%;min-width:0;min-height:26px;margin-top:2px;flex-wrap:wrap;" });
    const searchInput = el("input", {
      type: "search",
      placeholder: "搜索单词或释义…",
      title: "搜索单词或中文释义（同时匹配单词与翻译）",
      style: "flex:1;min-width:0;font-size:12px;padding:3px 8px;border:1px solid ThreeDShadow;border-radius:6px;background:Field;color:FieldText;box-sizing:border-box;",
    });
    searchInput.value = view.search;
    searchInput.addEventListener("input", (ev) => {
      // 中文输入法合成中不触发搜索（拼音→选字过程），合成完成后的 input 事件 isComposing=false 正常触发
      if (ev.isComposing) return;
      this._onWordBookSearchTrigger(itemID, searchInput.value);
    });
    searchInput.addEventListener("compositionend", () => {
      // 兼容：部分浏览器 compositionend 后可能不触发 isComposing=false 的 input
      this._onWordBookSearchTrigger(itemID, searchInput.value);
    });
    navRow.append(searchInput);

    const prevBtn = el("button", { title: "上一页", "aria-label": "上一页", disabled: pageInfo.page <= 1 ? "disabled" : null, style: "height:26px;min-width:28px;padding:0 8px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:13px;line-height:24px;color:ButtonText;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;" }, [txt("‹")]);
    prevBtn.addEventListener("click", () => this._setWordBookPage(itemID, pageInfo.page - 1));
    navRow.append(prevBtn);

    const pageInput = el("input", {
      type: "text",
      inputmode: "numeric",
      pattern: "[0-9]*",
      min: "1",
      max: String(Math.max(1, pageInfo.pageCount)),
      title: "输入页码后按回车或点击“跳”",
      "aria-label": "当前页",
      style: "width:44px;font-size:12px;padding:3px 4px;text-align:center;border:1px solid ThreeDShadow;border-radius:6px;background:Field;color:FieldText;box-sizing:border-box;flex:0 0 auto;",
    });
    pageInput.value = String(pageInfo.page);

    // 页码框只允许输入 ASCII 数字；粘贴或输入中文/英文时立即过滤。
    pageInput.addEventListener("input", () => {
      const digitsOnly = String(pageInput.value || "").replace(/[^0-9]/g, "");
      if (pageInput.value !== digitsOnly) pageInput.value = digitsOnly;
    });

    // Enter 与“跳”按钮共用同一个跳转函数，避免两套逻辑产生差异。
    const jumpToInputPage = () => {
      const raw = parseInt(String(pageInput.value || "").trim(), 10);
      this._debugLog("pagination jump request: itemID=" + itemID + ", input=" + JSON.stringify(pageInput.value) + ", parsed=" + raw);
      if (!Number.isFinite(raw) || raw < 1 || raw > pageInfo.pageCount) {
        pageInput.value = String(pageInfo.page);
        this._debugLog("pagination jump ignored: itemID=" + itemID + ", page=" + raw + ", pageCount=" + pageInfo.pageCount);
        return;
      }
      this._setWordBookPage(itemID, raw);
    };

    pageInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      jumpToInputPage();
    });
    navRow.append(pageInput);

    const jumpBtn = el("button", {
      type: "button",
      title: "跳转到输入的页码",
      "aria-label": "跳转到输入的页码",
      style: "height:26px;padding:0 7px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:12px;line-height:24px;color:ButtonText;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;",
    }, [txt("跳")]);
    jumpBtn.addEventListener("click", () => {
      this._debugLog("pagination jump button click: itemID=" + itemID);
      jumpToInputPage();
    });
    navRow.append(jumpBtn);

    const totalLabel = el("span", { style: "font-size:12px;color:GrayText;white-space:nowrap;flex:0 0 auto;" }, [txt(" / " + pageInfo.pageCount)]);
    navRow.append(totalLabel);

    const nextBtn = el("button", { title: "下一页", "aria-label": "下一页", disabled: pageInfo.page >= pageInfo.pageCount ? "disabled" : null, style: "height:26px;min-width:28px;padding:0 8px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:13px;line-height:24px;color:ButtonText;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;" }, [txt("›")]);
    nextBtn.addEventListener("click", () => this._setWordBookPage(itemID, pageInfo.page + 1));
    navRow.append(nextBtn);

    // 字典行（controlsRow 与 navRow 之间）：字典源下拉 + 合/单/典显示模式按钮
    const dictRow = el("div", { style: "display:flex;align-items:center;gap:6px;width:100%;min-width:0;min-height:26px;margin-top:2px;flex-wrap:wrap;" });
    const dictSourceSelect = el("select", { style: "flex:1;min-width:0;font-size:12px;padding:2px 6px;", title: "切换字典源", "aria-label": "字典源" });
    const dictSources = [
      { v: "auto", l: "自动（离线词库优先，在线源兜底）" },
      { v: "youdao", l: "有道网页词典" },
      { v: "freedict", l: "FreeDictionary" },
      { v: "ecdict", l: "本地离线词典" },
    ];
    const curDictProvider = (this._data && this._data.dictProvider) || "auto";
    for (const s of dictSources) {
      const o = doc.createElementNS(HTML_NS, "option");
      o.value = s.v;
      o.textContent = s.l;
      dictSourceSelect.append(o);
    }
    dictSourceSelect.value = curDictProvider;
    dictSourceSelect.addEventListener("change", () => {
      this._data.dictProvider = dictSourceSelect.value;
      this._saveData();
      this._applyWordBookView(itemID, { source: "dict-source" });
    });
    dictRow.append(dictSourceSelect);

    // P5：字典显示模式切换按钮（合/单/典），全局生效（卡片级 dictMode 优先覆盖）
    const dictModeBtn = el("button", {
      title: "单词字典显示",
      "aria-label": "字典显示模式",
      style: "height:26px;min-width:28px;padding:0 8px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:13px;line-height:24px;color:ButtonText;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;",
    }, [txt(this._dictModeLabel(this._data && this._data.dictDisplayMode || "he"))]);
    dictModeBtn.addEventListener("click", () => {
      const cur = (this._data && this._data.dictDisplayMode) || "he";
      const next = cur === "he" ? "dan" : cur === "dan" ? "dian" : "he"; // 合→单→典→合
      this._data.dictDisplayMode = next;
      this._saveData();
      dictModeBtn.textContent = this._dictModeLabel(next);
      dictModeBtn.title = this._dictModeTooltip(next);
      this._applyWordBookView(itemID, { source: "dict-mode" });
    });
    dictRow.append(dictModeBtn);

    header.append(titleRow, controlsRow, dictRow, navRow);
    body.append(header);

    // 卡片列表
    const list = el("div", { class: "wordtranslator-pane-list", style: "display:flex;flex-direction:column;gap:6px;" });
    const emptyHint = this._getEmptyHint(doc, rawWords, view.search, pageInfo);
    if (emptyHint) {
      list.append(emptyHint);
    } else {
      pageInfo.indices.forEach((origIdx) => {
        const w = rawWords[origIdx];
        list.append(this._renderCard(doc, itemID, origIdx, w));
      });
    }
    body.append(list);

    // CSS 挂在 body 内部；每次重绘刷新，避免升级后仍用旧样式。
    let style = body.querySelector(".wordtranslator-pane-style");
    if (!style) {
      style = doc.createElementNS(HTML_NS, "style");
      style.className = "wordtranslator-pane-style";
      body.append(style);
    }
    style.textContent = this._getPaneCSS();
    // 保存当前 pane 的 doc / body 引用，以便点击放大/缩小按钮后只对卡片文本动态调整
    this._currentPane = { doc: doc, body: body };
    this._currentPaneContext = {
      doc,
      body,
      itemID,
      paneUID: body.dataset && body.dataset.wtPaneUid || null,
    };
    return true;
  },

  _renderCard(doc, itemID, idx, w) {
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
    const txt = (s) => this._createTxt(doc, s);

    const hl = this._normalizeHighlight(w.highlight);
    const card = el("div", {
      class: "wt-card" + (hl ? " wt-card-hl wt-card-hl-" + hl : ""),
      style: "display:flex;align-items:flex-start;gap:6px;padding:6px 8px;",
    });
    const fsVal = Number(this._data && this._data.fontSize) || 13;
    const self = this;
    // 字典缓存与显示模式（P5/P6）
    let entry = null, hasDict = false;
    try {
      const D = Zotero.WordTranslatorDict;
      entry = D && D.getCached && D.getCached(w.word);
      hasDict = !!entry;
    } catch (e) {}
    const transFailed = w.translation === this.STATUS_FAILED;
    // P4：provider 失败（含超时兜底）但有词典 → 用词典内容展示，不受模式开关影响
    const dictFallback = hasDict && transFailed;
    let effMode = "he";
    if (!dictFallback) {
      effMode = (w.dictMode) || (self._data && self._data.dictDisplayMode) || "he";
    }
    // 词典兜底内容：释义按「；」拆义项，首义项提升到行1（作"翻译"），剩余义项留给词典行；
    // 单义项时整段放词典行，行1只显示单词。
    let dfFirst = "", dfPos = "", dfRest = "", dfAll = "";
    if (dictFallback && entry && entry.meanings && entry.meanings[0] && entry.meanings[0].def) {
      const rawDef = String(entry.meanings[0].def);
      dfAll = rawDef;
      const senses = rawDef.split("；").map((s) => String(s).trim()).filter(Boolean);
      dfPos = String((entry.meanings[0].pos) || "");
      if (senses.length) {
        let f = senses[0];
        // ecdict 词性常为空、词性缩写嵌在释义开头（如 "a. 抗病毒的"），剥离到词性位
        const pm = f.match(/^([a-z]+)\.\s*(.*)$/i);
        const posWhitelist = ["n", "v", "adj", "adv", "a", "vt", "vi", "prep", "conj", "pron", "int", "art", "aux", "num", "abbr"];
        if (pm && !dfPos && posWhitelist.indexOf(pm[1].toLowerCase()) >= 0) {
          dfPos = pm[1];
          f = pm[2];
        }
        dfFirst = f;
        dfRest = senses.slice(1).join("；");
      }
    }
    // 文本部分包在一个容器里，只对它应用字号，并且可被选中
    const textWrap = el("div", { class: "wt-card-text", style: "flex:1;min-width:0;font-size:" + fsVal + "px;line-height:1.5;user-select:text;-webkit-user-select:text;cursor:text;" });
    const wordEl = el("span", { class: "wt-card-word", style: "font-weight:600;color:Highlight;word-break:break-word;" }, [txt(w.word)]);
    const arrowEl = el("span", { class: "wt-card-arrow", style: "color:GrayText;flex-shrink:0;margin:0 2px;" }, [txt(" -- ")]);
    const transEl = el("span", { class: "wt-card-trans", style: "word-break:break-word;" + (w.pending ? "color:GrayText;" : "") }, [txt(w.translation)]);
    // 行1 控制：dictFallback 多义项 → [单词 -- 首义项]；单义项 → 只显示单词（整段释义进词典行）
    if (dictFallback) {
      if (dfFirst && dfRest) {
        transEl.textContent = dfFirst;
      } else {
        arrowEl.style.display = "none";
        transEl.style.display = "none";
      }
    } else if (hasDict && effMode === "dian") {
      arrowEl.style.display = "none";
      transEl.style.display = "none";
    }
    textWrap.append(wordEl, arrowEl, transEl);
    // 词典行：dictFallback 或 非"单"模式 时显示
    if (hasDict && (dictFallback || effMode !== "dan")) {
      try {
        const ph = entry.phonetic && (entry.phonetic.us || entry.phonetic.uk);
        const parts = [];
        if (ph) parts.push("[" + String(ph).trim().replace(/^\/+|\/+$/g, "") + "]");
        if (dictFallback) {
          if (dfPos) parts.push(String(dfPos) + ".");
          parts.push(dfRest || dfAll);
        } else {
          const m = entry.meanings && entry.meanings[0];
          if (m && m.pos) parts.push(String(m.pos) + ".");
          if (m && m.def) parts.push(String(m.def));
        }
        if (parts.length) {
          const dictEl = el("div", { class: "wt-card-dict", style: "font-size:" + Math.max(11, fsVal - 2) + "px;color:GrayText;margin-top:2px;word-break:break-word;line-height:1.4;" }, [txt(parts.join(" "))]);
          textWrap.append(dictEl);
        }
      } catch (e) {}
    }
    const actionWrap = el("div", { style: "display:flex;align-items:center;gap:2px;flex-shrink:0;" });
    // 发音按钮（P2：ttsEnabled 关闭时隐藏）
    const ttsEnabled = this._data && this._data.ttsEnabled !== false;
    if (ttsEnabled) {
      const speakBtn = el("button", { title: "朗读", "aria-label": "朗读", style: "flex-shrink:0;border:none;background:transparent;color:GrayText;cursor:pointer;font-size:15px;padding:2px 4px;border-radius:4px;line-height:1;" }, [txt("🔊")]);
      speakBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // 🔊 注册表分派：每次点击现读引擎、现解析源（P3 三选一，不做自动降级）
        self._speakWord(w.word, doc);
      });
      actionWrap.append(speakBtn);
    }
    const retryBtn = el("button", { title: "重新翻译", "aria-label": "重新翻译", style: "flex-shrink:0;border:none;background:transparent;color:GrayText;cursor:pointer;font-size:16px;padding:2px 5px;border-radius:4px;line-height:1;" }, [txt("↻")]);
    retryBtn.addEventListener("click", () => this._retryTranslationForCard(itemID, idx, w));
    const delBtn = el("button", { title: "删除", "aria-label": "删除", style: "flex-shrink:0;border:none;background:transparent;color:GrayText;cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;" }, [txt("✕")]);
    delBtn.addEventListener("click", () => this._deleteWordForItem(itemID, idx));
    actionWrap.append(retryBtn, delBtn);
    card.append(textWrap, actionWrap);
    card.addEventListener("dblclick", (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest("button")) return;
      ev.preventDefault();
      try {
        const sel = doc.defaultView && doc.defaultView.getSelection && doc.defaultView.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      } catch (e) {}
      this._toggleCardHighlight(itemID, idx);
    });
    card.addEventListener("contextmenu", (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest("button")) return;
      ev.preventDefault();
      this._showCardMenu(ev, itemID, idx, w);
    });
    return card;
  },

  _fillApiSelect(doc, select) {
    select.replaceChildren();
    const apis = (this._data && this._data.apis) || [];
    if (apis.length === 0) {
      const opt = doc.createElementNS("http://www.w3.org/1999/xhtml", "option");
      opt.value = "-1";
      opt.textContent = "未配置 API";
      select.append(opt);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    apis.forEach((api, i) => {
      const opt = doc.createElementNS("http://www.w3.org/1999/xhtml", "option");
      opt.value = String(i);
      opt.textContent = (api.name || "API " + (i + 1)) + (api.model ? "（" + api.model + "）" : "");
      select.append(opt);
    });
    const cur = (this._data && this._data.activeApiIndex) || 0;
    select.value = String(Math.min(cur, apis.length - 1));
  },

  _getPaneCSS() {
    return [
      ".wordtranslator-pane-body { color-scheme: light dark; position: relative; }",
      ".wordtranslator-pane-body button:hover { background: color-mix(in srgb, Canvas 92%, CanvasText); }",
      ".wordtranslator-pane-body select { color: FieldText; background: Field; }",
      ".wt-card { position:relative; overflow:visible; background:Canvas; border:1px solid ThreeDShadow; border-radius:8px; }",
      ".wt-card-text { user-select: text; -webkit-user-select: text; cursor: text; }",
      ".wt-card-hl { border-left-width: 3px; border-left-style: solid; }",
      ".wt-card-hl-amber { background: color-mix(in srgb, #c4a35a 16%, Canvas); border-left-color: color-mix(in srgb, #c4a35a 70%, CanvasText); }",
      ".wt-card-hl-sage { background: color-mix(in srgb, #6f8f72 16%, Canvas); border-left-color: color-mix(in srgb, #6f8f72 70%, CanvasText); }",
      ".wt-card-hl-blue { background: color-mix(in srgb, #6d86a8 16%, Canvas); border-left-color: color-mix(in srgb, #6d86a8 70%, CanvasText); }",
      ".wt-card-hl-rose { background: color-mix(in srgb, #b07a86 16%, Canvas); border-left-color: color-mix(in srgb, #b07a86 70%, CanvasText); }",
      ".wt-card-menu { position:absolute; z-index:9999; display:flex; align-items:center; gap:6px; padding:4px 6px; border:1px solid ThreeDShadow; border-radius:8px; background:Canvas; color:CanvasText; box-shadow:0 8px 24px color-mix(in srgb, CanvasText 18%, transparent); }",
      ".wt-card-menu-btn { width:22px; height:22px; padding:0; border:none; background:transparent; color:GrayText; cursor:pointer; font-size:14px; line-height:22px; border-radius:4px; }",
      ".wt-card-menu-btn:hover { background: color-mix(in srgb, Canvas 88%, CanvasText); color:CanvasText; }",
      ".wt-hl-swatch { width:16px; height:16px; padding:0; border:1px solid ThreeDShadow; border-radius:50%; cursor:pointer; box-sizing:border-box; }",
      ".wt-hl-swatch.is-active { outline:2px solid Highlight; outline-offset:1px; }",
      ".wt-dict-mode-btn { font-size:12px; font-weight:600; width:24px; }",
      ".wt-dict-mode-btn.is-active { outline:2px solid Highlight; outline-offset:-1px; background:color-mix(in srgb, Highlight 15%, transparent); }",
      ".wt-hl-swatch-amber { background: color-mix(in srgb, #c4a35a 70%, Canvas); }",
      ".wt-hl-swatch-sage { background: color-mix(in srgb, #6f8f72 70%, Canvas); }",
      ".wt-hl-swatch-blue { background: color-mix(in srgb, #6d86a8 70%, Canvas); }",
      ".wt-hl-swatch-rose { background: color-mix(in srgb, #b07a86 70%, Canvas); }",
    ].join(" ");
  },

  // ---------- 偏好面板 onload ----------
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

  // ---- 单词本紓存与读取（跨插件升级/重启）----
  // ---- 单词本存储与读取（存于 profile/wordtranslator/words/ 下，按条目分文件）---
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

  _clearAllWordsStore() {
    try {
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.flushAll === "function") {
        Zotero.WordTranslatorStorage.flushAll();
      }
      for (const itemID of Array.from(this._itemWords.keys())) {
        try {
          if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.saveWordsForItem === "function") {
            Zotero.WordTranslatorStorage.saveWordsForItem(itemID, []);
          }
        } catch (e) {}
      }
    } catch (e) {}
    try { Zotero.Prefs.clear && Zotero.Prefs.clear(this._wordsPrefKey, true); } catch (e) {}
    this._itemWords = new Map();
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
    ["deeplx", "_translateDeepLX"],
    ["deeplx-selfhosted", "_translateDeepLXSelfhosted"],
    ["youdaozhiyun", "_translateYoudaoZhiyun"],
    ["tencent", "_translateTencent"],
    ["aliyun", "_translateAliyun"],
    ["volcengine", "_translateVolcengine"],
    ["xfyun", "_translateXfyun"],
  ]),

  _googleTranslateRL(value, operations) {
    for (let i = 0; i < operations.length - 2; i += 3) {
      let shift = operations.charAt(i + 2);
      shift = shift >= "a" ? shift.charCodeAt(0) - 87 : Number(shift);
      const shifted = operations.charAt(i + 1) === "+" ? value >>> shift : value << shift;
      value = operations.charAt(i) === "+" ? (value + shifted) & 0xFFFFFFFF : value ^ shifted;
    }
    return value;
  },

  _getGoogleTranslateToken(text) {
    let value = 406644;
    const seed = 3293161072;
    const bytes = new TextEncoder().encode(String(text || ""));
    for (const byte of bytes) {
      value += byte;
      value = this._googleTranslateRL(value, "+-a^+6");
    }
    value = this._googleTranslateRL(value, "+-3^+b+-f");
    value ^= seed;
    if (value < 0) value = (value & 0x7FFFFFFF) + 0x80000000;
    value %= 1000000;
    return value + "." + (value ^ 406644);
  },

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

  async _translateDeepLX(text, api) {
    const source = String(text || "").trim();
    if (!source) throw new Error("DeepL 免费翻译文本为空");
    const id = 1000 * (Math.floor(Math.random() * 99999) + 8300000) + 1;
    const iCount = (source.match(/i/g) || []).length + 1;
    const ts = Date.now();
    const timestamp = ts - (ts % iCount) + iCount;
    let reqBody = JSON.stringify({
      jsonrpc: "2.0",
      method: "LMT_handle_texts",
      id,
      params: {
        texts: [{ text: source, requestAlternatives: 3 }],
        splitting: "newlines",
        lang: { source_lang_user_selected: "EN", target_lang: "ZH" },
        timestamp,
        commonJobParams: { wasSpoken: false, transcribe_as: "" }
      }
    });
    if ((id + 5) % 29 === 0 || (id + 3) % 13 === 0) {
      reqBody = reqBody.replace('"method":"', '"method" : "');
    } else {
      reqBody = reqBody.replace('"method":"', '"method": "');
    }
    const endpoint = (api.baseUrl || "https://www2.deepl.com/jsonrpc").trim().replace(/\/+$/, "");
    const url = endpoint + "?client=chrome-extension,1.28.0&method=LMT_handle_jobs";
    this._debugLog("DeepLX request URL: " + endpoint + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("POST", url, {
      headers: {
        "Accept": "*/*",
        "Authorization": "None",
        "Cache-Control": "no-cache",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh-TW;q=0.7,zh-HK;q=0.6,zh;q=0.5",
        "Content-Type": "application/json",
        "DNT": "1",
        "Origin": "chrome-extension://cofdbpoegempjloogbagkncekinflcnj",
        "Pragma": "no-cache",
        "Priority": "u=1, i",
        "Referer": "https://www.deepl.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "none",
        "Sec-GPC": "1",
        "User-Agent": "DeepLBrowserExtension/1.28.0 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
      },
      body: reqBody,
      responseType: "json",
    });
    const data = this._parseJsonResponse(resp, "DeepL 免费翻译");
    if (resp.status < 200 || resp.status >= 300) {
      const detail = data && data.error && (data.error.message || data.error.code) || resp.statusText || "";
      throw new Error("DeepL 免费翻译错误(" + resp.status + "): " + detail);
    }
    const translation = data && data.result && data.result.texts && data.result.texts[0] && data.result.texts[0].text;
    if (!translation) throw new Error("DeepL 免费翻译返回中没有 result.texts[0].text：" + JSON.stringify(data).slice(0, 500));
    return String(translation).trim();
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

  async _translateClaude(text, api) {
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
    const parts = this._buildPromptParts(source);
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
    const query = [
      "client=gtx",
      "sl=en",
      "tl=zh",
      "dt=t",
      "q=" + encodeURIComponent(source),
      "tk=" + encodeURIComponent(this._getGoogleTranslateToken(source)),
    ].join("&");
    const url = endpoint + "?" + query;
    this._debugLog("Google request URL: " + endpoint + " | textLength=" + source.length);
    const resp = await Zotero.HTTP.request("GET", url, { responseType: "json" });
    let responseData = resp.response;
    if (typeof responseData === "string") {
      try { responseData = JSON.parse(responseData); }
      catch (e) { throw new Error("Google 翻译返回的不是有效 JSON：" + responseData.slice(0, 200)); }
    }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && responseData.error && (responseData.error.message || responseData.error) || resp.statusText || "";
      throw new Error("Google 翻译错误(" + resp.status + "): " + detail);
    }
    const segments = responseData && responseData[0];
    const translation = Array.isArray(segments)
      ? segments.map(function (segment) { return segment && segment[0] || ""; }).join("").trim()
      : "";
    if (!translation) throw new Error("Google 翻译返回中没有 [0][].0：" + JSON.stringify(responseData).slice(0, 500));
    return translation;
  },

  // 提示词构造单一来源：OpenAI 兼容路径与 Claude 适配器共用。
  // split 模式 → { system, user }；combined 模式 → { system: "", user: 全局模板 }。
  // {{word}} 替换为待翻译文本。
  _buildPromptParts(text) {
    const D = WordTranslatorConfig.DEFAULTS;
    const promptMode = (this._data && this._data.promptMode) || "split";
    if (promptMode === "combined") {
      const globalTemplate = (this._data && this._data.promptGlobal) || D.promptGlobal;
      return { system: "", user: String(globalTemplate || "").split("{{word}}").join(text) };
    }
    const system = (this._data && this._data.promptSystem) || D.promptSystem;
    const userTemplate = (this._data && this._data.promptUser) || D.promptUser;
    return { system: String(system || ""), user: String(userTemplate || "").split("{{word}}").join(text) };
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

  async translate(text, apiOverride, onChunk) {
    const api = apiOverride || this.getActiveApi();
    if (!api) throw new Error("未配置 API（请到设置->单词翻译 中添加 API）");
    const provider = api.provider || (api.type === "deepseek" ? "deepseek" : "openai");
    const adapterMethod = this._translateAdapters.get(provider);
    if (adapterMethod && typeof this[adapterMethod] === "function") {
      // 非流式适配器（Google/DeepL 等）一次性返回；若传入 onChunk 则返回后回调一次完整结果
      const result = await this[adapterMethod](text, api);
      if (typeof onChunk === "function" && result) {
        try { onChunk(String(result)); } catch (e) {}
      }
      return result;
    }
    const parts = this._buildPromptParts(text);
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

if (typeof Zotero !== "undefined") {
  Zotero.WordTranslator = WordTranslator;
}
