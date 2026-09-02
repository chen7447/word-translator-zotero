// Word Translator 模块：bridge（Phase 5 由 addon.js 机械拆分，纯移动无行为变更）
// 依赖：本文件在 addon.js 之后经 loadSubScript 注入，Object.assign 挂到同一 WordTranslator 对象上，this 绑定不变。
"use strict";

var WordTranslatorModule_bridge = {
  _xbuttonBridge: {
    active: false,           // 桥接是否运行
    process: null,           // Subprocess 进程对象（后台 powershell.exe，内存加载钩子）
    pollTimer: null,         // 事件文件轮询定时器
    eventFile: null,         // 事件文件路径
    exePath: null,           // 旧版遗留 bridge-hook.exe 路径（启动时清理用；现已不落地 exe）
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
      // 先删旧文件再建——部分机器的 Gecko 不执行 nsIFileOutputStream 的 TRUNCATE 标志，
      // 会把整份内容追加到旧文件后面，导致 bridge-hook.cs 变成 N 份源码拼接、Add-Type
      // 编译报「using 子句必须位于…」。显式删除后重建保证永远只有一份干净内容。
      try { if (f.exists()) f.remove(false); } catch (e) {}
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

      // 清理历史遗留的 bridge-hook.exe：旧版本在数据目录留下过预编译/现场编译的
      // exe，杀软常把它当可疑全局钩子秒删（tmp.exe 出现即消失即此症状）。现在改为
      // PowerShell 内存加载，不再有 exe，遗留在盘上的只会不断触发误报，直接删掉。
      try {
        const oldExe = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        oldExe.initWithPath(this._xbuttonBridge.exePath);
        if (oldExe.exists()) { try { oldExe.remove(false); } catch (e) {} }
      } catch (e) {}
      // 也尝试清理旧版可能残留的临时编译产物名
      try {
        const oldTmp = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        oldTmp.initWithPath(this._xbuttonBridge.exePath + "-tmp.exe");
        if (oldTmp.exists()) { try { oldTmp.remove(false); } catch (e) {} }
      } catch (e) {}

      // 提取 bridge-hook.cs（C# 钩子源文件，供 PowerShell 内存加载）
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

      // ── WH_MOUSE_LL 钩子：PowerShell Add-Type 内存加载 C#，不落地任何 exe。
      // 旧方案（Add-Type -OutputAssembly 生成 bridge-hook.exe）在装了杀软的机器上
      // 会被静默删除刚生成的 exe（现象：bridge-hook.exe-tmp.exe 闪现即消失 → 无 exe
      // → 侧键失效）。内存加载不落 PE 文件，绕开该误报，且不再依赖写权限/编译产物留存。
      let bridgeProc = null;
      try {
        // 编译失败时把错误写进事件文件（_bridgeInit:false），由轮询器显示状态；
        // 不用 stderr 管道——进程是长驻的，stderr 一旦写满会阻塞钩子消息泵。
        const evtQ = this._xbuttonBridge.eventFile.replace(/'/g, "''");
        const csQ = this._xbuttonBridge.hookSourcePath.replace(/'/g, "''");
        const psCommand =
          "$ErrorActionPreference='Stop';" +
          "try { Add-Type -TypeDefinition (Get-Content -LiteralPath '" + csQ + "' -Raw) } catch {" +
          " $e = $_.Exception.Message -replace '[\\r\\n\"\\\\]',' ';" +
          " try { [IO.File]::WriteAllText('" + evtQ + "', ('{\"_bridgeInit\":false,\"error\":\"CS compile: ' + $e + '\"}'), (New-Object System.Text.UTF8Encoding($false))) } catch {};" +
          " exit 1 };" +
          "try { [WordTranslatorBridge.Program]::Run(@('-EventFile','" + evtQ + "','-ParentPid','" + String(zoteroPid) + "')) | Out-Null } catch { exit 2 }";

        bridgeProc = await Subprocess.call({
          command: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
          arguments: [
            "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-WindowStyle", "Hidden", "-Command", psCommand,
          ],
          stderr: "ignore",
          stdout: "ignore",
        });
        this._debugLog("xbutton bridge: hook (in-memory) started, PID=" + (bridgeProc.pid || "?"));
        this._writeBridgeDebug("hook in-memory started via powershell PID=" + (bridgeProc.pid || "?") + ", parentPid=" + zoteroPid);
        this._xbuttonBridge.hookMode = true;
      } catch (e) {
        this._debugLog("xbutton bridge: hook launch FAILED: " + (e && (e.message || e)));
        this._writeBridgeDebug("hook launch FAILED: " + (e && (e.message || e)));
        bridgeProc = null;
      }

      // 启动失败：记录错误并显示状态，交由保活退避重试
      if (!bridgeProc) {
        this._xbuttonBridge.hookMode = false;
        this._debugLog("xbutton bridge: FAILED to start WH_MOUSE_LL hook");
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

  // 提取 bridge-hook.cs（C# 源文件，供 PowerShell 内存加载；纯文本，杀软不拦）。
  async _extractBridgeFiles() {
    const hookSourcePath = this._xbuttonBridge.hookSourcePath;
    if (!hookSourcePath) return false;
    try {
      const uri = this._addonRoot + "content/scripts/bridge-hook.cs";
      const content = await this._readAddonResource(uri);
      if (!content) { this._debugLog("xbutton bridge: bridge-hook.cs not found in addon"); return false; }
      const ok = this._writeTextFile(hookSourcePath, content, false);
      this._debugLog("xbutton bridge: hook source extracted (" + (ok ? "ok" : "fail") + ")");
      return ok;
    } catch (e) {
      this._debugLog("xbutton bridge: bridge-hook.cs extraction error: " + (e && (e.message || e)));
      return false;
    }
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
