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
  _itemWords: new Map(),      // itemID -> [{word, translation, pending}]
  _panelUIDs: new Map(),      // itemID -> { paneUID, refresh }
  _paneKey: null,
  _prefWindowLoaded: false,
  _paneRefresh: null,

  _debugWriteToFile(msg) {
    try {
      if (typeof Components === "undefined") return;
      var profileDir = null;
      try { profileDir = (Zotero && Zotero.ProfileDir) ? Zotero.ProfileDir : (Zotero && Zotero.profileDirectory ? Zotero.profileDirectory : null); } catch (e0) {}
      if (!profileDir) return;
      var line = "[" + new Date().toISOString() + "] [WordTranslator] " + String(msg) + "\n";
      var wfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      try { wfile.initWithFile(profileDir); } catch (e1) { wfile.initWithPath(profileDir.path || String(profileDir)); }
      wfile.append("wordtranslator-debug.log");
      var wout = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      wout.init(wfile, 0x02 | 0x08 | 0x10, 0o666, 0);
      var wconv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter;1"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
      wconv.charset = "UTF-8";
      var winput = wconv.convertToInputStream(line);
      var wavail = winput.available();
      var wbytes = winput.readBytes(wavail);
      var wbin = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
      wbin.setOutputStream(wout);
      wbin.writeBytes(wbytes, wavail);
      wbin.close();
      wout.close();
    } catch (e) {
      try { Zotero.debug("[WordTranslator][logwrite-fail] " + msg + " :: " + (e && e.message || e)); } catch (e2) {}
    }
  },

  _debugLog(msg) {
    try { Zotero.debug("[WordTranslator] " + msg); } catch (e) {}
    this._debugWriteToFile(msg);
  },

_configVersion: 0,

  _onConfigChange() {
    try {
      this._configVersion++;
      this._debugLog("_onConfigChange: version=" + this._configVersion);
      // ???? Item Pane ???? custom sections??????? section?
      if (Zotero && Zotero.Notifier && typeof Zotero.Notifier.queue === "function") {
        Zotero.Notifier.queue("refresh", "itempane", []);
      }
      // ?????????? refresh ??
      if (this._paneRefresh && typeof this._paneRefresh === "function") {
        try { this._paneRefresh(); } catch (e) { this._debugLog("paneRefresh notify ERROR: " + (e && e.message || e)); }
      }
    } catch (e) {
      this._debugLog("_onConfigChange ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },



  shutdown() {
    try {
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
      this._initialized = false;
    } catch (e) {}
  },

  async init() {
    try {
      if (this._initialized) return;
      this._initialized = true;
      this._addonRoot = (typeof addonRoot !== 'undefined' && addonRoot) ? addonRoot : '';
      this._addonID = (typeof addonID !== 'undefined' && addonID) ? addonID : '';
      await this.loadDataFromDisk();
      await this.registerPrefsWindow();
      this.registerReaderEvents();
      this.registerItemPaneSection();
      this._debugLog("init OK; root=" + this._addonRoot);
    } catch (e) {
      this._debugLog("init ERROR: " + (e && (e.stack || e.message || e)));
    }
  },

  async loadDataFromDisk() {
    try {
      const rawStr = Zotero.Prefs.get("extensions.zotero.wordtranslator.config", true);
      const raw = rawStr ? JSON.parse(rawStr) : null;
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
      await Zotero.PreferencePanes.register({
        pluginID: this._addonID,
        id: "wordtranslator-prefs",
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
  },

  _onRenderTextSelectionPopup(event) {
    const { reader, doc, params, append } = event;
    try {
      this._debugLog(
        "popup event: reader.itemID=" + (reader && reader.itemID) +
        ", tabID=" + (reader && reader.tabID) +
        ", keys=" + Object.keys(reader || {}).slice(0, 12).join(",")
      );
    } catch (e) {}
    if (!this._data || !this._data.enabled) return;
    const text = (params && params.annotation && params.annotation.text || "").trim();
    if (!text) return;
    const label = this._data.contextMenuLabel || "添加单词并翻译";

    // 按钮已存在则不再重复添加
    if (doc.querySelector(".wordtranslator-add-btn")) return;

    const SVGIcon = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16" width="16" height="16" xml:space="preserve"><style type="text/css">.wt0{fill:#64B5F6;}.wt1{fill:#1E88E5;}</style><g><path class="wt0" d="M4.4,11.1h1.4c0.1,0,0.2-0.1,0.1-0.2L5.2,8.7c0-0.1-0.2-0.1-0.3,0l-0.7,2.2C4.2,11,4.3,11.1,4.4,11.1L4.4,11.1z"/><path class="wt0" d="M8.8,5H1.4C0.6,5,0,5.7,0,6.4v8.2C0,15.4,0.6,16,1.4,16h7.4c0.8,0,1.4-0.6,1.4-1.4V6.4C10.2,5.7,9.5,5,8.8,5L8.8,5z M7.9,14.2c-0.1,0.1-0.2,0.2-0.3,0.2c0,0-0.1,0-0.1,0c-0.1,0-0.1,0-0.2,0C7,14.3,7,14.2,7,14.1l-0.6-1.9C6.3,12,6.2,12,6.1,12H4c-0.1,0-0.1,0-0.2,0.1l-0.6,2c-0.1,0.1-0.1,0.2-0.3,0.3c-0.1,0.1-0.3,0.1-0.4,0.1c-0.2,0-0.3-0.1-0.3-0.2c0-0.1-0.1-0.2,0-0.4l2.1-6.4c0.1-0.3,0.4-0.5,0.7-0.5h0c0.3,0,0.6,0.2,0.7,0.5l0,0l2.1,6.5C8,14,8,14.1,7.9,14.2L7.9,14.2z"/><path class="wt1" d="M14.3,0H7.5C6.6,0,5.8,0.8,5.8,1.7v2.1C5.8,4,6,4.1,6.1,4.1H8c0.3,0,0.5,0,0.7,0.1C8.6,3.9,8.6,3.7,8.5,3.4H7.6C7.4,3.4,7.3,3.3,7.3,3c0-0.3,0.1-0.5,0.3-0.5h2.8c-0.1-0.3-0.2-0.5-0.2-0.7c0-0.2,0.1-0.4,0.3-0.5c0.3-0.1,0.4,0,0.6,0.2c0,0.1,0.1,0.3,0.2,0.6c0.1,0.2,0.1,0.4,0.1,0.4h2.4c0.3,0,0.4,0.2,0.4,0.5c0,0.3-0.1,0.5-0.4,0.5h-0.6c-0.1,0-0.1,0-0.1,0C12.8,4.9,12.3,6,11.6,7c0.6,0.5,1.3,0.9,2.3,1.3c0.3,0.1,0.3,0.3,0.3,0.6c-0.1,0.2-0.3,0.3-0.6,0.2c-0.9-0.3-1.8-0.8-2.5-1.3v2.9c0,0.2,0.1,0.3,0.3,0.3h3c0.9,0,1.7-0.8,1.7-1.7V1.7C16,0.8,15.2,0,14.3,0L14.3,0z"/><path class="wt1" d="M12,3.4H9.6c-0.1,0-0.2,0.1-0.1,0.2C9.6,4,9.7,4.4,9.9,4.8c0,0,0,0,0,0.1c0.4,0.3,0.7,0.8,0.9,1.2c0.2,0,0.1,0,0.3,0c0.5-0.8,0.9-1.6,1.1-2.5C12.1,3.5,12.1,3.4,12,3.4L12,3.4z"/></g></svg>';

    const btn = doc.createElement("button");
    btn.className = "toolbar-button wide-button wordtranslator-add-btn";
    btn.setAttribute("data-tabstop", "1");
    btn.innerHTML = SVGIcon + "<span>" + label + "</span>";
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
    append(btn);
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

    const list = this._itemWords.get(Number(paneID)) || [];
    const card = { word, translation: "翻译中…", pending: true };
    list.push(card);
    this._itemWords.set(Number(paneID), list);
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
      this._refreshItemPane(paneID);
      this._debugLog("_addWordForReader finished: paneID=" + paneID);
    }
  },

  _refreshItemPane(itemID) {
    const id = Number(itemID);
    const entry = this._panelUIDs && this._panelUIDs.get(id);

    this._debugLog(
      "_refreshItemPane: id=" + id +
      ", found=" + !!entry +
      ", hasRefresh=" + !!(entry && entry.refresh) +
      ", paneRefresh=" + !!this._paneRefresh
    );

    // ??1???? refresh?????
    if (this._paneRefresh && typeof this._paneRefresh === "function") {
      try {
        this._paneRefresh();
        return;
      } catch (e) {
        this._debugLog(
          "paneRefresh ERROR: " +
          (e && (e.stack || e.message || String(e)))
        );
      }
    }

    // ??2???? entry.refresh
    if (entry && typeof entry.refresh === "function") {
      try {
        entry.refresh();
        return;
      } catch (e) {
        this._debugLog(
          "refresh ERROR: " +
          (e && (e.stack || e.message || String(e)))
        );
      }
    }

    // ??3?????
    setTimeout(() => {
      const retry = this._panelUIDs && this._panelUIDs.get(id);
      this._debugLog(
        "_refreshItemPane retry: id=" + id +
        ", entry=" + !!retry +
        ", paneRefresh=" + !!this._paneRefresh
      );
      if (this._paneRefresh && typeof this._paneRefresh === "function") {
        try { this._paneRefresh(); } catch (e) { this._debugLog("paneRefresh retry ERROR: " + (e && e.message || e)); }
      } else if (retry && typeof retry.refresh === "function") {
        try { retry.refresh(); } catch (e) { this._debugLog("refresh retry ERROR: " + (e && e.message || e)); }
      }
    }, 300);
  },

  _deleteWordForItem(itemID, index) {
    const id = Number(itemID);
    const list = this._itemWords.get(id);
    if (!list) return;
    list.splice(index, 1);
    this._itemWords.set(id, list);
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
      // 优先：直接操作当前已渲染 pane 的 body（最稳，跨 chrome browser 也能用）
      const cur = this._currentPane;
      if (cur && cur.body) {
        cur.body.style.fontSize = fs + "px";
        this._debugLog("applyFontSizeToPane: " + fs + "px applied via _currentPane.body");
        return;
      }
      // 回退：扫描主 doc（可能在同一 doc 中）
      const win = Zotero.getMainWindow();
      const doc = win && win.document;
      if (!doc) return;
      const nodes = doc.querySelectorAll(".wordtranslator-pane-body");
      let n = 0;
      for (let i = 0; i < nodes.length; i++) { nodes[i].style.fontSize = fs + "px"; n++; }
      // 再回退：遍历所有已知 paneUID，对每个用 dataset.wtPaneUid 找 body
      if (n === 0 && this._panelUIDs && this._panelUIDs.size > 0) {
        for (const [itemID, entry] of this._panelUIDs) {
          if (!entry || !entry.paneUID) continue;
          // 可能在主 doc 或子 doc
          let body = doc.querySelector && doc.querySelector("[data-wt-pane-uid=\"" + entry.paneUID + "\"]");
          if (body) { body.style.fontSize = fs + "px"; n++; continue; }
          // 子 doc（browser element）
          try {
            const browsers = doc.getElementsByTagName && doc.getElementsByTagName("browser");
            if (browsers) {
              for (let i2 = 0; i2 < browsers.length; i2++) {
                const sd = browsers[i2].contentDocument;
                if (!sd) continue;
                const b = sd.querySelector("[data-wt-pane-uid=\"" + entry.paneUID + "\"]");
                if (b) { b.style.fontSize = fs + "px"; n++; break; }
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
      const rawStr = Zotero.Prefs.get("extensions.zotero.wordtranslator.config", true);
      const raw = rawStr ? JSON.parse(rawStr) : null;
      this._data = this._normalize(raw);
      this._debugLog("_reloadDataFromDisk: apis=" + ((this._data && this._data.apis && this._data.apis.length) || 0));
    } catch (e) {
      this._debugLog("_reloadDataFromDisk ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  async _refreshProvidersInAllPanes(currentItemID) {
    try {
      await this._reloadDataFromDisk();
      let refreshed = 0;
      for (const [itemID, entry] of this._panelUIDs) {
        if (entry && typeof entry.refresh === "function") {
          try { entry.refresh(); refreshed++; } catch (e) { this._debugLog("refresh pane ERROR itemID=" + itemID + ": " + (e && e.message || e)); }
        }
      }
      if (refreshed === 0 && this._paneRefresh && typeof this._paneRefresh === "function") {
        try { this._paneRefresh(); refreshed++; } catch (e) { this._debugLog("refresh global ERROR: " + (e && e.message || e)); }
      }
      this._debugLog("_refreshProvidersInAllPanes: refreshed=" + refreshed + ", currentItemID=" + currentItemID);
      try {
        const win = Zotero.getMainWindow();
        const doc = win && win.document;
        const zp = doc && doc.getElementById && doc.getElementById("zotero-item-pane");
        const curItemId = zp && zp.getAttribute && zp.getAttribute("data-itemid");
        if (curItemId && this._renderPaneBody) {
          const item = await Zotero.Items.getAsync(Number(curItemId));
          const body = doc.querySelector && doc.querySelector(".wordtranslator-pane-body");
          if (item && body) {
            this._renderPaneBody(doc, body, item);
            this._debugLog("_refreshProvidersInAllPanes: re-rendered current body for itemID=" + item.id);
          }
        }
      } catch (e3) {
        this._debugLog("_refreshProvidersInAllPanes current-body ERROR: " + (e3 && e3.message || e3));
      }
    } catch (e) {
      this._debugLog("_refreshProvidersInAllPanes ERROR: " + (e && (e.stack || e.message || String(e))));
    }
  },

  _clearAllWordsForItem(itemID) {
    const id = Number(itemID);
    this._itemWords.set(id, []);
    this._refreshItemPane(id);
  },

  // ---------- 注册 Item Pane 面板 ----------
  registerItemPaneSection() {
    try {
      const key = Zotero.ItemPaneManager.registerSection({
        paneID: "wordtranslator",
        pluginID: this._addonID,
        header: {
          l10nID: "wordtranslator-pane-header",
          icon: this._addonRoot + "content/icons/favicon.png",
        },
        sidenav: {
          l10nID: "wordtranslator-pane-sidenav",
          icon: this._addonRoot + "content/icons/favicon.png",
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
          } catch (e) {
            this._debugLog("pane onInit ERROR: " + (e && (e.stack || e.message || String(e))));
          }
        },
        onDestroy: ({ body }) => {
          const uid = body.dataset.wtPaneUid;
          if (uid) {
            for (const [itemID, entry] of this._panelUIDs) {
              if (entry.paneUID === uid) this._panelUIDs.delete(itemID);
            }
          }
        },
        onItemChange: ({ item, setEnabled }) => {
          setEnabled(true);
        },
        onRender: ({ doc, body, item }) => {
          try {
            this._debugLog("pane onRender: itemID=" + (item && item.id) + ", body=" + !!body);
            this._renderPaneBody(doc, body, item);
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

  _renderPaneBody(doc, body, item) {
    // 使用 HTML 命名空间创建元素（body 是 html:div，doc 是 XUL document）
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
    const txt = (s) => this._createTxt(doc, s);

    body.replaceChildren();
    const itemID = Number(item.id);
    const words = this._itemWords.get(itemID) || [];

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

    // 头部：左组（标题 + API 下拉 + 刷新 + 设置） / 右组（放大 + 缩小 + 清空）
    const header = el("div", { style: "display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;" });
    const leftGroup = el("div", { style: "display:flex;align-items:center;gap:6px;flex:1;min-width:0;" });
    const rightGroup = el("div", { style: "display:flex;align-items:center;gap:6px;flex-shrink:0;" });

    const title = el("strong", {}, [txt("单词本")]);
    leftGroup.append(title);

    const apiSelect = el("select", { style: "flex:1;min-width:0;font-size:12px;padding:2px 6px;", title: "切换翻译 API" });
    this._fillApiSelect(doc, apiSelect);
    apiSelect.addEventListener("change", () => {
      const idx = parseInt(apiSelect.value, 10);
      this._setActiveApiForItem(itemID, idx);
    });
    leftGroup.append(apiSelect);

    const refreshBtn = el("button", { title: "刷新服务商列表", "aria-label": "刷新服务商列表", style: "border:1px solid #ccc;background:transparent;border-radius:6px;cursor:pointer;padding:2px 6px;display:inline-flex;align-items:center;justify-content:center;color:#555;" }, []);
    refreshBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"23 4 23 10 17 10\"></polyline><polyline points=\"1 20 1 14 7 14\"></polyline><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"></path></svg>";
    refreshBtn.addEventListener("click", () => this._refreshProvidersInAllPanes(itemID));
    leftGroup.append(refreshBtn);

    const settingsBtn = el("button", { title: "设置", "aria-label": "设置", style: "border:1px solid #ccc;background:transparent;border-radius:6px;cursor:pointer;padding:2px 6px;display:inline-flex;align-items:center;justify-content:center;color:#555;" }, []);
    settingsBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"3\" y1=\"6\" x2=\"21\" y2=\"6\"></line><line x1=\"3\" y1=\"12\" x2=\"21\" y2=\"12\"></line><line x1=\"3\" y1=\"18\" x2=\"21\" y2=\"18\"></line></svg>";
    settingsBtn.addEventListener("click", () => this._openPreferencesPane());
    leftGroup.append(settingsBtn);

    const zoomInBtn = el("button", { title: "放大字体", "aria-label": "放大字体", style: "border:1px solid #ccc;background:transparent;border-radius:6px;cursor:pointer;padding:2px 6px;display:inline-flex;align-items:center;justify-content:center;color:#555;" }, []);
    zoomInBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><text x=\"6\" y=\"17\" font-size=\"14\" font-family=\"Arial, sans-serif\" font-weight=\"700\" stroke=\"none\" fill=\"currentColor\">A</text><polyline points=\"16,4 19,1 22,4\"></polyline><line x1=\"19\" y1=\"1\" x2=\"19\" y2=\"7\"></line></svg>";
    zoomInBtn.addEventListener("click", () => this._onZoomFontSize(itemID, +1));
    rightGroup.append(zoomInBtn);

    const zoomOutBtn = el("button", { title: "缩小字体", "aria-label": "缩小字体", style: "border:1px solid #ccc;background:transparent;border-radius:6px;cursor:pointer;padding:2px 6px;display:inline-flex;align-items:center;justify-content:center;color:#555;" }, []);
    zoomOutBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><text x=\"6\" y=\"17\" font-size=\"11\" font-family=\"Arial, sans-serif\" font-weight=\"700\" stroke=\"none\" fill=\"currentColor\">A</text><polyline points=\"16,7 19,10 22,7\"></polyline><line x1=\"19\" y1=\"10\" x2=\"19\" y2=\"4\"></line></svg>";
    zoomOutBtn.addEventListener("click", () => this._onZoomFontSize(itemID, -1));
    rightGroup.append(zoomOutBtn);

    const clearBtn = el("button", { style: "padding:2px 10px;border:1px solid #ccc;background:transparent;border-radius:6px;cursor:pointer;" }, [txt("清空")]);
    clearBtn.addEventListener("click", () => this._clearAllWordsForItem(itemID));
    rightGroup.append(clearBtn);

    header.append(leftGroup, rightGroup);
    body.append(header);

    // 卡片列表
    const list = el("div", { class: "wordtranslator-pane-list", style: "display:flex;flex-direction:column;gap:6px;" });
    if (words.length === 0) {
      const empty = el("div", { style: "color:#888;font-size:12px;padding:6px 4px;" }, [txt("暂无单词。打开 PDF 划词后，点击「" + (this._data?.contextMenuLabel || "添加单词并翻译") + "」即可加入。")]);
      list.append(empty);
    } else {
      words.forEach((w, i) => list.append(this._renderCard(doc, itemID, i, w)));
    }
    body.append(list);

    // CSS（注入一次，挂在 body 内部最安全）
    if (!body.querySelector(".wordtranslator-pane-style")) {
      const style = doc.createElementNS(HTML_NS, "style");
      style.className = "wordtranslator-pane-style";
      style.textContent = this._getPaneCSS();
      body.append(style);
    }
    // 应用字体大小
    const fsVal = Number(this._data && this._data.fontSize) || 13;
    body.style.fontSize = fsVal + "px";
    // 保存当前 pane 的 doc / body 引用，以便点击放大/缩小按钮后直接操作该 body
    this._currentPane = { doc: doc, body: body };
  },

  _renderCard(doc, itemID, idx, w) {
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
    const txt = (s) => this._createTxt(doc, s);

    const card = el("div", { style: "display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;background:rgba(255,255,255,0.6);" });
    const wordEl = el("span", { style: "font-weight:600;color:#1e88e5;word-break:break-word;" }, [txt(w.word)]);
    const arrowEl = el("span", { style: "color:#666;flex-shrink:0;" }, [txt(" -- ")]);
    const transEl = el("span", { style: "flex:1;min-width:0;word-break:break-word;", ...(w.pending ? { style: "flex:1;min-width:0;word-break:break-word;color:#999;" } : {}) }, [txt(w.translation)]);
    const delBtn = el("button", { title: "删除", style: "flex-shrink:0;border:none;background:transparent;color:#999;cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;" }, [txt("✕")]);
    delBtn.addEventListener("click", () => this._deleteWordForItem(itemID, idx));
    card.append(wordEl, arrowEl, transEl, delBtn);
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
    return ".wordtranslator-pane-body button:hover { background: rgba(0,0,0,0.06); } .wordtranslator-pane-body select { color: #222; background: #fff; }";
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
      promptSystem:
        "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。",
      promptUser: "请将以下英文单词或短语翻译为专业中文：{{word}}",
      fontSize: 13,
      apis: [],
      activeApiIndex: 0,
    };
    if (!raw || typeof raw !== "object") return base;
    return {
      ...base,
      ...raw,
      apis: Array.isArray(raw.apis) ? raw.apis : [],
      activeApiIndex: typeof raw.activeApiIndex === "number" ? raw.activeApiIndex : 0,
    };
  },

  getActiveApi() {
    const apis = (this._data && this._data.apis) || [];
    const i = (this._data && this._data.activeApiIndex) || 0;
    return apis[i] || apis[0] || null;
  },

  _saveData() {
    try {
      Zotero.Prefs.set("extensions.zotero.wordtranslator.config", JSON.stringify(this._data), true);
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
    const system = (this._data && this._data.promptSystem) || "";
    const userTemplate = (this._data && this._data.promptUser) || "请将以下英文单词或短语翻译为专业中文：{{word}}";
    const user = userTemplate.split("{{word}}").join(text);
    const body = {
      model: api.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
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
