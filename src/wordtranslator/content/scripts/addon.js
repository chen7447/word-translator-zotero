"use strict";

// Word Translator for Zotero 鏍稿績妯″潡锛堥€傞厤 Zotero 7/8/9/10锛?
// 渚濊禆锛歓otero.Prefs锛圸otero 7+ 鏍囧噯鍋忓ソ锛?
// 鍔熻兘锛?
//   1. PDF 闃呰鍣ㄥ垝璇嶈彍鍗曟敞鍏?娣诲姞鍗曡瘝骞剁炕璇?鎸夐挳锛堝甫 SVG 鍥炬爣锛?
//   2. 璋?OpenAI/DeepSeek 鍏煎鎺ュ彛缈昏瘧涓撲笟鑻辨枃鍗曡瘝
//   3. 鍦ㄥ彸渚?Item Pane 闈㈡澘浠ュ崱鐗囧舰寮忓睍绀?[鍗曡瘝 -- 璇戞枃]锛屽彲閫愭潯鍒犻櫎
//   4. Item Pane 澶撮儴涓嬫媺鍒囨崲褰撳墠 API锛涘 API 閰嶇疆鍦ㄥ亸濂介潰鏉垮畬鎴?

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
  _wordBookViewState: new Map(), // itemID -> { page, search } 鍒嗛〉/鎼滅储涓存椂鐣岄潰鐘舵€侊紙涓嶅啓鐩橈級
  _wordBookSearchTimers: new Map(), // itemID -> debounce timer
  _wordBookSearchStrategies: new Map([
    // 鍓嶇紑鍖归厤锛堥粯璁わ級锛歸ord.startsWith(keyword)
    ["prefix", function (word, keyword) {
      return String(word.word || "").toLowerCase().startsWith(keyword);
    }],
    // 鎵€鏈夊尮閰嶏細鍗曡瘝鎴栭噴涔夊寘鍚?keyword
    ["all", function (word, keyword) {
      const w = String(word.word || "").toLowerCase();
      const t = String(word.translation || "").toLowerCase();
      return w.includes(keyword) || t.includes(keyword);
    }],
    // 鍙悳鍗曡瘝锛氫粎 word 瀛楁鍖呭惈 keyword
    ["wordOnly", function (word, keyword) {
      return String(word.word || "").toLowerCase().includes(keyword);
    }],
    // 绮剧‘鍖归厤锛歸ord === keyword
    ["exact", function (word, keyword) {
      return String(word.word || "").toLowerCase() === keyword;
    }],
  ]), // 鎼滅储绛栫暐娉ㄥ唽琛細鍚庣画绛栫暐鍙渶娉ㄥ唽锛屼笉鏀瑰悗缃鐞嗘祦绋?
  _activeSearchStrategy: "prefix", // 褰撳墠鐢熸晥绛栫暐锛屼粠 _data.searchStrategy 鍔犺浇
  _sortMode: "reverse", // 鎺掑簭妯″紡锛歠orward | reverse | alpha
  _panelUIDs: new Map(),      // itemID -> { paneUID, refresh }
  _paneKey: null,
  _prefWindowLoaded: false,
  _paneRefresh: null,
  _hotkeyPressed: null,
  _hotkeyJustReleased: null,
  _hotkeyModifiers: null,
  _selectionFirstPending: null,
  // 鍋忓ソ椤甸厤缃殑鈥滃揩鎹烽敭-鍒掕瘝缈昏瘧鈥濈粺涓€鍏ㄥ眬鎸夐敭鐘舵€侊紱涓嶄负 Alt/Ctrl 绛夊垎鍒敞鍐岀姸鎬併€?
  _selectionTranslateKeyState: null,
  _selectionTranslateSession: null,
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
      // 浼樺厛锛歓otero.Utilities.Internal.openInShell銆俍otero 9 甯稿畾涔変负澶栭儴璧勬簮鎵撳紑
      try {
        if (Zotero.Utilities && Zotero.Utilities.Internal && typeof Zotero.Utilities.Internal.openInShell === "function") {
          Zotero.Utilities.Internal.openInShell(url);
          return true;
        }
      } catch (e) { this._debugLog("_openExternalURL openInShell ERROR: " + (e && e.message || e)); }
      // 鍥為€€锛歯sIExternalProtocolService
      try {
        const io = Services.io;
        const eps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
        eps.loadURI(io.newURI(url, null, null), null);
        return true;
      } catch (e) { this._debugLog("_openExternalURL ext-protocol ERROR: " + (e && e.message || e)); }
      // 鏈€鍚庨€€鑰€锛氬鍒跺埌鍓创鏉?
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
      // 3) 澶嶅埗鍒板壀璐存澘
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
      // 鏃犺鍘熷洜锛屽叧闂?鍗囩骇/绂佺敤鏃堕兘绔嬪嵆鍐欑洏锛岄伩鍏嶉槻鎶栧畾鏃跺櫒鏈Е鍙戝鑷存暟鎹涪澶?
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
      // 娉ㄩ攢鍋忓ソ椤碉紙闃叉鏇存柊鍚庢棫 pane 娈嬬暀瀵艰嚧鏂版爣绛句笉鏄剧ず锛?
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
            // 棰勮绠楁暟鎹洰褰曡矾寰勶紙绾瓧绗︿覆锛屽亸濂芥矙绠卞彲鐩存帴璇诲彇锛岄伩鍏嶆矙绠卞唴 Components 涓嶅彲鐢級
            const baseDir = pp.replace(/[\\/]+$/, "") + sep + "wordtranslator";
            Zotero.WordTranslator.dataDirPath = baseDir;
            Zotero.WordTranslator.apiConfigPath = baseDir + sep + "api-config.json";
            Zotero.WordTranslator.wordsDirPath = baseDir + sep + "words";
          }
        } catch (e) {}
      } catch (e) {}
        // 鏆撮湶鍏朵粬璧勬簮缁欏亸濂介潰鏉夸娇鐢?
        try { Zotero.WordTranslator.openExternalURL = (url) => this._openExternalURL(url); } catch (e) {}
        try { Zotero.WordTranslator.getDataDirPath = () => Zotero.WordTranslator.dataDirPath || (Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getDataDirPath()) || ""; } catch (e) {}
        try { Zotero.WordTranslator.getApiConfigPath = () => Zotero.WordTranslator.apiConfigPath || (Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getApiConfigPath()) || ""; } catch (e) {}
        try { Zotero.WordTranslator.getWordsDirPath = () => Zotero.WordTranslator.wordsDirPath || (Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getWordsDirPath()) || ""; } catch (e) {}
        try { Zotero.WordTranslator.openDataDir = () => this._openInOS(Zotero.WordTranslator.dataDirPath || (Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.getDataDirPath()) || ""); } catch (e) {}
        try { Zotero.WordTranslator.openInOS = (path) => this._openInOS(path); } catch (e) {}
        // 鍋忓ソ娌欑璇诲彇鍔╂墜锛氳繑鍥?JSON 瀛楃涓诧紙娌欑鍐呮棤 Components锛屼笉鑳界洿鎺ヨ皟 storage.js锛?
        try { Zotero.WordTranslator.readApiConfigString = () => { try { const S = Zotero.WordTranslatorStorage; if (S && typeof S.loadApiConfig === "function") { const obj = S.loadApiConfig(); return obj ? JSON.stringify(obj) : ""; } } catch (e0) {} return ""; }; } catch (e) {}
        try { Zotero.WordTranslator.writeApiConfigString = (jsonStr) => { try { const S = Zotero.WordTranslatorStorage; if (S && typeof S.saveApiConfig === "function") { const obj = jsonStr ? JSON.parse(jsonStr) : null; return !!S.saveApiConfig(obj); } } catch (e0) {} return false; }; } catch (e) {}
      await this.loadDataFromDisk();
      this._loadWordsFromDisk();
      this._sortMode = this._data.sortMode || "reverse";
      this._activeSearchStrategy = this._getActiveSearchStrategyName();
      // 涓诲姩楠岃瘉瀛樺偍灞傦細纭繚鏁版嵁鐩綍瀛樺湪骞跺啓鐩橈紙杈撳嚭鏃ュ織渚夸簬瀹氫綅鍐欐枃浠跺け璐ワ級
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
      // 鍚姩璺緞妫€娴嬶細鏄庣‘鎵撳嵃鏁版嵁鏂囦欢鏄惁瀛樺湪锛屼究浜庢帓鏌?
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
      // Beta锛氭彃浠舵洿鏂?鍔犺浇鍚庡欢杩熷己鍒堕噸娓叉煋褰撳墠 Item Pane锛?
      // 纭繚鍗曡瘝鏈珛鍗虫樉绀烘湰鍦板凡鍔犺浇鏁版嵁锛堢儹鏇存柊鍚?Item Pane 涓嶄細鑷姩閲嶇敾锛?
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
      // 浼樺厛璇荤嫭绔嬫枃浠讹紱鏃犳枃浠舵椂鍥為€€璇?prefs.js 鏃ф暟鎹紙涓€娆℃€ц縼绉伙級
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

  // ---------- 娉ㄥ唽 Zotero 鍋忓ソ椤?----------
  async registerPrefsWindow() {
    try {
      const rootURI = this._addonRoot.endsWith("/") ? this._addonRoot : this._addonRoot + "/";
      // 閬垮厤閲嶅娉ㄥ唽鍐茬獊锛氭彃浠舵洿鏂?閲嶆柊瀹夎鍚庯紝鏃х増鐨?PreferencePane 浠嶅彲鑳芥畫鐣欍€?
      // 鍏?unregister 鍐?register锛岀‘淇濇柊鐗堢殑 URL 鐢熸晥銆?
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
        label: "鍗曡瘝缈昏瘧 Word Translator",
        image: rootURI + "content/icons/wordtranslator-section-20.svg",
        scripts: [rootURI + "content/preferences.js"],
      });
      this._debugLog("registerPrefsWindow OK: " + rootURI + "content/preferences.xhtml");
    } catch (e) {
      this._debugLog("registerPrefsWindow ERROR: " + (e && (e.stack || e.message || e)));
    }
  },

  // ---------- 娉ㄥ唽鍒掕瘝鑿滃崟 ----------
  registerReaderEvents() {
    this._readerTabHandlers = this._readerTabHandlers || new Map();
    const handler = (event) => {
      try { this._onRenderTextSelectionPopup(event); }
      catch (e) { this._debugLog("popup handler ERROR: " + (e && e.message || e)); }
    };
    Zotero.Reader.registerEventListener("renderTextSelectionPopup", handler, this._addonID);
    this._readerTabHandlers.set("popup", handler);
    // 闃呰鍣ㄦ墦寮€鏃讹紙renderToolbar 浜嬩欢锛変富鍔ㄧ粰 PDF iframe 鎸傚揩鎹烽敭鐩戝惉锛?
    // 淇濊瘉鈥滄寜浣忎慨楗伴敭 + 绗竴娆″垝璇嶁€濅篃鑳界敓鏁堬紙棣栨 popup 鏃跺啀鎸傚氨澶櫄浜嗭級銆?
    try {
      if (!this._hotkeyToolbarHandler) {
        const self = this;
        this._hotkeyToolbarHandler = (event) => {
          try {
            // renderToolbar 浜嬩欢鐨?detail 涓嶅惈 reader 瀛楁锛岄亶鍘嗗綋鍓嶆墍鏈夐槄璇诲櫒缁戝畾
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
    // 鍚姩鍏滃簳锛氶亶鍘嗗凡鎵撳紑鐨勯槄璇诲櫒锛岀粦瀹氬揩鎹烽敭鐩戝惉
    try {
      const readers = Zotero.Reader && Zotero.Reader._readers;
      if (readers && readers.length) {
        for (const r of readers) {
          try { this._bindHotkeyForReaderInstance(r); } catch (e) {}
        }
      }
    } catch (e) {}
    // 鍏ㄥ眬鐩戝惉锛氫富绐楀彛鎸?keydown/keyup/mousedown锛岀劍鐐瑰湪 debug 鐣岄潰绛夊涔熻兘璁板綍蹇嵎閿姸鎬?
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
      // 涓?Zotero 绐楀彛澶辩劍閫氬父鎰忓懗鐫€搴旂敤琚?Alt+Tab 鍒囪蛋锛涗笌 Reader/PDF
      // 鍐呴儴鍥?popup 澶虹劍鐐逛骇鐢熺殑 blur 鍒嗗紑澶勭悊銆?
      // reset listener 蹇呴』缁戝畾鐪熷疄鐨勯《灞?Window锛泃arget 鍙兘鏄?document锛?
      // 鑰?Alt+Tab 瑙﹀彂鐨勬槸 Window blur锛屼笉鑳戒緷璧?document 鎺ユ敹璇ヤ簨浠躲€?
      this._bindHotkeyResetListener(win, "main-window");
      const self = this;
      // 鍋忓ソ椤佃缃粈涔堝揩鎹烽敭锛屽氨鐢卞悓涓€濂楀叏灞€鐘舵€佸尮閰嶅櫒澶勭悊锛涗笉鎸夊叿浣撴寜閿垎鍒敞鍐屻€?
      target.addEventListener("keydown", function (ev) {
        try { self._handleSelectionTranslateGlobalKeyDown(ev, "main-window"); } catch (e) {}
      }, true);
      target.addEventListener("keyup", function (ev) {
        try { self._handleSelectionTranslateGlobalKeyUp(ev, "main-window"); } catch (e) {}
      }, true);
      // 鈥斺€?榧犳爣锛氬彧淇濈暀鈥滃厛閫夊尯鍚庢寜缁戝畾閿€濈殑鍏ュ彛锛涗晶閿垝璇嶅凡搴熷純 鈥斺€?
      target.addEventListener("mousedown", function (ev) {
        try {
          self._refreshPrefsFromStorage();
          const d = self._data;
          if (!d || !self._addWordHotkeyActive()) return;
          if (self._matchSelectionFirstKey(ev)) {
            self._fireAddWordHotkey();
          }
        } catch (e) {}
      }, true);
      // 鈥斺€?閿洏锛氣€滃厛閫夊尯鍚庢寜缁戝畾閿€?鈥斺€?
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

  _handleSelectionTranslateGlobalKeyDown(ev, source) {
    try {
      this._refreshPrefsFromStorage();
      const d = this._data;
      if (!d || !this._selectionHotkeyActive()) return false;
      if (!this._matchConfiguredSelectionTranslateKeyDown(ev)) return false;
      // 淇濇寔鈥滃厛閫夊尯鍚庢寜娣诲姞鍗曡瘝蹇嵎閿€濈嫭绔嬶紱鍚屼竴鎸夐敭涓嶅惎鍔ㄦ柊鐨勫垝璇嶄細璇濄€?
      if (this._addWordHotkeyActive() && this._matchSelectionFirstKey(ev) && this._getSelectionFirstPending()) {
        this._debugLog("selection translate global keydown skipped: add-word hotkey owns selection");
        return false;
      }
      const existing = this._selectionTranslateKeyState;
      if (existing && existing.active) return true;
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

  // 鏍￠獙褰撳墠榧犳爣浜嬩欢涓婇厤缃墍闇€鐨勪慨楗伴敭鏄惁浠嶇劧瀹為檯鎸変笅銆?
  // 鐢ㄤ簬 Alt+Tab 绛変涪澶?keyup 鍚庯紝鍦ㄥ缓绔嬫柊鍒掕瘝浼氳瘽鍓嶆竻闄ゆ畫鐣欑姸鎬併€?
  _isSelectionTranslateModifierDown(ev, spec) {
    try {
      const p = this._parseHotkeySpec(spec);
      if (!p || !ev) return false;
      // 绾慨楗伴敭閰嶇疆锛氬 "Alt" / "Ctrl" / "Shift"锛岃姹傝閿寜涓嬩笖鍏朵綑淇グ閿湭鎸変笅銆?
      if (p.key === "ctrl" || p.key === "control") return !!ev.ctrlKey && !ev.altKey && !ev.shiftKey && !ev.metaKey;
      if (p.key === "alt") return !!ev.altKey && !ev.ctrlKey && !ev.shiftKey && !ev.metaKey;
      if (p.key === "shift") return !!ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey;
      // 缁勫悎閿厤缃細濡?"Alt+Z"锛屾牎楠屽０鏄庣殑淇グ閿潎鎸変笅銆?
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
      // 鍏ュ彛浼犲叆鐨?btn 鍙兘鏄棫鑺傜偣锛屼篃鍙兘鏄?append 鍓嶅垱寤虹殑鑺傜偣銆?
      // 缁熶竴鍏ュ彛鍙帴鍙楀綋鍓?popup 涓粛杩炴帴鐨勬湰鎻掍欢鎸夐挳銆?
      if (!btn || !btn.isConnected || !btn.classList || !btn.classList.contains("wordtranslator-add-btn")) {
        btn = doc && doc.querySelector ? doc.querySelector(".wordtranslator-add-btn") : null;
      }
      if (!btn && doc && typeof append === "function") {
        const created = this._createAddWordButton(doc, reader, text, this._getAddWordButtonHTML((this._data && this._data.contextMenuLabel) || "娣诲姞鍗曡瘝骞剁炕璇?));
        append(created);
        // append() 鍙兘閫氳繃 cloneInto 璺ㄦ枃妗ｄ紶閫掑厓绱狅紱缁濅笉鑳界户缁娇鐢?created銆?
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

  _triggerHotkeyTranslate(pending) {
    try {
      if (!pending || !pending.reader || !pending.text) return;
      const popup = this._lastSelectionPopup;
      const popupButton = popup && popup.button && popup.button.classList && popup.button.classList.contains("wordtranslator-add-btn") ? popup.button : null;
      this._handleAddWordTrigger({
        source: "hotkey",
        doc: pending.doc || (popup && popup.doc),
        btn: pending.btn || popupButton,
        append: pending.append || null,
        reader: pending.reader,
        text: pending.text,
      });
    } catch (e) {
      this._debugLog("_triggerHotkeyTranslate ERROR: " + (e && (e.message || String(e))));
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

  _bindHotkeyForReaderInstance(reader) {
    try {
      if (!reader || !reader.tabID) return;
      const key = "wtHotkeyBound_" + this._addonID;
      if (reader[key]) return;
      reader[key] = true;
      const self = this;
      this._debugLog("hotkey bind start: itemID=" + (reader && reader.itemID) + ", tabID=" + (reader && reader.tabID));
      // 鍏堢粦闃呰鍣ㄤ富绐楀彛 iframe锛堢ǔ瀹氬瓨鍦紱PDF iframe 浜嬩欢浼氬啋娉″埌杩欓噷锛?
      try {
        this._bindHotkeyModifierListener(reader._iframeWindow, reader);
      } catch (e) {}
      // PDF.js 瑙嗗浘 iframe 闇€瑕佺瓑鍒濆鍖栧畬鎴愶紝杞绛夊緟
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
        setTimeout(function () { self._waitForHotkeyWindow(reader, attempt + 1); }, 100);
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
      win.__wordTranslatorHotkeyResetBound = true;
      const self = this;
      const clear = (reason) => {
        const session = self._selectionTranslateSession;
        const isMainWindow = role === "main-window";

        // 涓荤獥鍙?blur 琛ㄧず Zotero 鏁翠綋澶卞幓婵€娲伙紙渚嬪 Alt+Tab锛夈€傛鏃?
        // Windows 鍙兘涓嶄細鍐嶆妸鍖归厤鐨?keyup 鍙戝洖 Zotero锛屽繀椤讳富鍔ㄦ竻闄?
        // 鍏ㄥ眬蹇嵎閿姸鎬侊紝閬垮厤鍥炴潵鍚庢櫘閫氬垝璇嶇户缁璇垽涓烘寜浣忓揩鎹烽敭銆?
        if (reason === "window blur" && isMainWindow) {
          self._selectionTranslateKeyState = null;
          self._clearSelectionHotkeyState("main-window-deactivate");
          self._clearSelectionTranslateState("main-window-deactivate");
          self._debugLog("selection translate main window blur: global state cleared");
          return;
        }

        // 涓荤獥鍙?deactivate锛氬畠鍦?Reader/popup/涓存椂缂栬緫鍖哄煙鐨勫唴閮ㄧ劍鐐瑰垏鎹㈡椂
        // 涔熶細棰戠箒瑙﹀彂锛堟棩蹇楀凡璇佸疄锛夛紝涓嶈兘鏃犳潯浠跺綋浣滃簲鐢ㄨ鍒囧嚭銆?
        // 褰撳瓨鍦ㄨ繘琛屼腑鐨勯€夊尯/寮圭獥鐘舵€佹椂淇濈暀浼氳瘽锛岄伩鍏嶇牬鍧忚繛缁垝璇嶃€?
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
          self._clearSelectionHotkeyState("main-window-deactivate");
          self._clearSelectionTranslateState("main-window-deactivate");
          self._debugLog("selection translate main window deactivation: global state cleared");
          return;
        }

        // 鏂规 A锛氶儴鍒嗘闈㈠垏鎹㈠満鏅彲鑳戒笉鍚戦《灞?Window 娲惧彂 blur锛?
        // 浣嗕富鏂囨。浼氳繘鍏?hidden锛涘皢鍏朵綔涓?Alt+Tab 涓㈠け keyup 鐨勫厹搴曘€?
        if (reason === "document hidden" && isMainWindow) {
          self._selectionTranslateKeyState = null;
          self._clearSelectionHotkeyState("main-window-hidden");
          self._clearSelectionTranslateState("main-window-hidden");
          self._debugLog("selection translate main document hidden: global state cleared");
          return;
        }

        // Reader/PDF 鍐呴儴 blur 鍙兘鍙槸 popup 鎴栦复鏃剁紪杈戝尯鍩熷ず鍙栫劍鐐癸紱
        // 淇濈暀鍘熸湁淇濇姢閫昏緫锛屼笉鑳芥妸瀹冪瓑鍚屼簬搴旂敤琚垏鍑恒€?
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
        self._clearSelectionHotkeyState(reason);
        // 绐楀彛 blur 涓嶇瓑浜庨厤缃揩鎹烽敭宸茬粡閲婃斁锛涘叏灞€ keyup 鎵嶆槸姝ｅ父缁撴潫鏉′欢銆?
        if (reason !== "window blur" || !self._selectionTranslateKeyState) {
          self._clearSelectionTranslateState(reason);
        } else {
          self._debugLog("selection translate blur ignored: global key state active");
        }
      };
      win.addEventListener("blur", () => clear("window blur"), true);
      win.addEventListener("pagehide", () => clear("pagehide"), true);
      // 鏂规 B锛歑UL 椤跺眰绐楀彛澶辨椿鏃舵淳鍙?deactivate锛涚敤浜庢崟鑾?Alt+Tab
      // 鍦烘櫙涓彲鑳戒涪澶辩殑 modifier keyup銆?
      if (role === "main-window") {
        win.addEventListener("deactivate", () => clear("window deactivate"), true);
      }
    } catch (e) {}
  },

  _bindHotkeyModifierListener(win, reader) {
    try {
      if (!win) return;
      if (this._hotkeyBoundWindows && this._hotkeyBoundWindows.has(win)) return;
      if (!this._hotkeyBoundWindows) this._hotkeyBoundWindows = new Set();
      this._hotkeyBoundWindows.add(win);
      this._bindHotkeyResetListener(win, "reader-window");
      const self = this;
      // PDF/Reader 绐楀彛涔熸妸鎸夐敭浜ょ粰鍚屼竴涓叏灞€鐘舵€佸嚱鏁帮紱杩欓噷涓嶆槸涓烘瘡涓寜閿崟鐙敞鍐屻€?
      win.addEventListener("keydown", function (ev) {
        try { self._handleSelectionTranslateGlobalKeyDown(ev, "reader-window"); } catch (e) {}
      }, true);
      // 榧犳爣宸﹂敭鍙礋璐ｂ€滃揩鎹烽敭-鍒掕瘝缈昏瘧鈥濈殑涓€娆￠€夊尯杈圭晫锛?
      // keydown 寮€濮嬩細璇?鈫?mousedown 寮€濮嬮€夋嫨 鈫?mouseup 妫€鏌ラ€夊尯 鈫?popup 瑙﹀彂銆?
      win.addEventListener("mousedown", function (ev) {
        try {
          if (ev.button !== 0) return;
          const keyState = self._selectionTranslateKeyState;
          // Alt+Tab 绛夊満鏅彲鑳戒涪澶?modifier keyup锛屽鑷?_selectionTranslateKeyState
          // 娈嬬暀涓?active锛堝嵆浣?_selectionTranslateSession 涔熸畫鐣?active锛夈€傚湪姣忔
          // 宸﹂敭 mousedown 閮界敤鏈簨浠舵惡甯︾殑瀹炴椂淇グ閿姸鎬佸疄娴嬫牎楠岋細鑻ラ厤缃墍闇€鐨?
          // modifier 宸蹭笉鍐嶅疄闄呮寜涓嬶紝鍒欐竻闄ゆ畫鐣欑姸鎬佸苟鎷掔粷鏈鍒掕瘝缈昏瘧銆?
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
          // 鍏ㄥ眬鎸夐敭鐘舵€佸凡缁忔縺娲讳笖鏍￠獙閫氳繃鏃讹紝鐢卞綋鍓?Reader 鐨勫乏閿?mousedown 寤虹珛鏈?Reader 浼氳瘽銆?
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
          session.mouseDown = true;
          session.selectionReady = false;
          session.selectionText = "";
          session.selectionTime = Date.now();
          session.popupContext = null;
          self._debugLog("selection translate mouse down: reader=" + (session.reader && session.reader.tabID));
        } catch (e) {}
      }, true);
      win.addEventListener("mouseup", function (ev) {
        try {
          const session = self._selectionTranslateSession;
          if (!session || !session.active || session.win !== win || ev.button !== 0) return;
          session.mouseDown = false;
          session.selectionReady = false;
          session.selectionText = "";
          let selectedText = "";
          try {
            const selection = win.getSelection && win.getSelection();
            selectedText = self._normalizeSelectionTranslateText(selection && selection.toString());
          } catch (e) {}
          if (!selectedText) {
            self._debugLog("selection translate mouse up: result=no-selection");
            return;
          }
          session.selectionReady = true;
          session.selectionText = selectedText;
          session.selectionTime = Date.now();
          self._debugLog("selection translate mouse up: result=selection-ready, text=" + JSON.stringify(selectedText));
          self._tryTriggerSelectionTranslate(session);
        } catch (e) {}
      }, true);
      win.addEventListener("keyup", function (ev) {
        try { self._handleSelectionTranslateGlobalKeyUp(ev, "reader-window"); } catch (e) {}
      }, true);
      // 鈥斺€?閿洏锛氣€滃厛閫夊尯鍚庢寜缁戝畾閿€?鈥斺€?
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
      const sameText = popupText === selectionText;
      if (!sameReader || !sameText) {
        this._debugLog("selection translate popup-skip: reader=" + (!sameReader ? "mismatch" : "ok") + ", doc=not-checked, text=" + (!sameText ? "mismatch" : "ok"));
        return false;
      }
      const triggerText = selectionText;
      const popupDoc = popup.doc;
      const popupButton = popup.button && popup.button.isConnected
        ? popup.button
        : (popupDoc && popupDoc.querySelector ? popupDoc.querySelector(".wordtranslator-add-btn") : null);
      session.selectionReady = false;
      session.selectionText = "";
      session.selectionTime = 0;
      session.popupContext = null;
      this._debugLog("selection translate trigger: text=" + JSON.stringify(triggerText));
      this._handleAddWordTrigger({
        source: "hotkey-selection",
        doc: popupDoc,
        btn: popupButton,
        // append 鍙兘鍦?renderTextSelectionPopup 鍥炶皟鍚屾鎵ц锛?
        // mouseup 闃舵缁濅笉鑳藉啀娆¤皟鐢ㄥ凡澶辨晥鐨?append銆?
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
    // 鍙ュ瓙妯″紡鏀惧鍗曡瘝妯″紡鐨?500 瀛楃闄愬埗锛屼絾淇濈暀 5000 瀛楃瀹夊叏涓婇檺锛?
    // 闃叉璇€夋暣绡?PDF 鍚庣洿鎺ユ彁浜よ繃澶х殑 API 璇锋眰銆?
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

    // 蹇嵎閿?鍒掕瘝缈昏瘧锛氱紦瀛樺綋鍓嶉€変腑鏂囨湰銆?
    // 榧犳爣/鎸夐敭浜嬩欢瀹為檯鍙戠敓鍦?PDF.js 鐨?iframe window锛宲opup 鍑虹幇鏃剁粦瀹氫竴娆°€?
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
      // Reader 鐨?append 鍙湪鏈 renderTextSelectionPopup 鍥炶皟鏍堝唴鏈夋晥銆?
      // 鍥犳蹇呴』鍦ㄨ繖閲屽悓姝ュ垱寤?鎸傝浇鏈彃浠舵寜閽紝涓嶈兘鎶?append 鐣欏埌 mouseup 鍐嶈皟鐢ㄣ€?
      let popupButton = doc && doc.querySelector ? doc.querySelector(".wordtranslator-add-btn") : null;
      if (!popupButton && typeof append === "function") {
        try {
          const label = this._data.contextMenuLabel || "娣诲姞鍗曡瘝骞剁炕璇?;
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
    // 涓衡€滃厛閫夊尯鍚庢寜娣诲姞鍗曡瘝蹇嵎閿€濅繚鐣欐渶鏂版櫘閫氶€夊尯涓婁笅鏂囥€?
    this._selectionFirstPending = { reader: reader, text: text, doc: doc, append: append, time: Date.now() };
    if (this._data.autoTranslate) {
      // 闃叉姈鍘婚噸锛氱浉鍚屾枃鏈?2 绉掑唴涓嶉噸澶嶈嚜鍔ㄦ坊鍔?
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
    // 鍏堥€夊尯鍚庢寜鈥滄坊鍔犲崟璇嶁€濆揩鎹烽敭锛屼互鍙婃櫘閫?popup 鎸夐挳鍒涘缓閫昏緫淇濇寔涓嶅彉銆?
    const label = this._data.contextMenuLabel || "娣诲姞鍗曡瘝骞剁炕璇?;
    const existingButton = doc.querySelector(".wordtranslator-add-btn");
    if (existingButton) {
      existingButton.innerHTML = this._getAddWordButtonHTML(label);
      this._lastSelectionPopup = { doc, reader, button: existingButton, text, time: Date.now() };
      return;
    }

    // Item Pane 鏍囬鍜屼晶鏍忓鑸娇鐢ㄧ粺涓€鐨?icon5.ico锛?
    const btn = this._createAddWordButton(doc, reader, text, this._getAddWordButtonHTML(label));
    append(btn);
    // 涓庣粺涓€瑙﹀彂鍏ュ彛涓€鑷达細缂撳瓨 append 鍚?popup 涓湡瀹炲瓨鍦ㄧ殑鑺傜偣銆?
    const mountedButton = doc.querySelector(".wordtranslator-add-btn") || (btn.isConnected ? btn : null);
    this._lastSelectionPopup = { doc, reader, button: mountedButton, text, time: Date.now() };
  },


  // 蹇嵎閿?鍒掕瘝缈昏瘧锛氱粍鍚堥敭鎸変笅鏃惰Е鍙戠炕璇?
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


  // 鍒涘缓"娣诲姞鍗曡瘝骞剁炕璇?鎸夐挳锛堝甫 SVG 鍥炬爣锛?
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
    const t = String(translation || "").trim() || "姝ｅ湪缈昏瘧鈥?;
    return w ? w + " -- " + t : t;
  },

  _getAddWordButtonHTML(label) {
    const text = String(label || "娣诲姞鍗曡瘝骞剁炕璇?);
    const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // 鏂规 A锛氫娇鐢ㄥ唴鑱?SVG 鍥炬爣锛屼笉渚濊禆 chrome:// 澶栭儴璧勬簮鍔犺浇銆?
    // PDF 鍒掕瘝寮圭獥杩愯鍦?PDF.js iframe 娌欑涓紝鏃犳硶鍔犺浇 chrome:// 鍥剧墖锛?
    // 鍥犳鏀圭敤涓庡弬鑰冩彃浠?zotero-pdf-translate)涓€鑷寸殑鍐呰仈 SVG 鏂瑰紡锛岀‘淇濈ǔ瀹氭樉绀恒€?
    const iconSVG = '<svg class="wordtranslator-add-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle;flex:0 0 16px;" aria-hidden="true"><rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#2a5fdb"/><text x="8" y="8" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#ffffff">word</text><text x="8" y="13" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="3.5" fill="#ffffff">缈昏瘧</text></svg>';
    return iconSVG + "<span>" + safe + "</span>";
  },

  // 鎶婃寜閽師鍦版浛鎹负鍙紪杈戞枃鏈锛涘凡鏈夌紪杈戞鏃跺厛鎭㈠鎸夐挳
  _showTempEditArea(doc, btn, reader, text, translation) {
    try {
      if (this._tempEditState) this._restoreButtonFromTempEdit();
      if (!doc || !btn || !btn.isConnected) return;
      const textarea = doc.createElement("textarea");
      textarea.className = "wordtranslator-temp-edit";
      textarea.rows = 1;
      textarea.value = this._formatTempEditText(text, translation);
      textarea.placeholder = "姝ｅ湪缈昏瘧鈥?;
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
      this._resizeTempEditArea(textarea);
      btn.replaceWith(textarea);
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
      textarea.style.height = "auto";
      const view = textarea.ownerDocument && textarea.ownerDocument.defaultView;
      const style = view && view.getComputedStyle ? view.getComputedStyle(textarea) : null;
      const lineHeight = parseFloat(style && style.lineHeight) || 18;
      const maxHeight = lineHeight * 3.2;
      const minHeight = lineHeight * 1.35;
      const next = Math.max(minHeight, Math.min(textarea.scrollHeight || minHeight, maxHeight));
      textarea.style.height = next + "px";
      textarea.style.overflowY = (textarea.scrollHeight || 0) > maxHeight ? "auto" : "hidden";
    } catch (e) {}
  },

  // 缈昏瘧瀹屾垚鍚庢洿鏂颁复鏃剁紪杈戞鍐呭
  _updateTempEditArea(word, translation) {
    const st = this._tempEditState;
    if (!st || !st.textarea || !st.textarea.isConnected) return;
    try {
      const cur = String(st.text || "").trim().toLowerCase();
      const tgt = String(word || "").trim().toLowerCase();
      if (!cur || cur !== tgt) return;
      st.textarea.value = this._formatTempEditText(st.text, translation);
      st.textarea.placeholder = translation ? "" : "姝ｅ湪缈昏瘧鈥?;
      this._resizeTempEditArea(st.textarea);
    } catch (e) {
      this._debugLog("_updateTempEditArea ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // 鍙栨秷閫変腑/澶栭儴鐐瑰嚮/涓嬩竴娆＄炕璇戞椂锛氱紪杈戞鎭㈠涓烘寜閽?
  _restoreButtonFromTempEdit() {
    const st = this._tempEditState;
    if (!st) return;
    this._tempEditState = null;
    this._unbindTempEditAutoClose();
    try {
      const { doc, textarea, reader, text } = st;
      if (!doc || !textarea || !textarea.isConnected) return;
      const label = (this._data && this._data.contextMenuLabel) || "娣诲姞鍗曡瘝骞剁炕璇?;
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

  // 澶栭儴 mousedown锛圥DF 椤甸潰/寮瑰嚭灞傦級鏃惰嚜鍔ㄦ仮澶嶆寜閽?
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

  // 瑙ｆ瀽閿洏蹇嵎閿?spec锛屽 "ctrl+d"銆?alt+1"銆?ctrl"銆?shift"銆?
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

  // 鍖归厤閿洏浜嬩欢锛坘eydown/keyup锛変笌鑷畾涔夊揩鎹烽敭 spec
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

  // 鍖归厤"浜嬩欢鏃惰褰曠殑淇グ閿姸鎬?涓庤嚜瀹氫箟閿洏 spec锛堜笉渚濊禆 ev 瀵硅薄锛屼緵 popup 璺緞浣跨敤锛?
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

  // 褰撳墠鏄惁鍚敤鑷畾涔夊揩鎹烽敭锛堝垝璇嶇炕璇戯級
  _customHotkeyActive() {
    return !!(this._data && this._data.customHotkeyEnabled && this._data.customHotkey);
  },

  // 鍒掕瘝缈昏瘧蹇嵎閿槸鍚﹀浜庡彲鐢ㄧ姸鎬侊細
  // 棰勮缁勫悎閿紙hotkeyEnabled锛変笌鑷畾涔夊揩鎹烽敭锛坈ustomHotkeyEnabled锛変簩閫変竴锛屼换涓€寮€鍚嵆瑙嗕负鍙敤銆?
  _selectionHotkeyActive() {
    return !!(this._data && (this._data.hotkeyEnabled || this._data.customHotkeyEnabled));
  },

  // 褰撳墠鏄惁鍚敤鈥滄坊鍔犲崟璇嶁€濆揩鎹烽敭锛堝悎骞舵柟妗堬細鍏堥€夊尯鍚庢寜缁戝畾閿級
  // mode: "ctrl" | "alt" | "shift" | "custom"
  _addWordHotkeyActive() {
    if (!this._data || !this._data.addWordHotkeyEnabled) return false;
    const mode = this._data.addWordHotkeyMode || "custom";
    if (mode === "ctrl" || mode === "alt" || mode === "shift") return true;
    if (mode === "custom") return !!this._data.addWordHotkey;
    return false;
  },

  // 褰撳墠鈥滄坊鍔犲崟璇嶁€濆揩鎹烽敭瀵瑰簲鐨勫疄闄?spec锛堢敤浜庤繍琛屾椂鍖归厤锛?
  _addWordHotkeySpec() {
    if (!this._data) return "";
    const mode = this._data.addWordHotkeyMode || "custom";
    if (mode === "ctrl" || mode === "alt" || mode === "shift") return mode;
    if (mode === "custom") return this._data.addWordHotkey || "";
    return "";
  },

  // 鈥滃厛閫夊尯鍚庢寜缁戝畾閿€濓細鎸変笅缁戝畾閿紙keydown 瑙﹀彂锛屼笉瑕佹眰 keyup锛夋椂锛?
  // 鑻ュ綋鍓嶇紦瀛樹簡閫変腑鏂囨湰锛坃hotkeyPending锛夛紝鍒欑珛鍗虫墽琛屻€屾坊鍔犲崟璇嶅苟缈昏瘧銆嶃€?
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
        // Shift 鍦?PDF 涓敤浜庢暣娈佃繛閫夛紙鐐?A 鈫?Shift+鐐?B锛夛紝浠呬綔涓衡€滃厛閫夊尯鍚庢寜缁戝畾閿€濈殑缁戝畾閿娇鐢?
        return (ev.key === "Shift" || ev.key === "shift") && !ev.ctrlKey && !ev.altKey;
      }
      if (d.addWordHotkeyMode === "custom") {
        const p = this._parseHotkeySpec(d.addWordHotkey || "");
        if (!p || p.mouse) return false;
        const k = (ev.key || "").toLowerCase();
        // 绾慨楗伴敭褰曞埗锛堝 Ctrl / Alt / Shift锛?
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
  // 鑺傛祦绛栫暐锛氶粯璁?250ms 鍐呭彧璇讳竴娆＄鐩橈紝閬垮厤楂橀鐑矾寰勶紙mousedown/keydown/keyup锛?
  // 鍙嶅 IO 閫犳垚鍗￠】锛堢壒鍒槸鑷畾涔夊揩鎹烽敭 Ctrl+C 绛夌粍鍚堥敭鏃惰〃鐜版槑鏄撅級銆?
  // 鍚屾椂浣跨敤 mtime 瀵规瘮鈥斺€旀枃浠舵湭鍙樺寲鍒欏畬鍏ㄨ烦杩囧弽搴忓垪鍖栥€?
  _refreshPrefsFromStorage(force) {
    try {
      const now = Date.now();
      if (!force && this._lastPrefsRefresh && (now - this._lastPrefsRefresh) < 250) {
        return true;
      }
      if (!Zotero || !Zotero.WordTranslatorStorage) return false;
      // 璇诲彇纾佺洏 mtime
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

  // 寮哄埗澶辨晥缂撳瓨锛屼娇涓嬩竴娆?_refreshPrefsFromStorage() 涓€瀹氫細璇荤洏銆?
  // preferences.js 鐨?save() 鍦ㄥ啓鐩樺悗浼氳皟鐢ㄦ鏂规硶锛岀‘淇濆紑鍏崇姸鎬佺珛鍗崇敓鏁堛€?
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
      // 榧犳爣鎸夐敭缁勫悎宸茶縼绉昏嚦"娣诲姞鍗曡瘝骞剁炕璇?鍔熻兘锛涙澶勫彧澶勭悊閿洏缁勫悎閿€?
      // 榧犳爣鎸夐敭缁勫悎宸茶縼绉昏嚦鈥滄坊鍔犲崟璇嶅苟缈昏瘧鈥濆姛鑳斤紱姝ゅ浠呭鐞嗛敭鐩樹慨楗伴敭锛?
      // 涓嶅啀鍥?mouse 瀛楁璇潃锛堟寜浣?Alt/Ctrl 鍒掕瘝鏃?mousedown 璁板綍鍚?mouse 瀛楁锛?
      if (mods && (mods.mouse !== undefined && mods.mouse !== null) && !c && !s && !a) {
        return false;
      }
      // hotkeyModifier 鍙帴鍙楅敭鐩樹慨楗伴敭锛涘巻鍙查紶鏍囧€肩粺涓€瑙嗕负鏃犳晥閰嶇疆銆?
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

  _clearSelectionHotkeyState(reason) {
    this._debugLog("clear selection hotkey state: " + (reason || "unknown"));
  },

  _hasFreshPendingSelection() {
    const pending = this._selectionFirstPending;
    return !!(pending && pending.text && Date.now() - (pending.time || 0) <= 10000);
  },

  // 鍒ゆ柇 keyup 閲婃斁鐨勬槸鍚︿负褰撳墠鍒掕瘝缈昏瘧蹇嵎閿殑鎸夐敭鏈綋
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

  // 褰撳墠閫変腑鏂囨湰鏄惁鏈夋湁鏁堚€滃厛閫夊尯鍚庢寜缁戝畾閿€濈紦瀛?
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

  // 鍏堥€夊尯鍚庢寜鈥滄坊鍔犲崟璇嶁€濆揩鎹烽敭鐨勯€傞厤鍣紱涓嶅睘浜庡揩鎹烽敭-鍒掕瘝缈昏瘧浼氳瘽銆?
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

      // 蹇嵎閿矾寰勫彧璐熻矗閫傞厤閫夊尯缂撳瓨锛孶I 鐢熷懡鍛ㄦ湡鍜屼笟鍔″鐞嗙粺涓€浜ょ粰鍏ュ彛鍑芥暟銆?
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
          "鏃犳硶鑾峰彇褰撳墠 PDF 瀵瑰簲鐨勬潯鐩?ID銆傝鏌ョ湅 startup-debug.log銆?
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
      // 閲嶅閫変腑瑙嗕负涓€娆℃渶杩戜娇鐢細淇濈暀鍚屼竴涓?card锛屼笉閲嶅璋冪敤 API锛?
      // 浣嗗皢鍏剁Щ鍔ㄥ埌鍘熷鏁扮粍鏈熬锛屼氦鐢卞綋鍓?sortMode 閲嶆柊璁＄畻鏄剧ず浣嶇疆銆?
      try {
        const existingTranslation = String(existingCard.translation || "").trim();
        if (existingTranslation && existingTranslation !== "缈昏瘧涓€?) {
          this._updateTempEditArea(normWord, existingTranslation);
        }
        const existingIndex = list.indexOf(existingCard);
        if (existingIndex >= 0 && existingIndex !== list.length - 1) {
          list.splice(existingIndex, 1);
          list.push(existingCard);
          this._itemWords.set(Number(paneID), list);
          this._persistWords();
          this._applyWordBookView(Number(paneID), { source: "duplicate-reorder" });
        }
      } catch (e) {
        this._debugLog("duplicate recent-use update ERROR: " + (e && (e.message || String(e))));
      }
      return;
    }
    const card = { word: normWord, translation: "缈昏瘧涓€?, pending: true };
    list.push(card);
    this._itemWords.set(Number(paneID), list);
    this._persistWords();
    this._debugLog("_addWordForReader added: paneID=" + paneID + ", count=" + list.length);

    // 鏂板崟璇嶅姞鍏ュ悗鍥炲埌绗?1 椤碉紝渚夸簬鐢ㄦ埛纭鍒氬姞鍏ョ殑璇嶏紙淇濈暀鎼滅储璇嶏級
    try {
      const st = this._getWordBookViewState(Number(paneID));
      if (st && st.page !== 1) {
        st.page = 1;
        this._wordBookViewState.set(Number(paneID), st);
      }
    } catch (e) {}

    this._applyWordBookView(Number(paneID), { source: "addWord" });

    try {
      const api = this.getActiveApi();
      this._debugLog(
        "translate start: api=" + JSON.stringify(api ? {
          name: api.name, provider: api.provider,
          baseUrl: api.baseUrl, model: api.model, hasKey: !!api.apiKey
        } : null)
      );
      const result = await this.translate(word);
      card.translation = result || "缈昏瘧澶辫触";
      this._debugLog("translate success: " + JSON.stringify(card.translation));
    } catch (e) {
      card.translation = "缈昏瘧澶辫触";
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
      // 鍏滃簳锛氳嫢褰撳墠婵€娲荤殑 Item Pane 涓庢湰鍗＄墖褰掑睘鐨?paneID 鐩稿悓锛?
      // 鐩存帴閲嶆覆鏌撳綋鍓?body锛岀‘淇濆崟璇嶆湰绔嬪嵆鏄剧ず鏂板崱鐗?鏂扮炕璇?
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
    this._persistWords();
    this._applyWordBookView(id, { source: "delete" });
  },

  async _retryTranslationForCard(itemID, index, card) {
    const id = Number(itemID);
    const list = this._itemWords.get(id);
    const currentCard = list && list[index];
    if (!list || !currentCard || currentCard !== card) return;

    currentCard.translation = "缈昏瘧涓€?;
    currentCard.pending = true;
    this._persistWords();
    this._applyWordBookView(id, { source: "retry-translate" });

    try {
      const result = await this.translate(currentCard.word);
      currentCard.translation = result || "缈昏瘧澶辫触";
    } catch (e) {
      currentCard.translation = "缈昏瘧澶辫触";
    } finally {
      currentCard.pending = false;
      this._flushAndPersistWords();
      this._applyWordBookView(id, { source: "retry-translate-finish" });
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
      // 1. 鍏堝皾璇曚娇鐢?Zotero.Utilities.openPreferences 鎵撳紑鏈彃浠堕厤缃潰鏉?
      try {
        if (Zotero && Zotero.Utilities && typeof Zotero.Utilities.openPreferences === "function") {
          Zotero.Utilities.openPreferences(this._paneID || "wordtranslator-prefs");
          this._debugLog("opened via Zotero.Utilities.openPreferences");
          return;
        }
      } catch (e1) {
        this._debugLog("Zotero.Utilities.openPreferences ERROR: " + (e1 && e1.message || e1));
      }
      // 2. 鍥為€€锛氱洿鎺ユ墦寮€ Zotero 鍋忓ソ璁剧疆绐楀彛锛堜笉鍒囨崲鍒版湰鎻掍欢 tab锛?
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
      // 浼樺厛锛氬彧瀵瑰綋鍓?pane 閲岀殑 .wt-card-text 璁剧疆瀛楀彿
      const cur = this._currentPane;
      if (cur && cur.body) {
        const nodes = cur.body.querySelectorAll(".wt-card-text");
        for (let i = 0; i < nodes.length; i++) nodes[i].style.fontSize = fs + "px";
        this._debugLog("applyFontSizeToPane: " + fs + "px applied to " + nodes.length + " .wt-card-text via _currentPane");
        return;
      }
      // 鍥為€€锛氭壂鎻忎富 doc锛堝彲鑳藉湪鍚屼竴 doc 涓級
      const win = Zotero.getMainWindow();
      const doc = win && win.document;
      if (!doc) return;
      const nodes = doc.querySelectorAll(".wt-card-text");
      let n = 0;
      for (let i = 0; i < nodes.length; i++) { nodes[i].style.fontSize = fs + "px"; n++; }
      // 鍐嶅洖閫€锛氶亶鍘嗘墍鏈夊凡鐭?paneUID锛屽姣忎釜鐢?dataset.wtPaneUid 鎵?body
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
      // 浠呭綋璇诲埌鏈夋晥鏁版嵁鏃舵墠瑕嗙洊鍐呭瓨涓殑 _data锛?
      // 璇诲埌绌烘椂淇濈暀鐜版湁 _data锛堥伩鍏嶅啓鍏ュけ璐ュ鑷村唴瀛樿鍐叉帀锛?
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

  // 寮哄埗鎸夊綋鍓?Zotero.ItemPane 婵€娲荤殑 item id 閲嶆覆鏌撳崟璇嶆湰 body
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
    this._wordBookViewState.set(id, { page: 1, search: "" }); // 娓呯┖鍚庡洖鍒扮 1 椤靛苟娓呯┖鎼滅储
    this._persistWords();
    this._applyWordBookView(id, { source: "clear" });
  },

  // ---------- 娉ㄥ唽 Item Pane 闈㈡澘 ----------
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

  // DOM 鍏滃簳锛欶luent 鏈姞杞芥椂鐩存帴璁剧疆 header label 鍜?sidenav tooltiptext
  _applyPaneL10nFallback(doc, body) {
    try {
      if (!doc || !body) return;
      const isZh = Zotero.locale && Zotero.locale.startsWith("zh");
      const headerLabel = isZh ? "鍗曡瘝鏈? : "Word List";
      const sidenavTooltip = isZh ? "鍗曡瘝缈昏瘧" : "Word Translator";
      // 鍚戜笂鏌ユ壘 item-pane-section 瀹瑰櫒
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
        // sidenav tooltiptext锛堝湪 sidebar 渚э級
        const sidenavBtn = doc.querySelector('[data-pane-id="wordtranslator"]');
        if (sidenavBtn) {
          sidenavBtn.setAttribute("tooltiptext", sidenavTooltip);
          sidenavBtn.setAttribute("title", sidenavTooltip);
        }
      }
      // 鍙︿竴绉嶇粨鏋勶細鐩存帴鍦?sidenav-toolbar 鍐呮煡鎵?
      const sidenavBtns = doc.querySelectorAll('[data-pane-id="wordtranslator"], [data-pane="wordtranslator"]');
      for (const btn of sidenavBtns) {
        if (btn.classList && (btn.classList.contains("sidenav-button") || btn.tagName === "toolbarbutton" || btn.getAttribute("data-l10n-id") === "wordtranslator-itemPaneSection-sidenav")) {
          btn.setAttribute("tooltiptext", sidenavTooltip);
          btn.setAttribute("title", sidenavTooltip);
        }
      }
      // 鏈€鍚庡厹搴曪細閮ㄥ垎 Zotero 鐗堟湰鎶?l10n 鑺傜偣鏀惧湪鐙珛鐨勪富绐楀彛鏂囨。涓紝
      // 閫氳繃 data-l10n-id 鐩存帴瀹氫綅骞跺啓鍏ュ師鐢?tooltip 灞炴€с€?
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
        // null/undefined/false 琛ㄧず涓嶈缃灞炴€э紱灏ゅ叾閬垮厤 disabled=null 浠嶈鎸夐挳杩涘叆绂佺敤鎬併€?
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

  // ---------- 鍗曡瘝鏈垎椤典笌鎼滅储锛堜复鏃剁晫闈㈢姸鎬侊紝涓嶅啓鐩橈級 ----------
  _getWordBookViewState(itemID) {
    let st = this._wordBookViewState.get(Number(itemID));
    if (!st) {
      st = { page: 1, search: "" };
      this._wordBookViewState.set(Number(itemID), st);
    }
    return st;
  },

  // 鎼滅储鍖归厤 鈫?鎺掑簭 鈫?鍒嗛〉銆傝繑鍥?{ indices, page, pageCount, total }
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

  // 瑙﹀彂灞傦細涓€娆?input 鍙骇鐢熶竴涓悳绱簨浠讹紝闃叉姈鍚庝氦缁欑粺涓€鍚庣疆澶勭悊鍣ㄣ€?
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
      // _refreshItemPane 浼氶噸寤?input锛涢噸寤哄悗鎭㈠鐒︾偣鍜屽厜鏍囦綅缃紝淇濊瘉鍙繛缁緭鍏ャ€?
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

  // 鎼滅储浜嬩欢瑙﹀彂鍚庨€昏緫锛氭洿鏂拌鍥剧姸鎬侊紝骞剁粺涓€鎵ц妫€绱€佹帓搴忋€佸垎椤靛拰閲嶆覆鏌撱€?
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

  // 缁熶竴鐨勫崟璇嶆湰瑙嗗浘鏇存柊璋冨害锛氭绱?鈫?鎺掑簭 鈫?鍒嗛〉 鈫?閲嶆覆鏌撱€傛墍鏈変笟鍔¤Е鍙戠偣姹囪仛浜庢銆?
  _applyWordBookView(itemID, options) {
    const id = Number(itemID);
    if (!Number.isFinite(id) || id <= 0) return;
    const opts = options || {};
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

  // 杩斿洖闇€瑕佹樉绀虹殑"绌烘€?鎼滅储鏃犵粨鏋?鎻愮ず鑺傜偣锛涙湁缁撴灉鏃惰繑鍥?null
  _getEmptyHint(doc, rawWords, search, pageInfo) {
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
    const txt = (s) => this._createTxt(doc, s);
    const kw = String(search || "").trim();
    if (rawWords.length === 0) {
      return el("div", { style: "color:#888;font-size:12px;padding:6px 4px;" }, [
        txt("鏆傛棤鍗曡瘝銆傛墦寮€ PDF 鍒掕瘝鍚庯紝鐐瑰嚮銆? + (this._data && this._data.contextMenuLabel || "娣诲姞鍗曡瘝骞剁炕璇?) + "銆嶅嵆鍙姞鍏ャ€?)
      ]);
    }
    // 鍙湪杩囨护鍚庣殑缁撴灉纭疄涓虹┖鏃舵墠鏄剧ず"鏈壘鍒?鎻愮ず
    if (kw && pageInfo && pageInfo.indices && pageInfo.indices.length === 0) {
      return el("div", { style: "color:#888;font-size:12px;padding:6px 4px;" }, [
        txt("鏈壘鍒颁笌" + kw + "鍖归厤鐨勫崟璇嶃€?)
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
    const map = { forward: "椤哄簭", reverse: "鍊掑簭", alpha: "瀛楁瘝" };
    return map[mode] || "鍊掑簭";
  },

  _renderPaneBody(doc, body, item) {
    // 浣跨敤 HTML 鍛藉悕绌洪棿鍒涘缓鍏冪礌锛坆ody 鏄?html:div锛宒oc 鏄?XUL document锛?
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
    const txt = (s) => this._createTxt(doc, s);

    // 浼樺厛绾э細onRender 浼犲叆鐨?item.id 鈫?body.dataset.paneItemID锛坃refreshItemPane 鏄惧紡鏍囪锛?
    // 鈫?body.dataset.itemID锛坥nItemChange 淇濆瓨锛夆啋 #zotero-item-pane 鐨?data-itemid銆?
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

    // 缂撳瓨 panelUID 鐢ㄤ簬鍚庣画鍒锋柊
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

    // 澶撮儴閲囩敤涓よ甯冨眬锛氱涓€琛屾槸鈥滃浘鏍?+ 鍗曡瘝鏈?+ 鑿滃崟 + 娓呯┖鈥濓紝绗簩琛屾槸 API 鍜屽父鐢ㄦ搷浣溿€?
    const header = el("div", { style: "display:flex;flex-direction:column;gap:5px;margin:0 0 8px;width:100%;padding:0 0 6px;border-bottom:1px solid rgba(0,0,0,0.08);box-sizing:border-box;" });
    const titleRow = el("div", { style: "display:flex;align-items:center;gap:6px;width:100%;min-width:0;min-height:26px;" });
    const controlsRow = el("div", { style: "display:flex;align-items:center;gap:5px;width:100%;min-width:0;min-height:26px;" });
    const titleGroup = el("div", { style: "display:flex;align-items:center;gap:6px;flex:1;min-width:0;" });
    const titleActions = el("div", { style: "display:flex;align-items:center;gap:6px;flex-shrink:0;" });

    const title = el("strong", { title: "鍗曡瘝鏈?, style: "white-space:nowrap;font-size:14px;line-height:20px;" }, [txt("鍗曡瘝鏈?)]);
    titleGroup.append(title);

    const apiSelect = el("select", { style: "flex:1;min-width:0;font-size:12px;padding:2px 6px;", title: "鍒囨崲缈昏瘧 API", "aria-label": "褰撳墠缈昏瘧 API" });
    this._fillApiSelect(doc, apiSelect);
    apiSelect.addEventListener("change", () => {
      const idx = parseInt(apiSelect.value, 10);
      this._setActiveApiForItem(itemID, idx);
    });
    controlsRow.append(apiSelect);

    const compactButtonStyle = "width:28px;height:26px;padding:0;border:1px solid rgba(0,0,0,0.16);background:rgba(255,255,255,0.72);border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#555;box-sizing:border-box;flex:0 0 28px;";
    const refreshBtn = el("button", { title: "鍒锋柊鏈嶅姟鍟嗗垪琛?, "aria-label": "鍒锋柊鏈嶅姟鍟嗗垪琛?, style: compactButtonStyle }, []);
    refreshBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"23 4 23 10 17 10\"></polyline><polyline points=\"1 20 1 14 7 14\"></polyline><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"></path></svg>";
    refreshBtn.addEventListener("click", () => this._refreshProvidersInAllPanes(itemID));
    controlsRow.append(refreshBtn);

    const settingsBtn = el("button", { title: "璁剧疆", "aria-label": "璁剧疆", style: compactButtonStyle }, []);
    settingsBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"3\" y1=\"6\" x2=\"21\" y2=\"6\"></line><line x1=\"3\" y1=\"12\" x2=\"21\" y2=\"12\"></line><line x1=\"3\" y1=\"18\" x2=\"21\" y2=\"18\"></line></svg>";
    settingsBtn.addEventListener("click", () => this._openPreferencesPane());
    titleActions.append(settingsBtn);

    const sortBtn = el("button", { title: this._getSortLabel(this._sortMode), "aria-label": "鍒囨崲鎺掑簭鏂瑰紡", style: compactButtonStyle }, []);
    if (this._sortMode === "reverse") {
      sortBtn.textContent = "鍊?;
    } else if (this._sortMode === "forward") {
      sortBtn.textContent = "姝?;
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
      // 鎺掑簭鏀瑰彉鍚庡洖鍒扮 1 椤碉紙淇濈暀鎼滅储璇嶏級锛岀粺涓€璧?_applyWordBookView銆?
      this._applyWordBookView(itemID, { source: "sort", page: 1 });
    });
    controlsRow.append(sortBtn);

    const zoomInBtn = el("button", { title: "鏀惧ぇ瀛椾綋", "aria-label": "鏀惧ぇ瀛椾綋", style: compactButtonStyle }, []);
    zoomInBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><text x=\"6\" y=\"17\" font-size=\"14\" font-family=\"Arial, sans-serif\" font-weight=\"700\" stroke=\"none\" fill=\"currentColor\">A</text><polyline points=\"16,4 19,1 22,4\"></polyline><line x1=\"19\" y1=\"1\" x2=\"19\" y2=\"7\"></line></svg>";
    zoomInBtn.addEventListener("click", () => this._onZoomFontSize(itemID, +1));
    controlsRow.append(zoomInBtn);

    const zoomOutBtn = el("button", { title: "缂╁皬瀛椾綋", "aria-label": "缂╁皬瀛椾綋", style: compactButtonStyle }, []);
    zoomOutBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><text x=\"6\" y=\"17\" font-size=\"11\" font-family=\"Arial, sans-serif\" font-weight=\"700\" stroke=\"none\" fill=\"currentColor\">A</text><polyline points=\"16,7 19,10 22,7\"></polyline><line x1=\"19\" y1=\"10\" x2=\"19\" y2=\"4\"></line></svg>";
    zoomOutBtn.addEventListener("click", () => this._onZoomFontSize(itemID, -1));
    controlsRow.append(zoomOutBtn);

    const clearBtn = el("button", { title: "娓呯┖褰撳墠鏉＄洰鐨勫叏閮ㄥ崟璇?, "aria-label": "娓呯┖褰撳墠鏉＄洰鐨勫叏閮ㄥ崟璇?, style: "height:26px;padding:0 9px;border:1px solid rgba(0,0,0,0.16);background:rgba(255,255,255,0.72);border-radius:6px;cursor:pointer;font-size:12px;line-height:24px;box-sizing:border-box;white-space:nowrap;" }, [txt("娓呯┖")]);
    clearBtn.addEventListener("click", () => this._clearAllWordsForItem(itemID));
    titleActions.append(clearBtn);

    titleRow.append(titleGroup, titleActions);

    // 绗笁琛岋細鎼滅储 + 缈婚〉锛堟柊澧烇紝涓嶅奖鍝嶄笂闈袱琛屾帓鐗堬級
    const pageSize = Math.max(1, Number(this._data && this._data.pageSize) || 10);
    const view = this._getWordBookViewState(itemID);
    const pageInfo = item && item.viewInfo
      ? item.viewInfo
      : this._computePagedIndices(rawWords, this._sortMode, view.search, view.page, pageSize, this._getActiveSearchStrategyName());
    // 鑻ュ綋鍓嶉〉瓒呭嚭鑼冨洿鍒欒嚜鍔ㄦ敹鎷㈠埌鏈€鍚庝竴椤碉紙渚嬪娓呯┖/鍒犻櫎鍚庯級
    if (view.page !== pageInfo.page) {
      this._wordBookViewState.set(itemID, { page: pageInfo.page, search: view.search });
      view.page = pageInfo.page;
    }
    const navRow = el("div", { style: "display:flex;align-items:center;gap:6px;width:100%;min-width:0;min-height:26px;margin-top:2px;" });
    const searchInput = el("input", {
      type: "search",
      placeholder: "鎼滅储鍗曡瘝鎴栭噴涔夆€?,
      title: "鎼滅储鍗曡瘝鎴栦腑鏂囬噴涔夛紙鍚屾椂鍖归厤鍗曡瘝涓庣炕璇戯級",
      style: "flex:1;min-width:0;font-size:12px;padding:3px 8px;border:1px solid rgba(0,0,0,0.16);border-radius:6px;background:rgba(255,255,255,0.72);color:#222;box-sizing:border-box;",
    });
    searchInput.value = view.search;
    searchInput.addEventListener("input", (ev) => {
      // 涓枃杈撳叆娉曞悎鎴愪腑涓嶈Е鍙戞悳绱紙鎷奸煶鈫掗€夊瓧杩囩▼锛夛紝鍚堟垚瀹屾垚鍚庣殑 input 浜嬩欢 isComposing=false 姝ｅ父瑙﹀彂
      if (ev.isComposing) return;
      this._onWordBookSearchTrigger(itemID, searchInput.value);
    });
    searchInput.addEventListener("compositionend", () => {
      // 鍏煎锛氶儴鍒嗘祻瑙堝櫒 compositionend 鍚庡彲鑳戒笉瑙﹀彂 isComposing=false 鐨?input
      this._onWordBookSearchTrigger(itemID, searchInput.value);
    });
    navRow.append(searchInput);

    const prevBtn = el("button", { title: "涓婁竴椤?, "aria-label": "涓婁竴椤?, disabled: pageInfo.page <= 1 ? "disabled" : null, style: "height:26px;min-width:28px;padding:0 8px;border:1px solid rgba(0,0,0,0.16);background:rgba(255,255,255,0.72);border-radius:6px;cursor:pointer;font-size:13px;line-height:24px;color:#555;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;" }, [txt("鈥?)]);
    prevBtn.addEventListener("click", () => this._setWordBookPage(itemID, pageInfo.page - 1));
    navRow.append(prevBtn);

    const pageInput = el("input", {
      type: "text",
      inputmode: "numeric",
      pattern: "[0-9]*",
      min: "1",
      max: String(Math.max(1, pageInfo.pageCount)),
      title: "杈撳叆椤电爜鍚庢寜鍥炶溅鎴栫偣鍑烩€滆烦鈥?,
      "aria-label": "褰撳墠椤?,
      style: "width:44px;font-size:12px;padding:3px 4px;text-align:center;border:1px solid rgba(0,0,0,0.16);border-radius:6px;background:rgba(255,255,255,0.72);color:#222;box-sizing:border-box;flex:0 0 auto;",
    });
    pageInput.value = String(pageInfo.page);

    // 椤电爜妗嗗彧鍏佽杈撳叆 ASCII 鏁板瓧锛涚矘璐存垨杈撳叆涓枃/鑻辨枃鏃剁珛鍗宠繃婊ゃ€?
    pageInput.addEventListener("input", () => {
      const digitsOnly = String(pageInput.value || "").replace(/[^0-9]/g, "");
      if (pageInput.value !== digitsOnly) pageInput.value = digitsOnly;
    });

    // Enter 涓庘€滆烦鈥濇寜閽叡鐢ㄥ悓涓€涓烦杞嚱鏁帮紝閬垮厤涓ゅ閫昏緫浜х敓宸紓銆?
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
      title: "璺宠浆鍒拌緭鍏ョ殑椤电爜",
      "aria-label": "璺宠浆鍒拌緭鍏ョ殑椤电爜",
      style: "height:26px;padding:0 7px;border:1px solid rgba(0,0,0,0.16);background:rgba(255,255,255,0.72);border-radius:6px;cursor:pointer;font-size:12px;line-height:24px;color:#555;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;",
    }, [txt("璺?)]);
    jumpBtn.addEventListener("click", () => {
      this._debugLog("pagination jump button click: itemID=" + itemID);
      jumpToInputPage();
    });
    navRow.append(jumpBtn);

    const totalLabel = el("span", { style: "font-size:12px;color:#666;white-space:nowrap;flex:0 0 auto;" }, [txt(" / " + pageInfo.pageCount)]);
    navRow.append(totalLabel);

    const nextBtn = el("button", { title: "涓嬩竴椤?, "aria-label": "涓嬩竴椤?, disabled: pageInfo.page >= pageInfo.pageCount ? "disabled" : null, style: "height:26px;min-width:28px;padding:0 8px;border:1px solid rgba(0,0,0,0.16);background:rgba(255,255,255,0.72);border-radius:6px;cursor:pointer;font-size:13px;line-height:24px;color:#555;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;" }, [txt("鈥?)]);
    nextBtn.addEventListener("click", () => this._setWordBookPage(itemID, pageInfo.page + 1));
    navRow.append(nextBtn);

    header.append(titleRow, controlsRow, navRow);
    body.append(header);

    // 鍗＄墖鍒楄〃
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

    // CSS锛堟敞鍏ヤ竴娆★紝鎸傚湪 body 鍐呴儴鏈€瀹夊叏锛?
    if (!body.querySelector(".wordtranslator-pane-style")) {
      const style = doc.createElementNS(HTML_NS, "style");
      style.className = "wordtranslator-pane-style";
      style.textContent = this._getPaneCSS();
      body.append(style);
    }
    // 淇濆瓨褰撳墠 pane 鐨?doc / body 寮曠敤锛屼互渚跨偣鍑绘斁澶?缂╁皬鎸夐挳鍚庡彧瀵瑰崱鐗囨枃鏈姩鎬佽皟鏁?
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
    // 鏂囨湰閮ㄥ垎鍖呭湪涓€涓鍣ㄩ噷锛屽彧瀵瑰畠搴旂敤瀛楀彿锛屽苟涓斿彲琚€変腑
    const textWrap = el("div", { class: "wt-card-text", style: "flex:1;min-width:0;font-size:" + fsVal + "px;line-height:1.5;user-select:text;-webkit-user-select:text;cursor:text;" });
    const wordEl = el("span", { class: "wt-card-word", style: "font-weight:600;color:#1e88e5;word-break:break-word;" }, [txt(w.word)]);
    const arrowEl = el("span", { class: "wt-card-arrow", style: "color:#666;flex-shrink:0;margin:0 2px;" }, [txt(" -- ")]);
    const transEl = el("span", { class: "wt-card-trans", style: "word-break:break-word;" + (w.pending ? "color:#999;" : "") }, [txt(w.translation)]);
    textWrap.append(wordEl, arrowEl, transEl);
    const actionWrap = el("div", { style: "display:flex;align-items:center;gap:2px;flex-shrink:0;" });
    const retryBtn = el("button", { title: "閲嶆柊缈昏瘧", "aria-label": "閲嶆柊缈昏瘧", style: "flex-shrink:0;border:none;background:transparent;color:#999;cursor:pointer;font-size:16px;padding:2px 5px;border-radius:4px;line-height:1;" }, [txt("鈫?)]);
    retryBtn.addEventListener("click", () => this._retryTranslationForCard(itemID, idx, w));
    const delBtn = el("button", { title: "鍒犻櫎", "aria-label": "鍒犻櫎", style: "flex-shrink:0;border:none;background:transparent;color:#999;cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;" }, [txt("鉁?)]);
    delBtn.addEventListener("click", () => this._deleteWordForItem(itemID, idx));
    actionWrap.append(retryBtn, delBtn);
    card.append(textWrap, actionWrap);
    return card;
  },

  _fillApiSelect(doc, select) {
    select.replaceChildren();
    const apis = (this._data && this._data.apis) || [];
    if (apis.length === 0) {
      const opt = doc.createElementNS("http://www.w3.org/1999/xhtml", "option");
      opt.value = "-1";
      opt.textContent = "鏈厤缃?API";
      select.append(opt);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    apis.forEach((api, i) => {
      const opt = doc.createElementNS("http://www.w3.org/1999/xhtml", "option");
      opt.value = String(i);
      opt.textContent = (api.name || "API " + (i + 1)) + (api.model ? "锛? + api.model + "锛? : "");
      select.append(opt);
    });
    const cur = (this._data && this._data.activeApiIndex) || 0;
    select.value = String(Math.min(cur, apis.length - 1));
  },

  _getPaneCSS() {
    return ".wordtranslator-pane-body button:hover { background: rgba(0,0,0,0.06); } .wordtranslator-pane-body select { color: #222; background: #fff; } .wt-card-text { user-select: text; -webkit-user-select: text; cursor: text; }";
  },

  // ---------- 鍋忓ソ闈㈡澘 onload ----------
  onPrefsLoad(event) {
    // preferences.js 宸茬敱 PreferencePanes.register 鐨?scripts[] 鍦ㄦ矙绠变腑鑷姩鍔犺浇锛?
    // 杩欓噷浠呬綔鍏煎鍗犱綅锛屼笉鍐嶆墜鍔?loadSubScript锛岄伩鍏嶉噸澶嶅姞杞姐€?
    this._prefWindowLoaded = true;
  },

  onPrefsUnload(event) {
    this._prefWindowLoaded = false;
  },

  _normalize(raw) {
    const base = {
      contextMenuLabel: "娣诲姞鍗曡瘝骞剁炕璇?,
      enabled: true,
      autoTranslate: false,
      selectionMode: "word",
      hotkeyEnabled: false,
      hotkeyModifier: "ctrl",
      customHotkeyEnabled: false,
      customHotkey: "",
      addWordHotkeyEnabled: true,
      addWordHotkey: "",
      addWordHotkeyMode: "ctrl",
      selectionFirstEnabled: true,
      promptSystem:
        "浣犳槸涓€浣嶄笓涓氱殑鑻辨枃鏂囩尞缈昏瘧鍔╂墜銆傝灏嗙敤鎴风粰鍑虹殑鑻辨枃鍗曡瘝鎴栫煭璇炕璇戜负鏈€鍑嗙‘銆佹渶涓撲笟鐨勪腑鏂囪瘧娉曘€傚鏋滆璇嶅睘浜庣壒瀹氬绉戯紙濡傜敓鐗┿€佸寲瀛︺€佸尰瀛︺€佷俊鎭妧鏈瓑锛夛紝浼樺厛缁欏嚭璇ュ绉戞渶甯哥敤鐨勮瘧娉曪紱濡傝璇嶆湁澶氫釜甯哥敤涔夐」锛岀粰鍑哄綋鍓嶈澧冧笅鏈€鐩稿叧鐨勪竴涓垨涓や釜銆傚彧杈撳嚭缈昏瘧缁撴灉鏈韩锛屼笉瑕佽緭鍑轰换浣曡В閲娿€侀噴涔夈€佷緥鍙ユ垨澶氫綑鏂囧瓧銆?,
      promptUser: "璇峰皢浠ヤ笅鑻辨枃鍗曡瘝鎴栫煭璇炕璇戜负涓撲笟涓枃锛歿{word}}",
      promptMode: "split",
      promptGlobal:
        "浣犳槸涓€浣嶄笓涓氱殑鑻辨枃鏂囩尞缈昏瘧鍔╂墜銆傝灏嗙敤鎴风粰鍑虹殑鑻辨枃鍗曡瘝鎴栫煭璇炕璇戜负鏈€鍑嗙‘銆佹渶涓撲笟鐨勪腑鏂囪瘧娉曘€傚鏋滆璇嶅睘浜庣壒瀹氬绉戯紙濡傜敓鐗┿€佸寲瀛︺€佸尰瀛︺€佷俊鎭妧鏈瓑锛夛紝浼樺厛缁欏嚭璇ュ绉戞渶甯哥敤鐨勮瘧娉曪紱濡傝璇嶆湁澶氫釜甯哥敤涔夐」锛岀粰鍑哄綋鍓嶈澧冧笅鏈€鐩稿叧鐨勪竴涓垨涓や釜銆傚彧杈撳嚭缈昏瘧缁撴灉鏈韩锛屼笉瑕佽緭鍑轰换浣曡В閲娿€侀噴涔夈€佷緥鍙ユ垨澶氫綑鏂囧瓧銆俓n璇峰皢浠ヤ笅鑻辨枃鍗曡瘝鎴栫煭璇炕璇戜负涓撲笟涓枃锛歿{word}}",
      fontSize: 13,
      pageSize: 10, // 鍗曡瘝鏈瘡椤垫樉绀哄崟璇嶆暟
      apis: [],
      activeApiIndex: 0,
      sortMode: "reverse",
      searchStrategy: "prefix",
    };
    if (!raw || typeof raw !== "object") return base;
    return {
      ...base,
      ...raw,
      apis: Array.isArray(raw.apis) ? raw.apis : [],
      activeApiIndex: typeof raw.activeApiIndex === "number" ? raw.activeApiIndex : 0,
      sortMode: typeof raw.sortMode === "string" ? raw.sortMode : "reverse",
      searchStrategy: typeof raw.searchStrategy === "string" ? raw.searchStrategy : "prefix",
      pageSize: Number.isFinite(Number(raw.pageSize)) && Number(raw.pageSize) >= 1 ? Math.floor(Number(raw.pageSize)) : 10,
      selectionMode: raw.selectionMode === "sentence" ? "sentence" : "word",
      // 鏃ф暟鎹病鏈夋柊瀛楁鏃朵繚鎸侀粯璁ゅ€硷紙...raw 浼氱敤 undefined 瑕嗙洊 base锛岄渶鏄惧紡鍥炲～锛?
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

  // ---- 鍗曡瘝鏈磽瀛樹笌璇诲彇锛堣法鎻掍欢鍗囩骇/閲嶅惎锛?---
  // ---- 鍗曡瘝鏈瓨鍌ㄤ笌璇诲彇锛堝瓨浜?profile/wordtranslator/words/ 涓嬶紝鎸夋潯鐩垎鏂囦欢锛?--
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
      // 鏃х増 prefs.js 鏁版嵁杩佺Щ锛堜粎褰撴枃浠剁洰褰曚负绌烘椂锛?
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
      // 鍏滃簳锛氫粛鍐?prefs
      const obj = {};
      for (const [itemID, list] of this._itemWords) {
        obj[String(itemID)] = list;
      }
      Zotero.Prefs.set(this._wordsPrefKey, JSON.stringify(obj), true);
    } catch (e) {
      this._debugLog("_persistWords ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  // 绔嬪嵆 flush 闃叉姈瀹氭椂鍣ㄥ苟灏嗗綋鍓嶅唴瀛樹腑鐨勫叏閮ㄥ崟璇嶆湰鏁版嵁鍐欑洏
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

  // ---------- 缈昏瘧 API ----------
  async translate(text, apiOverride) {
    const api = apiOverride || this.getActiveApi();
    if (!api) throw new Error("鏈厤缃?API锛堣鍒拌缃?>鍗曡瘝缈昏瘧 涓坊鍔?API锛?);
    const promptMode = (this._data && this._data.promptMode) || "split";
    let messages = [];
    if (promptMode === "combined") {
      const globalTemplate = (this._data && this._data.promptGlobal) ||
        "浣犳槸涓€浣嶄笓涓氱殑鑻辨枃鏂囩尞缈昏瘧鍔╂墜銆傝灏嗙敤鎴风粰鍑虹殑鑻辨枃鍗曡瘝鎴栫煭璇炕璇戜负鏈€鍑嗙‘銆佹渶涓撲笟鐨勪腑鏂囪瘧娉曘€傚鏋滆璇嶅睘浜庣壒瀹氬绉戯紙濡傜敓鐗┿€佸寲瀛︺€佸尰瀛︺€佷俊鎭妧鏈瓑锛夛紝浼樺厛缁欏嚭璇ュ绉戞渶甯哥敤鐨勮瘧娉曪紱濡傝璇嶆湁澶氫釜甯哥敤涔夐」锛岀粰鍑哄綋鍓嶈澧冧笅鏈€鐩稿叧鐨勪竴涓垨涓や釜銆傚彧杈撳嚭缈昏瘧缁撴灉鏈韩锛屼笉瑕佽緭鍑轰换浣曡В閲娿€侀噴涔夈€佷緥鍙ユ垨澶氫綑鏂囧瓧銆俓n璇峰皢浠ヤ笅鑻辨枃鍗曡瘝鎴栫煭璇炕璇戜负涓撲笟涓枃锛歿{word}}";
      messages = [
        { role: "user", content: globalTemplate.split("{{word}}").join(text) },
      ];
    } else {
      const system = (this._data && this._data.promptSystem) || "";
      const userTemplate = (this._data && this._data.promptUser) || "璇峰皢浠ヤ笅鑻辨枃鍗曡瘝鎴栫煭璇炕璇戜负涓撲笟涓枃锛歿{word}}";
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
      catch (e) { throw new Error("API 杩斿洖鐨勪笉鏄湁鏁?JSON锛? + responseData.slice(0, 200)); }
    }
    if (resp.status < 200 || resp.status >= 300) {
      const detail = responseData && responseData.error && (responseData.error.message || responseData.error) || responseData && responseData.message || resp.statusText || "";
      throw new Error("API 閿欒(" + resp.status + "): " + detail);
    }
    const content = (responseData && responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content) || "";
    if (!content) {
      throw new Error("API 杩斿洖涓病鏈?choices[0].message.content锛? + JSON.stringify(responseData).slice(0, 500));
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