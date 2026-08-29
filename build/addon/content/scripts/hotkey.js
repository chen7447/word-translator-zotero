// Word Translator 模块：hotkey（Phase 5 由 addon.js 机械拆分，纯移动无行为变更）
// 依赖：本文件在 addon.js 之后经 loadSubScript 注入，Object.assign 挂到同一 WordTranslator 对象上，this 绑定不变。
"use strict";

var WordTranslatorModule_hotkey = {
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
      this._debugLog("selection translate global keydown: spec=" + this._selectionTranslateKeyState.spec + ", source=" + source, "trace");
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
      this._debugLog("selection translate global keyup: spec=" + state.spec + ", source=" + source, "trace");
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
          self._debugLog("selection translate mouse down: reader=" + (session.reader && session.reader.tabID), "trace");
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
          self._debugLog("selection translate mouse up: result=selection-ready, text=" + JSON.stringify((session.popupContext && session.popupContext.text) || ""), "trace");
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
        ", keys=" + Object.keys(reader || {}).slice(0, 12).join(","),
        "trace"
      );
    } catch (e) {}
    if (!this._data || !this._data.enabled) return;
    const text = (params && params.annotation && params.annotation.text || "").trim();
    this._debugLog("popup text: len=" + text.length + ", text=" + JSON.stringify(text.slice(0, 120)), "trace");
    if (!text) {
      this._debugLog("popup skip: no selected text", "trace");
      return;
    }
    const selectionCheck = this._isSelectionTextAllowed(text);
    if (!selectionCheck.allowed) {
      this._debugLog(
        "popup skip: reason=" + selectionCheck.reason +
        ", mode=" + (selectionCheck.mode || "word") +
        ", len=" + text.length +
        ", max=" + (selectionCheck.maxLength || 0),
        "trace"
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
  _normalizeSelectionTranslateText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  },

  _clearSelectionTranslateState(reason) {
    this._debugLog("clear selection translate state: " + (reason || "unknown"));
    this._selectionTranslateSession = null;
  },

  // 当前选中文本是否有有效“先选区后按绑定键”缓存
  _getSelectionFirstPending() {
    const pending = this._selectionFirstPending;
    if (!pending || !pending.text) return null;
    if (Date.now() - (pending.time || 0) > 10000) return null;
    return pending;
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
      // Beta: update temp edit area
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
};

if (typeof WordTranslator !== "undefined") {
  try { Object.assign(WordTranslator, WordTranslatorModule_hotkey); } catch (e) { try { Zotero.debug("[WordTranslator] module hotkey assign ERROR: " + (e && (e.stack || e.message || e))); } catch (e2) {} }
}
