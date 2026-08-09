"use strict";

// Word Translator for Zotero 核心模块（适配 Zotero 7/8/9/10）
// 依赖：Zotero.Prefs（Zotero 7+ 标准偏好）
// 功能：
//   1. PDF 阅读器划词菜单注入"添加单词并翻译"按钮（带 SVG 图标）
//   2. 调 OpenAI/DeepSeek 兼容接口翻译专业英文单词
//   3. 在右侧 Item Pane 面板以卡片形式展示 [单词 -- 译文]，可逐条删除
//   4. Item Pane 头部下拉切换当前 API；多 API 配置在偏好面板完成

var WordTranslator = {
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
  _itemWords: new Map(),      // itemID -> [{word, translation, pending}]
  _sortMode: "reverse", // 排序模式：forward | reverse | alpha
  _panelUIDs: new Map(),      // itemID -> { paneUID, refresh }
  _paneKey: null,
  _prefWindowLoaded: false,
  _paneRefresh: null,
  _hotkeyPressed: null,
  _hotkeyJustReleased: null,
  _hotkeyModifiers: null,
  _selectionFirstPending: null,
  _selectionHotkeyPending: null,
  _hotkeyGlobalBound: false,
  _addWordHotkeyFired: false,
  _hotkeyBoundWindows: null,
  _currentPane: null,
  _currentPaneContext: null,
  _tempEditState: null,
  _tempEditBound: false,
  _tempEditCloseHandler: null,
  _lastSelectionPopup: null,

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
    this._debugWriteToFile(msg);
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
      // 回退：nsIExternalProtocolService
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

  _onConfigChange() {
    try {
      this._configVersion++;
      this._debugLog("_onConfigChange: version=" + this._configVersion);
      // ???? Item Pane ???? custom sections??????? section?
      if (Zotero && Zotero.Notifier && typeof Zotero.Notifier.trigger === "function") {
        Zotero.Notifier.trigger("refresh", "itempane", []).catch(function (e) { try { Zotero.debug("[WordTranslator] notifier trigger ERROR: " + (e && (e.message || e))); } catch (e2) {} });
      }
      // ?????????? refresh ??
      if (this._paneRefresh && typeof this._paneRefresh === "function") {
        try { this._paneRefresh(); } catch (e) { this._debugLog("paneRefresh notify ERROR: " + (e && e.message || e)); }
      }
    } catch (e) {
      this._debugLog("_onConfigChange ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },



  shutdown(reason) {
    try {
      // 无论原因，关闭/升级/禁用时都立即写盘，避免防抖定时器未触发导致数据丢失
      try { this._flushAndPersistWords(); } catch (e2) {}
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
      if (!this._buildTime) this._buildTime = new Date().toISOString();
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
      await this.loadDataFromDisk();
      this._loadWordsFromDisk();
      this._sortMode = this._data.sortMode || "reverse";
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
        image: rootURI + "content/icons/favicon.png",
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

  _bindGlobalHotkeyListener() {
    try {
      if (this._hotkeyGlobalBound) return;
      const win = Zotero.getMainWindow();
      const target = win && (win.document || win);
      if (!target) return;
      this._hotkeyGlobalBound = true;
      this._bindHotkeyResetListener(target);
      const self = this;
      // —— 键盘：划词快捷键（预设或自定义）——
      target.addEventListener("keydown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._selectionHotkeyActive()) return;
          let matched = false;
          if (self._customHotkeyActive()) {
            matched = self._matchCustomHotkeyKey(ev, d.customHotkey);
          } else {
            matched = self._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now() });
          }
          if (!matched) return;
          // 已有有效选区时，划词快捷键不建立会话，让“先选区后按绑定键”接管
          if (self._addWordHotkeyActive() && self._matchSelectionFirstKey(ev) && self._getSelectionFirstPending()) {
            self._debugLog("selection hotkey skipped (global): existing selection belongs to addWord hotkey");
            return;
          }
          self._hotkeyPressed = { mod: d.customHotkeyEnabled ? d.customHotkey : (d.hotkeyModifier || "ctrl"), time: Date.now() };
          self._hotkeyJustReleased = null;
          self._debugLog("hotkey pressed (global): mod=" + JSON.stringify(self._hotkeyPressed));
        } catch (e) {}
      }, true);
      target.addEventListener("keyup", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._selectionHotkeyActive()) return;
          const pressed = self._hotkeyPressed;
          if (!pressed || !pressed.mod) return;
          if (Date.now() - (pressed.time || 0) > 30000) return;
          if (!self._isSelectionHotkeyKeyUp(ev)) return;
          const releasedMod = pressed.mod;
          // 必须先清除按下状态，避免残留导致后续误触发
          self._clearSelectionHotkeyState("keyup");
          self._hotkeyJustReleased = { mod: releasedMod, time: Date.now() };
          const pending = self._selectionHotkeyPending || self._selectionFirstPending;
          if (!pending || !pending.text) {
            self._debugLog("hotkey released (global) without selection: mod=" + releasedMod);
            return;
          }
          self._debugLog("hotkey released (global): mod=" + releasedMod + ", word=" + JSON.stringify(pending.text));
          self._triggerHotkeyTranslate(pending);
        } catch (e) {}
      }, true);
      // —— 鼠标：划词快捷键（侧键等） + “添加单词”快捷键 ——
      target.addEventListener("mousedown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d) return;
          // 1) 划词快捷键：鼠标侧键作为“按住”的划词快捷键
          if (self._selectionHotkeyActive() && self._customHotkeyActive()) {
            const mouseSide = self._matchCustomHotkeyMouse(ev, d.customHotkey);
            if (mouseSide) {
              self._hotkeyPressed = { mod: d.customHotkey, time: Date.now() };
              self._hotkeyJustReleased = null;
              self._hotkeyModifiers = { ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now(), mouseSide: true };
              self._debugLog("hotkey mousedown (global, side): mod=" + d.customHotkey);
              return;
            }
            // 自定义键盘组合键：按住修饰键 + 划词
            const p = self._parseHotkeySpec(d.customHotkey);
            if (p && !p.mouse && self._matchCustomHotkeyMods(p, { ctrl: !!ev.ctrlKey, alt: !!ev.altKey, shift: !!ev.shiftKey })) {
              self._hotkeyModifiers = { ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now(), mouseSide: false };
              self._debugLog("hotkey mousedown (global, custom key mods): mod=" + d.customHotkey);
              return;
            }
          }
          // 2) 预设组合键的 mousedown 记录
          if (self._selectionHotkeyActive() && !self._customHotkeyActive() && self._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, mouse: ev.button, time: Date.now() })) {
            self._hotkeyModifiers = { ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, mouse: ev.button, time: Date.now() };
            self._debugLog("hotkey mousedown (global): mods=" + JSON.stringify(self._hotkeyModifiers));
            return;
          }
        } catch (e) {}
      }, true);
      // —— 键盘：“先选区后按绑定键” ——
      target.addEventListener("keydown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._addWordHotkeyActive()) return;
          if (self._matchSelectionFirstKey(ev)) {
            self._fireAddWordHotkey();
          }
        } catch (e) {}
      }, true);
      this._debugLog("global hotkey listener bound");
    } catch (e) {
      this._debugLog("_bindGlobalHotkeyListener ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // 触发“添加单词并翻译”快捷键：用当前缓存的选中文本
  _triggerHotkeyTranslate(pending) {
    try {
      if (!pending || !pending.reader || !pending.text) return;
      const popup = this._lastSelectionPopup;
      if (popup && popup.reader === pending.reader && popup.button && popup.button.isConnected && popup.doc) {
        this._showTempEditArea(popup.doc, popup.button, pending.reader, pending.text, "");
      }
    } catch (e) {
      this._debugLog("_triggerHotkeyTranslate temp edit ERROR: " + (e && (e.message || String(e))));
    }
    this._addWordForReader(pending.reader, pending.text).catch((err) => {
      this._debugLog("hotkey translate ERROR: " + (err && (err.stack || err.message || String(err))));
    });
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
        this._bindHotkeyModifierListener(reader._iframeWindow);
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
        this._bindHotkeyModifierListener(win);
        return;
      }
      if (attempt < 100) {
        const self = this;
        setTimeout(function () { self._waitForHotkeyWindow(reader, attempt + 1); }, 100);
      } else {
        this._debugLog("hotkey wait timeout: tabID=" + (reader && reader.tabID));
      }
    } catch (e) {
      this._debugLog("_waitForHotkeyWindow ERROR: " + (e && (e.message || String(e))));
    }
  },

  _bindHotkeyResetListener(win) {
    try {
      if (!win) return;
      if (win.__wordTranslatorHotkeyResetBound) return;
      win.__wordTranslatorHotkeyResetBound = true;
      const self = this;
      const clear = () => {
        self._clearSelectionHotkeyState("window blur");
      };
      win.addEventListener("blur", clear, true);
      win.addEventListener("pagehide", clear, true);
    } catch (e) {}
  },

  _bindHotkeyModifierListener(win) {
    try {
      if (!win) return;
      if (this._hotkeyBoundWindows && this._hotkeyBoundWindows.has(win)) return;
      if (!this._hotkeyBoundWindows) this._hotkeyBoundWindows = new Set();
      this._hotkeyBoundWindows.add(win);
      this._bindHotkeyResetListener(win);
      const self = this;
      // 记录修饰键状态（mousedown 先于 mouseup/popup 发生，对应“按住快捷键 + 双击/划词”路径）
      win.addEventListener("mousedown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._selectionHotkeyActive()) return;
          let matched = false;
          let mouseSide = !!(ev.button === 3 || ev.button === 4 || ev.button === 5);
          if (self._customHotkeyActive()) {
            // 自定义快捷键：
            //  - 鼠标侧键：直接匹配 button
            //  - 键盘组合键：只需当前按住的修饰键与 spec 一致（如按住 Alt + 划词），
            //    不要求 mousedown 事件携带 key（mousedown 没有 key 属性）
            if (mouseSide) {
              matched = self._matchCustomHotkeyMouse(ev, d.customHotkey);
            } else {
              const p = self._parseHotkeySpec(d.customHotkey);
              if (p && !p.mouse) {
                matched = self._matchCustomHotkeyMods(p, {
                  ctrl: !!ev.ctrlKey,
                  alt: !!ev.altKey,
                  shift: !!ev.shiftKey,
                });
              }
            }
          } else {
            matched = self._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, mouse: ev.button, time: Date.now() });
          }
          if (!matched) return;
          self._hotkeyModifiers = { ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, mouse: ev.button, time: Date.now(), mouseSide: mouseSide };
          self._debugLog("hotkey mousedown: mods=" + JSON.stringify(self._hotkeyModifiers));
        } catch (e) {}
      }, true);
      // 按下组合键：记录“快捷键按下”状态。
      // 修饰键本体（Control/Alt）按下也记录，保证“按住修饰键 + 纯鼠标划词”流程可用。
      win.addEventListener("keydown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._selectionHotkeyActive()) return;
          let matched = false;
          if (self._customHotkeyActive()) {
            matched = self._matchCustomHotkeyKey(ev, d.customHotkey);
          } else {
            matched = self._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now() });
          }
          if (!matched) return;
          // 已有有效选区时，划词快捷键不建立会话，让“先选区后按绑定键”接管
          if (self._addWordHotkeyActive() && self._matchSelectionFirstKey(ev) && self._getSelectionFirstPending()) {
            self._debugLog("selection hotkey skipped: existing selection belongs to addWord hotkey");
            return;
          }
          self._hotkeyPressed = { mod: d.customHotkeyEnabled ? d.customHotkey : (d.hotkeyModifier || "ctrl"), time: Date.now() };
          self._hotkeyJustReleased = null;
          self._debugLog("hotkey pressed: mod=" + JSON.stringify(self._hotkeyPressed));
        } catch (e) {}
      }, true);
      // 松开组合键：若整个按下期间有选中文本，触发翻译。
      // 注意：松开修饰键本体（Control/Alt）的 keyup 就是触发点，不能过滤。
      win.addEventListener("keyup", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._selectionHotkeyActive()) return;
          const pressed = self._hotkeyPressed;
          if (!pressed || !pressed.mod) return;
          if (Date.now() - (pressed.time || 0) > 30000) return;
          if (!self._isSelectionHotkeyKeyUp(ev)) return;
          const releasedMod = pressed.mod;
          // 必须先清除按下状态，避免残留导致后续误触发
          self._clearSelectionHotkeyState("keyup");
          self._hotkeyJustReleased = { mod: releasedMod, time: Date.now() };
          const pending = self._selectionHotkeyPending || self._selectionFirstPending;
          if (!pending || !pending.text) {
            self._debugLog("hotkey released without selection: mod=" + releasedMod);
            return;
          }
          self._debugLog("hotkey released: mod=" + releasedMod + ", word=" + JSON.stringify(pending.text));
          self._triggerHotkeyTranslate(pending);
        } catch (e) {}
      }, true);
      // “先选区后按绑定键”：iframe 内的键盘事件（keydown 触发，无需等待 keyup）
      win.addEventListener("keydown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._addWordHotkeyActive()) return;
          if (self._matchSelectionFirstKey(ev)) {
            self._fireAddWordHotkey();
          }
        } catch (e) {}
      }, true);
      this._debugLog("hotkey bound to iframe window");
    } catch (e) {
      this._debugLog("_bindHotkeyModifierListener ERROR: " + (e && (e.message || String(e))));
    }
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
    if (text.length > 500) {
      this._debugLog("popup skip: text too long (" + text.length + ")");
      return;
    }

    // 快捷键-划词翻译：缓存当前选中文本。
    // 鼠标/按键事件实际发生在 PDF.js 的 iframe window，popup 出现时绑定一次。
    try {
      const hotkeyWin = this._getHotkeyTargetWindow(reader);
      if (hotkeyWin) this._bindHotkeyModifierListener(hotkeyWin);
    } catch (e) {
      this._debugLog("hotkey bind ERROR: " + (e && (e.stack || e.message || String(e))));
    }
    // 缓存当前选中文本（供 keyup 路径使用）
    try {
      this._selectionFirstPending = { reader: reader, text: text, time: Date.now() };
      if (this._inSelectionHotkeySession() || this._hotkeyModifiers) {
        this._selectionHotkeyPending = { reader: reader, text: text, time: Date.now() };
      }
      this._debugLog("selection pending cached: word=" + JSON.stringify(text.slice(0, 80)) +
        ", session=" + this._inSelectionHotkeySession());
    } catch (e) {}
    // 自动翻译：开启后选中文本即自动加入单词本并翻译（不显示按钮）
    if (this._data.autoTranslate) {
      // 防抖去重：相同文本 2 秒内不重复自动添加
      const now = Date.now();
      if (this._lastAutoWord === text && now - (this._lastAutoTime || 0) < 2000) {
        return;
      }
      this._lastAutoWord = text;
      this._lastAutoTime = now;
      this._debugLog("autoTranslate: word=" + JSON.stringify(text) + ", reader.itemID=" + (reader && reader.itemID));
      this._addWordForReader(reader, text).catch((err) => {
        this._debugLog("autoTranslate promise ERROR: " + (err && (err.stack || err.message || String(err))));
      });
      return;
    }
    // 快捷键-划词翻译：三条路径
    if (this._selectionHotkeyActive()) {
      // 已有有效选区且“先选区后按绑定键”开启时，让该功能接管；
      // 划词快捷键仅在本次划词没有已有选区缓存时触发（避免与选区+按键冲突）
      const hasSelectionFirstPending = !!(this._data.addWordHotkeyEnabled && this._getSelectionFirstPending());
      if (!hasSelectionFirstPending) {
        // 路径 A：mousedown 时已匹配（按住快捷键 + 划词），popup 出现立即触发
        if (this._customHotkeyActive()) {
          if (this._hotkeyModifiers) {
            const fresh = Date.now() - (this._hotkeyModifiers.time || 0) < 5000;
            if (fresh && this._hotkeyModifiers.mouseSide) {
              this._debugLog("hotkey translate (mouse side): mod=" + (this._data.customHotkey) + ", word=" + JSON.stringify(text));
              this._triggerHotkeyTranslate({ reader: reader, text: text, time: Date.now() });
              return;
            }
            if (fresh && !this._hotkeyModifiers.mouseSide && this._customHotkeyActive()) {
              const p = this._parseHotkeySpec(this._data.customHotkey);
              if (p && !p.mouse && this._matchCustomHotkeyMods(p, this._hotkeyModifiers)) {
                this._debugLog("hotkey translate (custom key): mod=" + (this._data.customHotkey) + ", word=" + JSON.stringify(text));
                this._triggerHotkeyTranslate({ reader: reader, text: text, time: Date.now() });
                return;
              }
            }
          }
        } else if (this._hotkeyMatches(this._hotkeyModifiers)) {
          this._debugLog("hotkey translate (mousedown): mod=" + (this._data.hotkeyModifier || "ctrl") + ", word=" + JSON.stringify(text));
          this._triggerHotkeyTranslate({ reader: reader, text: text, time: Date.now() });
          return;
        }
        // 路径 B：快捷键正按住且已产生选中文本（按下→划词→popup），立即触发
        if (this._hotkeyPressed && this._hotkeyPressed.mod) {
          this._debugLog("hotkey held; translating selected text immediately");
          this._triggerHotkeyTranslate({ reader: reader, text: text, time: Date.now() });
          return;
        }
        // 路径 C：keyup 已触发过（兜底防止 keyup 未收到）
        const released = this._hotkeyJustReleased;
        if (released && released.mod && Date.now() - (released.time || 0) < 2000) {
          this._hotkeyJustReleased = null;
          this._debugLog("hotkey translate (release fallback): mod=" + released.mod + ", word=" + JSON.stringify(text));
          this._triggerHotkeyTranslate({ reader: reader, text: text, time: Date.now() });
          return;
        }
      }
    }
    const label = this._data.contextMenuLabel || "添加单词并翻译";
    const existingButton = doc.querySelector(".wordtranslator-add-btn");
    if (existingButton) {
      existingButton.innerHTML = this._getAddWordButtonHTML(label);
      this._lastSelectionPopup = { doc, reader, button: existingButton, text, time: Date.now() };
      return;
    }

    // PDF 划词弹窗使用与 Item Pane 完全一致的 icon1.4.png；
    // 用 img 元素而不是旧的内联 SVG，避免与其他翻译插件图标混淆。
    const btn = this._createAddWordButton(doc, reader, text, this._getAddWordButtonHTML(label));
    append(btn);
    this._lastSelectionPopup = { doc, reader, button: btn, text, time: Date.now() };
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

        // 按钮原地变成可编辑文本框（显示译文，右下角可缩放）
        try {
          this._showTempEditArea(doc, btn, reader, text, "");
        } catch (e2) {
          this._debugLog("showTempEditArea ERROR: " + (e2 && (e2.stack || e2.message || String(e2))));
        }

        this._addWordForReader(reader, text).catch((err) => {
          this._debugLog(
            "addWord promise ERROR: " +
            (err && (err.stack || err.message || String(err)))
          );
        });
      } catch (err) {
        this._debugLog("btn click ERROR: " + (err && (err.stack || err.message || String(err))));
      }
    }, true);
    return btn;
  },

  _formatTempEditText(word, translation) {
    const w = String(word || "").trim();
    const t = String(translation || "").trim() || "正在翻译…";
    return w ? w + " -- " + t : t;
  },

  _getAddWordButtonHTML(label) {
    const text = String(label || "添加单词并翻译");
    const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // 方案 A：使用内联 SVG 图标，不依赖 chrome:// 外部资源加载。
    // PDF 划词弹窗运行在 PDF.js iframe 沙箱中，无法加载 chrome:// 图片，
    // 因此改用与参考插件(zotero-pdf-translate)一致的内联 SVG 方式，确保稳定显示。
    const iconSVG = '<svg class="wordtranslator-add-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle;flex:0 0 16px;" aria-hidden="true"><rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#2a5fdb"/><text x="8" y="8" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#ffffff">word</text><text x="8" y="13" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="3.5" fill="#ffffff">翻译</text></svg>';
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
      textarea.placeholder = "正在翻译…";
      textarea.setAttribute("data-tabstop", "1");
      textarea.style.resize = "both";
      textarea.style.height = "1.2em";
      textarea.style.minHeight = "1.2em";
      textarea.style.width = "90%";
      textarea.style.margin = "4px 0";
      textarea.style.fontSize = "inherit";
      textarea.style.overflow = "auto";
      btn.replaceWith(textarea);
      this._tempEditState = {
        doc: doc,
        btn: btn,
        textarea: textarea,
        reader: reader || null,
        text: String(text || "").trim(),
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

  // 翻译完成后更新临时编辑框内容
  _updateTempEditArea(word, translation) {
    const st = this._tempEditState;
    if (!st || !st.textarea || !st.textarea.isConnected) return;
    try {
      const cur = String(st.text || "").trim().toLowerCase();
      const tgt = String(word || "").trim().toLowerCase();
      if (!cur || cur !== tgt) return;
      st.textarea.value = this._formatTempEditText(st.text, translation);
      st.textarea.placeholder = translation ? "" : "正在翻译…";
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
  },  // 解析自定义快捷键 spec，如 "ctrl+d"、"alt+1"、"ctrl"、"mouse1"~"mouse5"、"xbutton1/2"
  _parseHotkeySpec(spec) {
    try {
      if (!spec) return null;
      const parts = String(spec).toLowerCase().split("+").map(function (x) { return x.trim(); }).filter(Boolean);
      if (!parts.length) return null;
      const last = parts[parts.length - 1];
      // 纯修饰键（如 "ctrl"、"alt"、"shift"）：用于“先选区后按绑定键”
      if (parts.length === 1) {
        if (last === "ctrl" || last === "control") return { key: "ctrl" };
        if (last === "alt") return { key: "alt" };
        if (last === "shift") return { key: "shift" };
      }
      // 鼠标按键：mouse1=左(0) mouse2=右(2) mouse3=中(1) mouse4=侧键1(3) mouse5=侧键2(4)
      if (last === "mouse1" || last === "left") return { mouse: 0 };
      if (last === "mouse2" || last === "right") return { mouse: 2 };
      if (last === "mouse3" || last === "middle") return { mouse: 1 };
      if (last === "mouse4" || last === "xbutton1" || last === "side") return { mouse: 3 };
      if (last === "mouse5" || last === "xbutton2") return { mouse: 4 };
      // 兼容历史记录：以前侧键被记录为 button=4/5，需同步识别
      if (last === "mouse4old") return { mouse: 4 };
      if (last === "mouse5old") return { mouse: 4 };
      return {
        ctrl: parts.indexOf("ctrl") >= 0,
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
      if (!p) return false;
      if (p.mouse) return false;
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

  // 匹配鼠标事件（mousedown，侧键 button=4/5）与自定义快捷键 spec
  _matchCustomHotkeyMouse(ev, spec) {
    try {
      const p = this._parseHotkeySpec(spec);
      if (!p || !p.mouse) return false;
      return ev.button === p.mouse;
    } catch (e) {
      return false;
    }
  },

  // 匹配"事件时记录的修饰键状态"与自定义键盘 spec（不依赖 ev 对象，供 popup 路径使用）
  _matchCustomHotkeyMods(p, mods) {
    try {
      if (!p || !mods || p.mouse) return false;
      // 纯修饰键 spec（如 "ctrl"）：要求对应修饰键按下
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

  _hotkeyMatches(mods) {
    try {
      if (!mods || !mods.time) return false;
      if (Date.now() - mods.time > 5000) return false;
      const mod = (this._data && this._data.hotkeyModifier) || "ctrl";
      const c = !!mods.ctrl;
      const s = !!mods.shift;
      const a = !!mods.alt;
      // 鼠标按键组合已迁移至"添加单词并翻译"功能；此处只处理键盘组合键。
      // 鼠标按键组合已迁移至“添加单词并翻译”功能；此处仅处理键盘修饰键，
      // 不再因 mouse 字段误杀（按住 Alt/Ctrl 划词时 mousedown 记录含 mouse 字段）
      if (mods && (mods.mouse !== undefined && mods.mouse !== null) && !c && !s && !a) {
        return false;
      }
      // 兼容旧 hotkeyModifier 值 mouse1~mouse5：在此一律当作无效，避免误触发
      if (mod && mod.indexOf("mouse") === 0) return false;
      return (
        (mod === "ctrl" && c && !s && !a) ||
        (mod === "alt" && a && !c && !s) ||
        (mod === "ctrl+alt" && c && a && !s)
      );
    } catch (e) {
      return false;
    }
  },

  _clearSelectionHotkeyState(reason) {
    this._debugLog("clear selection hotkey state: " + (reason || "unknown"));
    this._hotkeyPressed = null;
    this._hotkeyModifiers = null;
    this._hotkeyJustReleased = null;
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

  // 当前是否处于“按住划词快捷键”会话（未被释放/清理）
  _inSelectionHotkeySession() {
    return !!(this._hotkeyPressed && this._hotkeyPressed.mod);
  },

  _triggerHotkeyTranslate(pending) {
    try {
      if (!pending || !pending.text) return;
      const now = Date.now();
      const key = String((pending.reader && pending.reader.tabID) || "") + "|" + String(pending.text || "");
      if (this._lastHotkeyKey === key && now - (this._lastHotkeyTime || 0) < 500) {
        return;
      }
      this._lastHotkeyKey = key;
      this._lastHotkeyTime = now;
      this._selectionHotkeyPending = null;
      // 保持 _hotkeyPressed/_hotkeyModifiers 不在此处清理：
      // 按住快捷键连续划词期间需要持续有效，直到 keyup 才结束 session
      this._hotkeyJustReleased = null;
      this._debugLog("hotkey translate: mod=" + (this._data.hotkeyModifier || "ctrl") + ", word=" + JSON.stringify(pending.text));
      // Beta: popup has add-btn, show temp edit area
      try {
        const hkDoc = this._getHotkeyTargetDoc(pending.reader);
        if (hkDoc) {
          const hkBtn = hkDoc.querySelector(".wordtranslator-add-btn");
          if (hkBtn) {
            this._showTempEditArea(hkDoc, hkBtn, pending.reader, pending.text, "");
          }
        }
      } catch (e) {
        this._debugLog("_triggerHotkeyTempEdit ERROR: " + (e && (e.message || String(e))));
      }
      this._addWordForReader(pending.reader, pending.text).catch((err) => {
        this._debugLog("hotkey promise ERROR: " + (err && (err.stack || err.message || String(err))));
      });   } catch (e) {
      this._debugLog("_triggerHotkeyTranslate ERROR: " + (e && (e.message || String(e))));
    }
  },

  // 快捷键-划词翻译：keydown 记录按下状态（不再在 keydown 时立即翻译，
  // 改为 keyup 时根据选中文本触发，避免时序抖动）
  _onHotkeyKeydown(doc, ev) {
    try {
      if (!this._data || !this._selectionHotkeyActive()) return;
      const k = (ev.key || "").toLowerCase();
      if (k === "control" || k === "shift" || k === "alt" || k === "meta") return;
      if (!this._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now() })) return;
      this._hotkeyPressed = { mod: this._data.hotkeyModifier || "ctrl", time: Date.now() };
      this._hotkeyJustReleased = null;
    } catch (e) {}
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
   * ? reader ???/?? ID ??? Item Pane ?????? ID?
   * Zotero ?? PDF ????Item Pane ???????????????
   * ?? null ??????????? ID ?? fallback??
   */
  _getItemPaneID(attachmentOrItemID) {
    try {
      let itemID = Number(attachmentOrItemID);
      if (!Number.isFinite(itemID) || itemID <= 0) return null;

      const item = Zotero.Items.get(itemID);
      if (!item) return null;

      // ?? -> ???
      if (typeof item.isAttachment === "function" ? item.isAttachment() : item.isAttachment) {
        if (item.parentID) {
          const parentID = Number(item.parentID);
          this._debugLog("resolve pane ID: attachment " + itemID + " -> parent " + parentID);
          return parentID;
        }
        // ??????????????????? ID
        return itemID;
      }

      // ???? -> ??
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

    // ???reader.itemID ? PDF ?? ID?Item Pane ??????? ID
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
      this._debugLog("_addWordForReader skip (duplicate): " + JSON.stringify(normWord));
      // 重复选中视为一次最近使用：保留同一个 card，不重复调用 API，
      // 但将其移动到原始数组末尾，交由当前 sortMode 重新计算显示位置。
      try {
        const existingTranslation = String(existingCard.translation || "").trim();
        if (existingTranslation && existingTranslation !== "翻译中…") {
          this._updateTempEditArea(normWord, existingTranslation);
        }
        const existingIndex = list.indexOf(existingCard);
        if (existingIndex >= 0 && existingIndex !== list.length - 1) {
          list.splice(existingIndex, 1);
          list.push(existingCard);
          this._itemWords.set(Number(paneID), list);
          this._persistWords();
          this._refreshItemPane(paneID);
          this._debugLog("_addWordForReader duplicate moved to end: paneID=" + paneID);
        }
      } catch (e) {
        this._debugLog("duplicate recent-use update ERROR: " + (e && (e.message || String(e))));
      }
      return;
    }
    const card = { word: normWord, translation: "翻译中…", pending: true };
    list.push(card);
    this._itemWords.set(Number(paneID), list);
    this._persistWords();
    this._debugLog("_addWordForReader added: paneID=" + paneID + ", count=" + list.length);

    this._refreshItemPane(paneID);

    try {
      const api = this.getActiveApi();
      this._debugLog(
        "translate start: api=" + JSON.stringify(api ? {
          name: api.name, provider: api.provider,
          baseUrl: api.baseUrl, model: api.model, hasKey: !!api.apiKey
        } : null)
      );
      const result = await this.translate(word);
      card.translation = result || "翻译失败";
      this._debugLog("translate success: " + JSON.stringify(card.translation));
    } catch (e) {
      card.translation = "翻译失败";
      this._debugLog("translate ERROR: " + (e && (e.stack || e.message || String(e))));
    } finally {
      card.pending = false;
      this._flushAndPersistWords();
      this._refreshItemPane(paneID);
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

  _refreshItemPane(itemID) {
    const id = Number(itemID);
    if (!Number.isFinite(id) || id <= 0) return;
    this._debugLog("_refreshItemPane: id=" + id + ", forceRender=true");
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
      this._renderPaneBody(doc, body, { id });
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
    this._persistWords();
    this._refreshItemPane(id);
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

  _refreshProvidersInAllPanes(currentItemID) {
    return (async () => {
      try {
        await this._reloadDataFromDisk();
        const context = this._currentPaneContext;
        const id = context && Number(context.itemID) || Number(currentItemID);
        if (Number.isFinite(id) && id > 0) this._refreshItemPane(id);
        this._debugLog("_refreshProvidersInAllPanes: direct refresh=" + (Number.isFinite(id) && id > 0) + ", currentItemID=" + currentItemID);
      } catch (e) {
        this._debugLog("_refreshProvidersInAllPanes ERROR: " + (e && (e.stack || e.message || String(e))));
      }
    })();
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
    this._persistWords();
    this._refreshItemPane(id);
  },

  // ---------- 注册 Item Pane 面板 ----------
  registerItemPaneSection() {
    try {
      const key = Zotero.ItemPaneManager.registerSection({
        paneID: "wordtranslator",
        pluginID: this._addonID,
        header: {
          l10nID: "wordtranslator-itemPaneSection-header",
          icon: "chrome://wordtranslator/content/icons/icon1.4.png",
        },
        sidenav: {
          l10nID: "wordtranslator-itemPaneSection-sidenav",
          icon: "chrome://wordtranslator/content/icons/icon1.4.png",
          orderable: false,
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
            if (!this._currentPaneContext || !this._currentPaneContext.body || !this._currentPaneContext.body.isConnected) {
              this._currentPaneContext = { doc: body && body.ownerDocument, body, itemID: null, paneUID: uid };
            }
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
    const sortedIndices = this._getSortedIndices(rawWords, this._sortMode);

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
    const controlsRow = el("div", { style: "display:flex;align-items:center;gap:5px;width:100%;min-width:0;min-height:26px;" });
    const titleGroup = el("div", { style: "display:flex;align-items:center;gap:6px;flex:1;min-width:0;" });
    const titleActions = el("div", { style: "display:flex;align-items:center;gap:6px;flex-shrink:0;" });

    const title = el("strong", { title: "单词本", style: "white-space:nowrap;font-size:14px;line-height:20px;" }, [txt("单词本")]);
    titleGroup.append(title);

    const apiSelect = el("select", { style: "flex:1;min-width:0;font-size:12px;padding:2px 6px;", title: "切换翻译 API", "aria-label": "当前翻译 API" });
    this._fillApiSelect(doc, apiSelect);
    apiSelect.addEventListener("change", () => {
      const idx = parseInt(apiSelect.value, 10);
      this._setActiveApiForItem(itemID, idx);
    });
    controlsRow.append(apiSelect);

    const compactButtonStyle = "width:28px;height:26px;padding:0;border:1px solid rgba(0,0,0,0.16);background:rgba(255,255,255,0.72);border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#555;box-sizing:border-box;flex:0 0 28px;";
    const refreshBtn = el("button", { title: "刷新服务商列表", "aria-label": "刷新服务商列表", style: compactButtonStyle }, []);
    refreshBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"23 4 23 10 17 10\"></polyline><polyline points=\"1 20 1 14 7 14\"></polyline><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"></path></svg>";
    refreshBtn.addEventListener("click", () => this._refreshProvidersInAllPanes(itemID));
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
      const context = this._currentPaneContext;
      const itemID = context && Number(context.itemID);
      this._debugLog("sort refresh: itemID=" + itemID + ", hasContext=" + !!context);
      if (Number.isFinite(itemID) && itemID > 0) {
        this._refreshItemPane(itemID);
        this._debugLog("sort refresh completed: itemID=" + itemID);
      } else {
        this._debugLog("sort refresh skipped: no valid pane context");
      }
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

    const clearBtn = el("button", { title: "清空当前条目的全部单词", "aria-label": "清空当前条目的全部单词", style: "height:26px;padding:0 9px;border:1px solid rgba(0,0,0,0.16);background:rgba(255,255,255,0.72);border-radius:6px;cursor:pointer;font-size:12px;line-height:24px;box-sizing:border-box;white-space:nowrap;" }, [txt("清空")]);
    clearBtn.addEventListener("click", () => this._clearAllWordsForItem(itemID));
    titleActions.append(clearBtn);

    titleRow.append(titleGroup, titleActions);
    header.append(titleRow, controlsRow);
    body.append(header);

    // 卡片列表
    const list = el("div", { class: "wordtranslator-pane-list", style: "display:flex;flex-direction:column;gap:6px;" });
    if (rawWords.length === 0) {
      const empty = el("div", { style: "color:#888;font-size:12px;padding:6px 4px;" }, [txt("暂无单词。打开 PDF 划词后，点击「" + (this._data?.contextMenuLabel || "添加单词并翻译") + "」即可加入。")]);
      list.append(empty);
    } else {
      sortedIndices.forEach((origIdx) => {
        const w = rawWords[origIdx];
        list.append(this._renderCard(doc, itemID, origIdx, w));
      });
    }
    body.append(list);

    // CSS（注入一次，挂在 body 内部最安全）
    if (!body.querySelector(".wordtranslator-pane-style")) {
      const style = doc.createElementNS(HTML_NS, "style");
      style.className = "wordtranslator-pane-style";
      style.textContent = this._getPaneCSS();
      body.append(style);
    }
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

    const card = el("div", { style: "display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;background:rgba(255,255,255,0.6);" });
    const fsVal = Number(this._data && this._data.fontSize) || 13;
    // 文本部分包在一个容器里，只对它应用字号，并且可被选中
    const textWrap = el("div", { class: "wt-card-text", style: "flex:1;min-width:0;font-size:" + fsVal + "px;line-height:1.5;user-select:text;-webkit-user-select:text;cursor:text;" });
    const wordEl = el("span", { class: "wt-card-word", style: "font-weight:600;color:#1e88e5;word-break:break-word;" }, [txt(w.word)]);
    const arrowEl = el("span", { class: "wt-card-arrow", style: "color:#666;flex-shrink:0;margin:0 2px;" }, [txt(" -- ")]);
    const transEl = el("span", { class: "wt-card-trans", style: "word-break:break-word;" + (w.pending ? "color:#999;" : "") }, [txt(w.translation)]);
    textWrap.append(wordEl, arrowEl, transEl);
    const delBtn = el("button", { title: "删除", style: "flex-shrink:0;border:none;background:transparent;color:#999;cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;" }, [txt("✕")]);
    delBtn.addEventListener("click", () => this._deleteWordForItem(itemID, idx));
    card.append(textWrap, delBtn);
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
    return ".wordtranslator-pane-body button:hover { background: rgba(0,0,0,0.06); } .wordtranslator-pane-body select { color: #222; background: #fff; } .wt-card-text { user-select: text; -webkit-user-select: text; cursor: text; }";
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
    const base = {
      contextMenuLabel: "添加单词并翻译",
      enabled: true,
      autoTranslate: false,
      hotkeyEnabled: false,
      hotkeyModifier: "ctrl",
      customHotkeyEnabled: false,
      customHotkey: "",
      addWordHotkeyEnabled: true,
      addWordHotkey: "",
      addWordHotkeyMode: "ctrl",
      selectionFirstEnabled: true,
      promptSystem:
        "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。",
      promptUser: "请将以下英文单词或短语翻译为专业中文：{{word}}",
      promptMode: "split",
      promptGlobal:
        "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。\n请将以下英文单词或短语翻译为专业中文：{{word}}",
      fontSize: 13,
      apis: [],
      activeApiIndex: 0,
      sortMode: "reverse",
    };
    if (!raw || typeof raw !== "object") return base;
    return {
      ...base,
      ...raw,
      apis: Array.isArray(raw.apis) ? raw.apis : [],
      activeApiIndex: typeof raw.activeApiIndex === "number" ? raw.activeApiIndex : 0,
      sortMode: typeof raw.sortMode === "string" ? raw.sortMode : "reverse",
      // 旧数据没有新字段时保持默认值（...raw 会用 undefined 覆盖 base，需显式回填）
      addWordHotkeyEnabled: typeof raw.addWordHotkeyEnabled === "boolean" ? raw.addWordHotkeyEnabled : true,
      addWordHotkeyMode: (raw.addWordHotkeyMode === "ctrl" || raw.addWordHotkeyMode === "alt" ||
        raw.addWordHotkeyMode === "shift" || raw.addWordHotkeyMode === "custom")
        ? raw.addWordHotkeyMode : "ctrl",
      selectionFirstEnabled: typeof raw.selectionFirstEnabled === "boolean" ? raw.selectionFirstEnabled : true,
      hotkeyModifier: (raw.hotkeyModifier === "shift" || raw.hotkeyModifier === "ctrl+shift" || raw.hotkeyModifier === "alt+shift")
        ? "ctrl" : (raw.hotkeyModifier || "ctrl"),
    };
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
              return { word: String(w.word || ""), translation: String(w.translation || ""), pending: !!w.pending };
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

  _persistWords() {
    try {
      if (Zotero.WordTranslatorStorage && typeof Zotero.WordTranslatorStorage.saveWordsForItemDebounced === "function") {
        for (const [itemID, list] of this._itemWords) {
          Zotero.WordTranslatorStorage.saveWordsForItemDebounced(itemID, list, 300);
        }
        return;
      }
      // 兜底：仍写 prefs
      const obj = {};
      for (const [itemID, list] of this._itemWords) {
        obj[String(itemID)] = list;
      }
      Zotero.Prefs.set(this._wordsPrefKey, JSON.stringify(obj), true);
    } catch (e) {
      this._debugLog("_persistWords ERROR: " + (e && (e.stack || e.message || String(e))));
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
  async translate(text, apiOverride) {
    const api = apiOverride || this.getActiveApi();
    if (!api) throw new Error("未配置 API（请到设置->单词翻译 中添加 API）");
    const promptMode = (this._data && this._data.promptMode) || "split";
    let messages = [];
    if (promptMode === "combined") {
      const globalTemplate = (this._data && this._data.promptGlobal) ||
        "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。\n请将以下英文单词或短语翻译为专业中文：{{word}}";
      messages = [
        { role: "user", content: globalTemplate.split("{{word}}").join(text) },
      ];
    } else {
      const system = (this._data && this._data.promptSystem) || "";
      const userTemplate = (this._data && this._data.promptUser) || "请将以下英文单词或短语翻译为专业中文：{{word}}";
      const user = userTemplate.split("{{word}}").join(text);
      messages = [
        { role: "system", content: system },
        { role: "user", content: user },
      ];
    }
    const body = {
      model: api.model,
      messages,
      temperature: 0.3,
      stream: false,
    };
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + api.apiKey,
    };
    const provider = api.provider || (api.type === "deepseek" ? "deepseek" : "openai");
    let base = (api.baseUrl || "").trim().replace(/\/+$/, "");
    if (!base) {
      base = provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1";
    }
    const url = base + "/chat/completions";
    this._debugLog("request URL: " + url + " | model=" + (api.model || "(none)"));
    const resp = await Zotero.HTTP.request("POST", url, {
      headers,
      body: JSON.stringify(body),
      responseType: "json",
    });
    let responseData = resp.response;
    if (typeof responseData === "string") {
      try { responseData = JSON.parse(responseData); }
      catch (e) { throw new Error("API 返回的不是有效 JSON：" + responseData.slice(0, 200)); }
    }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && responseData.error && (responseData.error.message || responseData.error) || responseData && responseData.message || resp.statusText || "";
      throw new Error("API 错误(" + resp.status + "): " + detail);
    }
    const content = (responseData && responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content) || "";
    if (!content) {
      throw new Error("API 返回中没有 choices[0].message.content：" + JSON.stringify(responseData).slice(0, 500));
    }
    return String(content).trim();
  },
async testApi(api) {
    try {
      const result = await this.translate("translation", api);
      return !!result;
    } catch (e) {
      return false;
    }
  },
};

if (typeof Zotero !== "undefined") {
  Zotero.WordTranslator = WordTranslator;
}