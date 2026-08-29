// Word Translator 模块：bridge（Phase 5 由 addon.js 机械拆分，纯移动无行为变更）
// 依赖：本文件在 addon.js 之后经 loadSubScript 注入，Object.assign 挂到同一 WordTranslator 对象上，this 绑定不变。
"use strict";

var WordTranslatorModule_bridge = {
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

  // —— 运行时状态（此前散落未声明，Phase 4 集中归位）——
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

};

if (typeof WordTranslator !== "undefined") {
  try { Object.assign(WordTranslator, WordTranslatorModule_bridge); } catch (e) { try { Zotero.debug("[WordTranslator] module bridge assign ERROR: " + (e && (e.stack || e.message || e))); } catch (e2) {} }
}
