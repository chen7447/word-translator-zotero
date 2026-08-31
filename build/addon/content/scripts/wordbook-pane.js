// Word Translator 模块：pane（Phase 5 由 addon.js 机械拆分，纯移动无行为变更）
// 依赖：本文件在 addon.js 之后经 loadSubScript 注入，Object.assign 挂到同一 WordTranslator 对象上，this 绑定不变。
"use strict";

var WordTranslatorModule_pane = {
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
  _latestPaneUID: null,
  _currentPane: null,
  _currentPaneContext: null,
  _resolvePaneBody(doc, contextBody) {
    let body = contextBody && contextBody.isConnected ? contextBody : null;
    let all = [];
    try { all = doc && doc.querySelectorAll ? Array.from(doc.querySelectorAll(".wordtranslator-pane-body")) : []; } catch (e) {}
    if (all.length > 1) {
      this._debugLog("_resolvePaneBody: " + all.length + " connected pane bodies (uids=" +
        all.map((b) => (b && b.dataset && b.dataset.wtPaneUid) || "?").join(",") + ")");
    }
    const latestUID = this._latestPaneUID;
    if (latestUID) {
      const latest = all.find((b) => b && b.dataset && b.dataset.wtPaneUid === latestUID);
      if (latest && latest.isConnected && latest !== body) {
        this._debugLog("_resolvePaneBody: stale body switched to latest uid=" + latestUID);
        body = latest;
      }
    }
    if (!body && all.length) body = all[0];
    return body || null;
  },

  _refreshItemPane(itemID, viewInfo) {
    const id = Number(itemID);
    if (!Number.isFinite(id) || id <= 0) return;
    this._debugLog("_refreshItemPane: id=" + id + ", hasViewInfo=" + !!viewInfo);
    try {
      const pane = this._currentPaneContext;
      const win = Zotero.getMainWindow();
      const doc = pane && pane.doc && pane.doc.defaultView ? pane.doc : (win && win.document);
      const body = this._resolvePaneBody(doc, pane && pane.body);
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

  // 翻译超时兜底：provider 长时间无响应（如 Google 免费接口被限流后挂起）时按失败处理，
  // 走词典服务兜底显示，避免"翻译中…"永远不结束。
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
      // Phase 7：重译成功后回写译文缓存（改提示词重译的译文更新全局缓存）
      if (result) this._setCachedTranslation(currentCard.word, result);
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
            // 记录最新初始化的 body uid：渲染选 body 时优先选它，
            // 防止把卡片渲染进插件重载后仍连接的旧 body（"保存成功但面板不显示、刷新无反应"）。
            this._latestPaneUID = uid;
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

  // ---------- 条目生命周期观察（Phase 3） ----------
  // 条目被彻底删除时同步清理其单词本：内存 Map + words/<id>.json 文件 + 界面状态，
  // 防止孤儿文件无限堆积（旧版无 Notifier 观察者，shutdown 里的注销是死代码）。
  // 只处理 delete；trash（移入回收站）故意不处理——回收站恢复后单词本仍在，是合理行为。
  // 单词数据按 pane id（父条目）存：删除附件 id 不会命中 _itemWords 的键，天然安全。
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
      // Phase 6：列表局部重绘不再销毁搜索框，焦点与光标自然保留（旧焦点恢复 hack 已删）。
      this._handleWordBookSearchEvent({ type: "input", itemID: id, keyword: value });
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
    const st = this._getWordBookViewState(id);
    const rawWords = this._itemWords.get(id) || [];
    const pageSize = Math.max(1, Number(this._data && this._data.pageSize) || 10);
    const strategyName = this._getActiveSearchStrategyName();
    const info = this._computePagedIndices(rawWords, this._sortMode, st.search, opts.page || st.page, pageSize, strategyName);
    st.page = info.page;
    this._wordBookViewState.set(id, st);
    this._debugLog("word-book post-trigger: source=" + (opts.source || "unknown") + ", itemID=" + id + ", strategy=" + strategyName + ", total=" + info.total + ", page=" + info.page + "/" + info.pageCount);

    // Phase 6 快路径：外壳已构建、上下文条目一致、body 可用 → 只重绘卡片列表。
    // 搜索/翻页/增删改不再整板重绘：不闪、不丢搜索框焦点、不触发全 pane 刷新。
    if (!opts.forceFull) {
      try {
        const ctx = this._currentPaneContext;
        const doc = ctx && ctx.doc && ctx.doc.defaultView ? ctx.doc : null;
        const body = this._resolvePaneBody(doc, ctx && ctx.body);
        // 双一致：上下文条目 === 目标条目，且外壳构建时也属于该条目
        // （防 onItemChange 先行而 onRender 未跑时，把 B 条目卡片渲染进 A 条目外壳）。
        if (ctx && Number(ctx.itemID) === id && body && body.isConnected
            && body.dataset && body.dataset.chromeItemID === String(id)) {
          if (this._renderCardList(doc, body, id, rawWords, info) !== false) return;
        }
      } catch (e0) {
        this._debugLog("_applyWordBookView fast-path ERROR: " + (e0 && (e0.message || String(e0))));
      }
    }

    // 慢路径：借 Zotero 官方 item pane 刷新自愈（条目切换/插件重载后/局部路径不可用/强制全量）。
    this._triggerPaneRefresh();
    this._refreshItemPane(id, info);
  },

  // 刷新按钮：强制走慢路径（官方 item pane 刷新自愈 + 全量重绘），
  // 并记录 itemID 到上下文（供 onRender 解析）。
  _repairWordBookPane(itemID) {
    const id = Number(itemID);
    try {
      if (Number.isFinite(id) && id > 0 && this._currentPaneContext) {
        try { this._currentPaneContext.itemID = id; } catch (e) {}
      }
      if (Number.isFinite(id) && id > 0) this._applyWordBookView(id, { source: "refresh", forceFull: true });
    } catch (e) {
      this._debugLog("_repairWordBookPane ERROR: " + (e && (e.stack || e.message || String(e))));
      try { if (Number.isFinite(id) && id > 0) this._applyWordBookView(id, { source: "refresh", forceFull: true }); } catch (e2) {}
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

    // 分页信息计算一次，外壳与列表共用
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

    // Phase 6 分层：外壳（头部四行，含搜索框/翻页控件）与卡片列表分离——
    // 搜索/翻页/增删改只重绘列表（_renderCardList），外壳仅在条目切换/全量渲染时重建。
    // chromeItemID 标记外壳归属：快路径要求上下文条目与外壳条目双一致。
    body.append(this._buildPaneChrome(doc, itemID, pageInfo));
    try { body.dataset.chromeItemID = String(itemID); } catch (e0) {}
    const list = el("div", { class: "wordtranslator-pane-list", style: "display:flex;flex-direction:column;gap:6px;" });
    body.append(list);
    this._renderCardList(doc, body, itemID, rawWords, pageInfo);

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

  // Phase 6：外壳——头部四行（标题/操作按钮行/字典行/搜索+翻页行）。返回 header 元素。
  // 仅在 _renderPaneBody 全量渲染时构建；翻页控件的后续状态由 _renderCardList 同步。
  _buildPaneChrome(doc, itemID, pageInfo) {
    const HTML_NS = "http://www.w3.org/1999/xhtml";
    const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
    const txt = (s) => this._createTxt(doc, s);
    const view = this._getWordBookViewState(itemID);

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
      // Phase 6 局部重绘不再重建外壳：排序按钮自更新外观（原依赖全量重绘刷写）。
      if (next === "reverse") sortBtn.textContent = "倒";
      else if (next === "forward") sortBtn.textContent = "正";
      else sortBtn.innerHTML = this._getSortIconHTML("alpha");
      sortBtn.title = this._getSortLabel(next);
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

    // Phase 7：导出按钮（CSV / Markdown / Anki，当前条目或全部条目）
    const exportBtn = el("button", { title: "导出单词本（CSV / Markdown / Anki）", "aria-label": "导出单词本", style: "height:26px;padding:0 9px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:12px;line-height:24px;box-sizing:border-box;white-space:nowrap;color:ButtonText;" }, [txt("导出")]);
    exportBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._showExportMenu(ev, itemID);
    });
    titleActions.append(exportBtn);

    const clearBtn = el("button", { title: "清空当前条目的全部单词", "aria-label": "清空当前条目的全部单词", style: "height:26px;padding:0 9px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:12px;line-height:24px;box-sizing:border-box;white-space:nowrap;color:ButtonText;" }, [txt("清空")]);
    clearBtn.addEventListener("click", () => this._clearAllWordsForItem(itemID));
    titleActions.append(clearBtn);

    titleRow.append(titleGroup, titleActions);

    // 第三行：搜索 + 翻页
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

    const prevBtn = el("button", { class: "wt-page-prev", title: "上一页", "aria-label": "上一页", disabled: pageInfo.page <= 1 ? "disabled" : null, style: "height:26px;min-width:28px;padding:0 8px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:13px;line-height:24px;color:ButtonText;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;" }, [txt("‹")]);
    prevBtn.addEventListener("click", () => this._setWordBookPage(itemID, pageInfo.page - 1));
    navRow.append(prevBtn);

    const pageInput = el("input", {
      type: "text",
      class: "wt-page-input",
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

    const totalLabel = el("span", { class: "wt-page-total", style: "font-size:12px;color:GrayText;white-space:nowrap;flex:0 0 auto;" }, [txt(" / " + pageInfo.pageCount)]);
    navRow.append(totalLabel);

    const nextBtn = el("button", { class: "wt-page-next", title: "下一页", "aria-label": "下一页", disabled: pageInfo.page >= pageInfo.pageCount ? "disabled" : null, style: "height:26px;min-width:28px;padding:0 8px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;font-size:13px;line-height:24px;color:ButtonText;box-sizing:border-box;flex:0 0 auto;white-space:nowrap;" }, [txt("›")]);
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
    return header;
  },

  // Phase 6：卡片列表局部重绘——只更新列表内容与翻页控件状态，不动外壳/搜索框。
  // 返回 false 表示外壳不存在（调用方应回退全量渲染）。
  _renderCardList(doc, body, itemID, rawWords, pageInfo) {
    try {
      try { this._hideCardMenu(); } catch (e0) {}
      const list = body && body.querySelector ? body.querySelector(".wordtranslator-pane-list") : null;
      if (!list) return false;
      const st = this._getWordBookViewState(itemID);
      list.replaceChildren();
      const emptyHint = this._getEmptyHint(doc, rawWords, st.search, pageInfo);
      if (emptyHint) {
        list.append(emptyHint);
      } else {
        pageInfo.indices.forEach((origIdx) => {
          const w = rawWords[origIdx];
          list.append(this._renderCard(doc, itemID, origIdx, w));
        });
      }
      // 同步翻页控件状态（外壳保留，控件值/禁用态跟随最新分页信息）
      try {
        const prev = body.querySelector(".wt-page-prev");
        const next = body.querySelector(".wt-page-next");
        const input = body.querySelector(".wt-page-input");
        const total = body.querySelector(".wt-page-total");
        if (prev) { if (pageInfo.page <= 1) prev.setAttribute("disabled", "disabled"); else prev.removeAttribute("disabled"); }
        if (next) { if (pageInfo.page >= pageInfo.pageCount) next.setAttribute("disabled", "disabled"); else next.removeAttribute("disabled"); }
        if (input) input.value = String(pageInfo.page);
        if (total) total.textContent = " / " + pageInfo.pageCount;
      } catch (e1) {}
      return true;
    } catch (e) {
      this._debugLog("_renderCardList ERROR: " + (e && (e.stack || e.message || String(e))));
      return false;
    }
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

  // ---------- Phase 7：单词本导出（CSV / Markdown / Anki tsv） ----------

  // 收集导出数据：scope 为条目 id（当前条目）或 null（全部条目）。
  // 返回 [{ id, title, words: [card] }]；条目标题取不到时回退 "条目 <id>"。
  _collectExportSections(scope) {
    const sections = [];
    const ids = scope != null ? [Number(scope)] : Array.from(this._itemWords.keys()).sort((a, b) => a - b);
    for (const id of ids) {
      const words = this._itemWords.get(Number(id)) || [];
      if (!words.length) continue;
      let title = "条目 " + id;
      try {
        const item = Zotero.Items && Zotero.Items.get(Number(id));
        if (item) title = String(item.getField("title") || "") || title;
      } catch (e) {}
      sections.push({ id: Number(id), title, words });
    }
    return sections;
  },

  // 单条词的词典摘要（来自 dict-cache；离线词库/在线源命中都有）
  _exportDictSummary(word) {
    try {
      const D = Zotero.WordTranslatorDict;
      const entry = D && D.getCached && D.getCached(word);
      if (!entry) return { phonetic: "", pos: "", meaning: "" };
      const ph = entry.phonetic && (entry.phonetic.us || entry.phonetic.uk);
      const m = entry.meanings && entry.meanings[0];
      return {
        phonetic: ph ? "[" + String(ph).trim().replace(/^\/+|\/+$/g, "") + "]" : "",
        pos: m && m.pos ? String(m.pos) : "",
        meaning: m && m.def ? String(m.def) : "",
      };
    } catch (e) {
      return { phonetic: "", pos: "", meaning: "" };
    }
  },

  _formatExportCSV(sections) {
    const esc = (v) => "\"" + String(v == null ? "" : v).replace(/"/g, "\"\"") + "\"";
    const rows = ["word,translation,phonetic,pos,meaning,highlight,item"];
    for (const sec of sections) {
      for (const w of sec.words) {
        const d = this._exportDictSummary(w.word);
        rows.push([
          esc(w.word), esc(w.translation), esc(d.phonetic), esc(d.pos), esc(d.meaning),
          esc(w.highlight || ""), esc(sec.title),
        ].join(","));
      }
    }
    // BOM：保证 Excel/WPS 直接打开中文不乱码
    return "\uFEFF" + rows.join("\r\n") + "\r\n";
  },

  _formatExportMD(sections) {
    const lines = [];
    const date = new Date().toISOString().slice(0, 10);
    lines.push("# 单词本导出（" + date + "）", "");
    for (const sec of sections) {
      if (sections.length > 1) lines.push("## " + sec.title, "");
      for (const w of sec.words) {
        const d = this._exportDictSummary(w.word);
        const parts = ["**" + String(w.word || "").replace(/\*/g, "\\*") + "**", String(w.translation || "").trim()].filter(Boolean);
        let line = "- " + parts.join(" -- ");
        const extras = [d.phonetic, [d.pos ? d.pos + "." : "", d.meaning].filter(Boolean).join(" ")].filter(Boolean).join(" ");
        if (extras) line += "　" + extras;
        if (w.highlight) line += "　（" + w.highlight + "）";
        lines.push(line);
      }
      if (sections.length > 1) lines.push("");
    }
    return lines.join("\n") + "\n";
  },

  _formatExportAnki(sections) {
    const clean = (v) => String(v == null ? "" : v).replace(/[\t\r\n]+/g, " ").trim();
    const rows = [];
    for (const sec of sections) {
      for (const w of sec.words) {
        const d = this._exportDictSummary(w.word);
        const back = [clean(w.translation), [d.phonetic, [d.pos ? d.pos + "." : "", d.meaning].filter(Boolean).join(" ")].filter(Boolean).join(" ")].filter(Boolean);
        rows.push(clean(w.word) + "\t" + back.join("<br>"));
      }
    }
    return rows.join("\n") + "\n";
  },

  // 文件名非法字符清洗（Windows 为主）
  _exportFileName(name) {
    return String(name || "export").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  },

  // 导出主流程：收集 → 格式化 → 文件选择器（兜底写数据目录 exports/）→ 写盘
  async _exportWordBook(scope, format) {
    try {
      const sections = this._collectExportSections(scope);
      if (!sections.length) {
        try { if (Zotero.toast) Zotero.toast("单词本为空，没有可导出的内容"); } catch (e0) {}
        return false;
      }
      const fmt = format === "md" ? "md" : format === "anki" ? "anki" : "csv";
      let content = "";
      if (fmt === "csv") content = this._formatExportCSV(sections);
      else if (fmt === "md") content = this._formatExportMD(sections);
      else content = this._formatExportAnki(sections);

      const ext = fmt === "csv" ? "csv" : fmt === "md" ? "md" : "txt";
      const scopeTitle = sections.length === 1 ? sections[0].title : "全部条目";
      const baseName = this._exportFileName("单词本-" + scopeTitle + "-" + new Date().toISOString().slice(0, 10)) + "." + ext;

      // 首选文件选择器（可自选路径）：Zotero.FilePicker 不可用时直接 XPCOM 实例化
      // nsIFilePicker 兜底，保证原生"另存为"对话框可用。
      let targetPath = null;
      let pickerWorked = false;
      try {
        let fp = null;
        if (typeof Zotero.FilePicker === "function") {
          fp = new Zotero.FilePicker();
        } else if (typeof Components !== "undefined" && Components.classes && Components.interfaces) {
          fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
        }
        if (fp) {
          const win = Zotero.getMainWindow();
          const MODE_SAVE = fp.modeSave != null ? fp.modeSave : 0;
          fp.init(win, "导出单词本", MODE_SAVE);
          fp.defaultString = baseName;
          fp.defaultExtension = ext;
          fp.appendFilter(fmt === "csv" ? "CSV" : fmt === "md" ? "Markdown" : "Anki tsv", "*." + ext);
          const rv = await fp.show();
          pickerWorked = true;
          const RETURN_OK = fp.returnOK != null ? fp.returnOK : 0;
          const RETURN_REPLACE = fp.returnReplace != null ? fp.returnReplace : 2;
          if (rv === RETURN_OK || rv === RETURN_REPLACE) targetPath = fp.file;
        }
      } catch (e1) {
        this._debugLog("export filepicker ERROR: " + (e1 && (e1.message || String(e1))));
      }

      // 用户在对话框点了取消 → 直接中止，不写任何文件
      if (pickerWorked && !targetPath) {
        this._debugLog("export cancelled by user");
        try { if (Zotero.toast) Zotero.toast("已取消导出"); } catch (e5) {}
        return false;
      }

      // 兜底：仅当选择器完全不可用时，写数据目录 exports/（时间戳后缀防覆盖）
      let usedFallback = false;
      let exportsDir = "";
      if (!targetPath) {
        const S = Zotero.WordTranslatorStorage;
        const dir = S && S.getDataDirPath ? S.getDataDirPath() : "";
        if (!dir) return false;
        const sep = dir.indexOf("\\") >= 0 ? "\\" : "/";
        exportsDir = dir + sep + "exports";
        const stamp = String(Date.now()).slice(-6);
        targetPath = exportsDir + sep + this._exportFileName(baseName.replace(/\.\w+$/, "")) + "-" + stamp + "." + ext;
        try {
          const dirFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
          dirFile.initWithPath(exportsDir);
          if (!dirFile.exists()) dirFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
        } catch (e2) {}
        usedFallback = true;
      }

      try {
        if (Zotero.File && typeof Zotero.File.putContentsAsync === "function") {
          await Zotero.File.putContentsAsync(targetPath, content);
        } else {
          throw new Error("Zotero.File.putContentsAsync 不可用");
        }
      } catch (e3) {
        this._debugLog("export write ERROR: " + (e3 && (e3.message || String(e3))));
        try { if (Zotero.toast) Zotero.toast("导出失败：" + (e3 && e3.message || e3)); } catch (e4) {}
        return false;
      }
      try { if (Zotero.toast) Zotero.toast("单词本已导出：" + targetPath, 6000); } catch (e5) {}
      // 兜底路径没有对话框，写完自动打开 exports 文件夹帮助定位
      if (usedFallback && exportsDir) {
        try { if (Zotero.WordTranslator && typeof Zotero.WordTranslator.openInOS === "function") Zotero.WordTranslator.openInOS(exportsDir); } catch (e6) {}
      }
      this._debugLog("export OK: " + targetPath + " (" + fmt + ", " + sections.length + " section(s))");
      return true;
    } catch (e) {
      this._debugLog("_exportWordBook ERROR: " + (e && (e.stack || e.message || String(e))));
      return false;
    }
  },

  // 导出菜单（固定定位在导出按钮下方；复用 _cardMenu 的外部点击/Esc/滚动关闭机制）
  _showExportMenu(ev, itemID) {
    this._hideCardMenu();
    try {
      const btnEl = ev && ev.currentTarget;
      const doc = (btnEl && btnEl.ownerDocument) || (ev && ev.target && ev.target.ownerDocument);
      if (!doc || !btnEl) return;
      const self = this;
      const el = (tag, attrs, children) => this._createEl(doc, tag, attrs, children);
      const txt = (s) => this._createTxt(doc, s);
      const menu = el("div", { class: "wt-card-menu", role: "menu", style: "position:fixed;flex-direction:column;align-items:stretch;min-width:150px;" });
      const entries = [
        ["CSV · 当前条目", itemID, "csv"],
        ["CSV · 全部条目", null, "csv"],
        ["Markdown · 当前条目", itemID, "md"],
        ["Markdown · 全部条目", null, "md"],
        ["Anki · 当前条目", itemID, "anki"],
        ["Anki · 全部条目", null, "anki"],
      ];
      for (const [label, scope, fmt] of entries) {
        const b = el("button", { type: "button", class: "wt-card-menu-btn", title: label, "aria-label": label, style: "width:auto;min-width:130px;height:24px;padding:0 10px;font-size:12px;white-space:nowrap;text-align:left;" }, [txt(label)]);
        b.addEventListener("click", (e2) => {
          e2.preventDefault();
          e2.stopPropagation();
          self._hideCardMenu();
          Promise.resolve(self._exportWordBook(scope, fmt)).catch((err) => self._debugLog("export ERROR: " + (err && (err.stack || err.message || String(err)))));
        });
        menu.append(b);
      }
      const rect = btnEl.getBoundingClientRect();
      menu.style.left = Math.max(4, rect.left) + "px";
      menu.style.top = (rect.bottom + 4) + "px";
      (doc.body || doc.documentElement).append(menu);

      const onDoc = (e3) => { if (menu.contains(e3.target)) return; self._hideCardMenu(); };
      const onKey = (e3) => { if ((e3.key || "").toLowerCase() === "escape") self._hideCardMenu(); };
      const onScroll = () => self._hideCardMenu();
      doc.addEventListener("mousedown", onDoc, true);
      doc.addEventListener("keydown", onKey, true);
      doc.addEventListener("scroll", onScroll, true);
      this._cardMenu = { el: menu, doc, onDoc, onKey, onScroll };
    } catch (e) {
      this._debugLog("_showExportMenu ERROR: " + (e && (e.stack || e.message || e)));
    }
  },

  // ---------- 偏好面板 onload ----------
};

if (typeof WordTranslator !== "undefined") {
  try { Object.assign(WordTranslator, WordTranslatorModule_pane); } catch (e) { try { Zotero.debug("[WordTranslator] module pane assign ERROR: " + (e && (e.stack || e.message || e))); } catch (e2) {} }
}
