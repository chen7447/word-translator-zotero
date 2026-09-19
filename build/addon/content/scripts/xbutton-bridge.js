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
    confirmed: false,        // 钩子进程是否已回写 _bridgeInit 确认（addon 侧看门狗用）
    fingerprint: null,       // 钩子进程启动参数指纹（变化时需要重建进程，如吞键开关）
    blockFlag: 1,            // 当前传给钩子的吞键参数（1=吞掉 0=放行）
    consumerKeys: 1,         // 是否同时捕获多媒体键形态侧键（VK_BROWSER_* / 消费页报文）
    kbHook: false,           // 钩子进程回报：低级键盘钩子是否装上（消费键通道 A）
    hidSink: false,          // 钩子进程回报：原始输入监听是否装上（消费键通道 B，仅检测）
    mouseHook: true,         // 钩子进程回报：低级鼠标钩子是否装上（标准 XButton 通道；单独特效时前进仍可能正常）
    consumerNoticeShown: false, // 本次会话是否已提示过「兼容模式」说明
    lastWatchdogRestart: 0,  // addon 侧看门狗上次重启时间（节流）
    recordUntil: 0,          // 录制窗口截止时间戳（0=未开启；偏好页轮询倒计时用）
    lastRecordButton: 0,       // 最近一次识别到的侧键（1/2；0=未识别）
    lastRecordTs: 0,           // 最近一次识别成功时间戳（设置页轮询显示用）
    lastRecordCode: "",        // 最近一次录制的泛化键（vk:0xNN / hid:0xNNNN；第三颗侧键等）
    recordCodes: null,       // 录制窗口内收集到的 code 集合（一次按键可能同时走 vk/hid 两通道）
    recordSettleTimer: null, // 录制收集窗：等 vk/hid 双通道都到齐再择优绑定
    recordTimer: null,       // 录制窗口到期定时器（到期必须复位钩子参数，见 _armRecordExpiry）
  },
  _subprocessModule: null,   // Subprocess 模块缓存
  _XBUTTON_RECORD_MS: 60000, // 录制窗口时长（秒数 = 本值/1000，超时文案由它插值）

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
      // 按需启停门控：钩子是系统级监听，只有真正使用侧键绑定时才启动
      //（录制窗口期间也启动，否则「先开关后绑定」的流程永远识别不到按键）。
      // 键盘模式/功能关闭/主开关关闭时绝不装钩子——否则侧键会被系统层吞掉、
      // 用户的其他鼠标软件也会失明，表现为「装了插件侧键/后退全坏了」。
      if (!this._xbuttonHotkeyWanted() && !this._xbuttonRecordActive()) {
        this._debugLog("xbutton bridge: not wanted (master switch off / addWordHotkey disabled / mode not xbutton), skip start");
        return;
      }

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

      // 清理旧事件文件与参数文件（参数残留会被新进程首轮轮询应用，覆盖刚传入的
      // CLI 参数——「录制中崩溃 → 重启后录制语义残留」的根因，双保险之一）
      try {
        const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        f.initWithPath(this._xbuttonBridge.eventFile);
        if (f.exists()) f.remove(false);
      } catch (e) {}
      try {
        const pf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        pf.initWithPath(this._xbuttonBridge.eventFile.replace(/[\\/][^\\/]+$/, "") + "\\bridge-params.json");
        if (pf.exists()) pf.remove(false);
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
        // -Block：1=吞掉侧键（默认，禁后退/前进误触）；0=放行，但被绑定的那颗
        // 标准侧键例外仍吞（绑定=接管，防触发翻译的同时 PDF 翻页）——未绑定的
        // 侧键与系统后退/前进完全不受影响，与罗技/XMBC 等鼠标软件共存。
        const blockFlag = this._xbuttonBlockFlag();
        const consumerFlag = this._xbuttonConsumerKeysFlag();
        // 录制窗口需要钩子上报所有多媒体键（泛化录制）；运行期需要上报显式绑定的
        // code 键（vk:0xNN / hid:0xNNNN），否则录制完的第三颗侧键永远等不到事件。
        const recordFlag = this._xbuttonRecordActive() ? 1 : 0;
        const runMode = (this._data && this._data.addWordHotkeyMode) || "";
        const bindCode = this._xbuttonBindCodeOf(runMode);
        const bindCodeQ = String(bindCode).replace(/'/g, "''");
        const evtQ = this._xbuttonBridge.eventFile.replace(/'/g, "''");
        const csQ = this._xbuttonBridge.hookSourcePath.replace(/'/g, "''");        const psCommand =
          "$ErrorActionPreference='Stop';" +
          "try { Add-Type -TypeDefinition (Get-Content -LiteralPath '" + csQ + "' -Raw) } catch {" +
          " $e = $_.Exception.Message -replace '[\\r\\n\"\\\\]',' ';" +
          " try { [IO.File]::WriteAllText('" + evtQ + "', ('{\"_bridgeInit\":false,\"error\":\"CS compile: ' + $e + '\"}'), (New-Object System.Text.UTF8Encoding($false))) } catch {};" +
          " exit 1 };" +
          "try { [WordTranslatorBridge.Program]::Run(@('-EventFile','" + evtQ + "','-ParentPid','" + String(zoteroPid) + "','-Block','" + blockFlag + "','-ConsumerKeys','" + consumerFlag + "','-Record','" + recordFlag + "','-XButton','" + this._boundXButtonFlag() + "'" + (bindCode ? ",'-BindCode','" + bindCodeQ + "'" : "") + ")) | Out-Null } catch { exit 2 }";

        bridgeProc = await Subprocess.call({
          command: this._resolvePowerShellPath(),
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
        this._updateXButtonBridgeStatus({ hookError: "bridge-failed" });
        return;
      }

      this._xbuttonBridge.process = bridgeProc;
      this._xbuttonBridge.active = true;
      this._xbuttonBridge.startedAt = Date.now();
      this._xbuttonBridge.restartCount = 0;
      this._xbuttonBridge.lastEventTs = 0;
      this._xbuttonBridge.confirmed = false; // 等 _bridgeInit 确认；2 分钟未确认由看门狗重启
      this._xbuttonBridge.blockFlag = this._xbuttonBlockFlag();
      this._xbuttonBridge.consumerKeys = this._xbuttonConsumerKeysFlag();
      this._xbuttonBridge.fingerprint = this._xbuttonBridgeFingerprint();

      // 保活监视
      const self = this;
      bridgeProc.wait().then(function () {
        if (self._xbuttonBridge.process !== bridgeProc) return;
        const uptimeMs = Date.now() - (self._xbuttonBridge.startedAt || 0);
        self._debugLog("xbutton bridge: process exited (uptime=" + Math.round(uptimeMs / 1000) + "s)");
        self._writeBridgeDebug("bridge process exited (uptime=" + Math.round(uptimeMs / 1000) + "s)");
        self._xbuttonBridge.active = false;
        self._xbuttonBridge.process = null;
        self._xbuttonBridge.confirmed = false;
        // 稳定运行超过 10 分钟后的退出（杀软扫描误杀、系统清理等）不算「连续崩溃」，
        // 重置计数——否则老版本会在 5 次退避后永久放弃，表现成「好好的某天突然就不行，
        // 重启 Zotero 才恢复」。
        if (uptimeMs > 600000) self._xbuttonBridge.restartCount = 0;
        if (self._initialized) self._scheduleBridgeRestart();
      });

      // 启动文件轮询
      this._startXButtonPolling();

      this._updateXButtonBridgeStatus({
        hookError: null, // 启动成功即清掉上次的错误（合并写入不会自动清）
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
    if (this._xbuttonBridge.recordTimer) {
      clearTimeout(this._xbuttonBridge.recordTimer);
      this._xbuttonBridge.recordTimer = null;
      this._xbuttonBridge.recordUntil = 0;
    }
    if (this._xbuttonBridge.recordSettleTimer) {
      clearTimeout(this._xbuttonBridge.recordSettleTimer);
      this._xbuttonBridge.recordSettleTimer = null;
      this._xbuttonBridge.recordCodes = null;
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
    // 清理事件文件与参数文件（参数文件残留会被下一个进程首轮轮询应用，
    // 覆盖其 CLI 参数——「录制中停止 → 残留录制语义」的根因，双保险之二）
    if (this._xbuttonBridge.eventFile) {
      try {
        const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        f.initWithPath(this._xbuttonBridge.eventFile);
        if (f.exists()) f.remove(false);
      } catch (e) {}
      try {
        const pf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        pf.initWithPath(this._xbuttonBridge.eventFile.replace(/[\\/][^\\/]+$/, "") + "\\bridge-params.json");
        if (pf.exists()) pf.remove(false);
      } catch (e) {}
    }
    this._xbuttonBridge.active = false;
    this._xbuttonBridge.hookMode = false;
    this._xbuttonBridge.confirmed = false;
    this._xbuttonBridge.lastEventTs = 0;
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
  // 目录从 eventFile 推导（exePath 是旧 exe 方案遗物，不再作为路径依据）。
  // 追加写带轮转上限：超过 512KB 时重写为最后 100KB，避免无限增长。
  _writeBridgeDebug(msg) {
    try {
      const evtFile = this._xbuttonBridge.eventFile;
      if (!evtFile) return;
      const sep = evtFile.indexOf("\\") >= 0 ? "\\" : "/";
      const dataDir = evtFile.replace(/[\\/][^\\/]+$/, "");
      if (!dataDir) return;
      const line = "[" + new Date().toISOString() + "] [addon] " + String(msg) + "\n";
      const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      f.initWithPath(dataDir + sep + "bridge-debug.log");
      // 轮转：512KB 上限，重写为尾 100KB（粗截即可，纯诊断用途）
      if (f.exists() && f.fileSize > 512 * 1024) {
        try {
          const fin = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
          fin.init(f, 0x01, 0o444, 0);
          fin.seek(fin.NS_SEEK_END, -100 * 1024);
          const bin = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream);
          bin.setInputStream(fin);
          const tail = bin.readBytes(100 * 1024);
          bin.close(); fin.close();
          const cut = tail.indexOf("\n"); // 丢掉被截断的半行
          const cleaned = cut >= 0 ? tail.substring(cut + 1) : tail;
          f.remove(false);
          const wout0 = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
          wout0.init(f, 0x02 | 0x08, 0o666, 0); // write|create（覆盖式重建）
          const wconv0 = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
          wconv0.init(wout0, "UTF-8", 4096, 0xFFFD);
          wconv0.writeString("[log rotated]\n" + cleaned);
          wconv0.close(); wout0.close();
        } catch (e2) { try { if (f.exists()) f.remove(false); } catch (e3) {} }
      }
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
        try { self._xbuttonBridgeWatchdogTick(); } catch (e) {}
        poll();
      }, 100); // 100ms 轮询
    }
    poll();
  },

  // addon 侧看门狗：钩子进程活着但 2 分钟仍未收到 _bridgeInit 确认
  //（典型：PowerShell 编译被杀软拦下、事件文件写不进去），重启进程；
  // 同一次异常每 5 分钟最多重试一次，避免与 C# 进程内的自愈看门狗互相踩踏。
  // （C# 进程内的看门狗负责「钩子被系统静默摘除但进程还活着」的场景，
  //   两个看门狗互补：那个修「假活」，这个修「假死」。）
  _xbuttonBridgeWatchdogTick() {
    const b = this._xbuttonBridge;
    if (!b.active || !b.process || b.confirmed !== false) return;
    const now = Date.now();
    if (!b.startedAt || now - b.startedAt < 120000) return;
    if (b.lastWatchdogRestart && now - b.lastWatchdogRestart < 300000) return;
    b.lastWatchdogRestart = now;
    this._debugLog("xbutton bridge: watchdog restart (no _bridgeInit confirm within 2min)");
    this._writeBridgeDebug("watchdog: restart unconfirmed hook (no _bridgeInit for 2min)");
    try { this._stopXButtonBridge(); } catch (e) {}
    b.restartCount = 0;
    this._startXButtonBridge();
  },

  // ---- 共享事件处理（文件轮询用） ----

  _processXButtonEvent(event, source) {
    if (!event || typeof event !== "object") return;

    // 桥接启动确认标记
    if (event._bridgeInit === true) {
      this._xbuttonBridge.confirmed = true;
      //（旧 exe-fallback 方案的 fallback 分支已删：PowerShell 内存加载从不产生
      //  fallback 事件，hookMode 恒为 true，与 confirmed 同义。）
      this._xbuttonBridge.hookMode = true;
      this._xbuttonBridge.kbHook = event.kbHook === true;
      this._xbuttonBridge.hidSink = event.hidSink === true;
      // 鼠标钩子状态也必须回报：只报键盘钩子/原始输入时，「鼠标钩子单独失效」
      // 在界面上完全不可见——而那恰好表现为「标准侧键（多为后退）失灵、被系统
      // 映射成多媒体键的那颗（多为前进）却正常」，是本轮用户问题的关键盲点。
      if (typeof event.mouseHook === "boolean") this._xbuttonBridge.mouseHook = event.mouseHook;
      const detectors = "mouse=" + this._xbuttonBridge.hookMode
        + " mouseHook=" + (this._xbuttonBridge.mouseHook !== false)
        + " kb=" + this._xbuttonBridge.kbHook + " rawSink=" + this._xbuttonBridge.hidSink;
      this._debugLog("xbutton bridge: hook confirmed via file (" + detectors + ")"
        + (event.error ? " (error: " + event.error + ")" : ""));
      this._writeBridgeDebug("hook confirmed: " + detectors + (event.diag ? ", diag=on" : ""));
      this._updateXButtonBridgeStatus({
        hookError: event.error || "",
      });
      // 接管提醒：本次会话首次确认时，告知「系统后退/前进已被侧键接管」的取舍，
      // 用户可据此决定是否保留该功能（消费键通道开启且处于吞键模式时才提示）。
      this._maybeNotifyConsumerTakeover();
      return;
    }

    // 钩子编译失败标记
    if (event._bridgeInit === false) {
      this._xbuttonBridge.confirmed = false;
      this._debugLog("xbutton bridge: hook init failed: " + (event.error || "unknown"));
      this._xbuttonBridge.hookMode = false;
      this._updateXButtonBridgeStatus({
        hookError: "hook-init-failed: " + (event.error || ""),
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

    // 刷新配置并检查是否启用；不满足触发条件时给出可见反馈，
    // 避免「键被钩子吞了但什么都没发生」被当成侧键坏了（这是
    // 「新装插件后侧键不好使」投诉里最常见的静默失败路径）。
    this._refreshPrefsFromStorage();
    var evSrc = (event.src || "mouse");
    // ── 录制（绑定）模式：用户按哪颗键，就把绑定改成那颗 ──
    //（解决「2.4G 能用、蓝牙就失灵」「换了鼠标编号不同」——不同模式下两颗侧键的
    //  上报顺序可能对调，固定绑定某颗就会失效。录制期间不触发翻译；标准侧键
    //  与 vk 形态的浏览器键均被吞（防 PDF 翻页），仅消费页 hid 形态拦不住。）
    // 注意：录制分支必须在「兼容模式（消费键通道）」拦截之前——否则用户一旦关闭
    // 兼容模式，录制期间连观察通道都不会开启，会把「信号存在但我们没监听」
    // 误判成「该键什么都没发出」，把用户引向「鼠标坏了」的错误结论。
    if (this._xbuttonRecordActive()) {
      var dbtn = (event.x1 === 1) ? 1 : ((event.x2 === 1) ? 2 : 0);
      if (dbtn > 0) {
        var isConsumerForm = (evSrc === "vk" || evSrc === "hid");
        // 录到了，但用户没开兼容模式：不能绑定（绑了也不会被捕获），
        // 但要明确告诉他该怎么做——这是蓝牙鼠标最常见的真实原因。
        if (isConsumerForm && (this._data && this._data.xbuttonCompat === false)) {
          var msg = "识别到该侧键是「" + this._xbuttonSrcLabel(evSrc) + "」：请在设置页打开"
            + "「兼容模式」后再绑定一次即可使用。";
          this._xbuttonRecordClear();
          this._writeBridgeDebug("record: consumer-form detected but compat mode off");
          this._debugLog("xbutton detect: " + msg);
          this._updateXButtonBridgeStatus({
            lastNote: msg,
            lastReason: msg,
            lastBtn: "",
            lastNoteTs: Date.now(),
          });
          this._showXButtonToast("识别到多媒体键形态侧键", msg);
          this.syncXButtonBridge();
          return;
        }
        this._xbuttonBindDetected((dbtn === 1) ? "xbutton1" : "xbutton2", evSrc, null);
      }
      else if (event.code) {
        // 泛化录制：一次物理按键可能同时经键盘钩子（vk）与原始输入（hid）两条通道
        // 到达。先收集，开 700ms 收集窗等双通道到齐，再择优（vk 可吞键，优先）。
        if (!this._xbuttonBridge.recordCodes) this._xbuttonBridge.recordCodes = {};
        this._xbuttonBridge.recordCodes[event.code] = true;
        this._debugLog("xbutton record: candidate " + event.code);
        if (this._xbuttonBridge.recordSettleTimer) clearTimeout(this._xbuttonBridge.recordSettleTimer);
        const self2 = this;
        this._xbuttonBridge.recordSettleTimer = setTimeout(function () {
          self2._xbuttonBridge.recordSettleTimer = null;
          const codes = self2._xbuttonBridge.recordCodes || {};
          self2._xbuttonBridge.recordCodes = null;
          const vkCode = Object.keys(codes).filter((c) => c.indexOf("vk:") === 0)[0] || "";
          const hidCode = Object.keys(codes).filter((c) => c.indexOf("hid:") === 0)[0] || "";
          const best = vkCode || hidCode;
          if (!best || !self2._xbuttonRecordActive()) return; // 窗口已结束/被取消
          // 多媒体键形态绑定需要兼容模式通道：兼容模式关着时给出引导，不绑
          if (self2._data && self2._data.xbuttonCompat === false) {
            const msg2 = "识别到该键是「" + self2._xbuttonCodeLabel(best) + "」（多媒体键形态）：请在设置页打开"
              + "「兼容模式」后再绑定一次即可使用。";
            self2._xbuttonRecordClear();
            self2._updateXButtonBridgeStatus({ lastNote: msg2, lastReason: msg2, lastBtn: "", lastNoteTs: Date.now() });
            self2._showXButtonToast("识别到多媒体键形态", msg2);
            self2.syncXButtonBridge();
            return;
          }
          self2._xbuttonBindDetected(best, best.indexOf("vk:") === 0 ? "vk" : "hid", best);
        }, 700);
      }
      return;
    }

    // 消费键形态（多媒体键 / 消费页报文）只在开关开启时才算「我们的侧键」。
    // 进程层已按 -ConsumerKeys 决定是否安装相应通道，这里再拦一道：保证
    // 「取消勾选 = 系统后退/前进不被本插件接管」这一承诺在任何时序下都成立
    //（例如开关刚切换、旧进程残留事件仍写进事件文件的那一瞬间）。
    // 例外：显式录制绑定的 code 键（vk:0xNN / hid:0xNNNN）不受此拦截——用户明确
    // 绑定了这颗键，就算之后关掉兼容模式，绑定也应该继续生效。
    var runMode = this._data && this._data.addWordHotkeyMode;
    var isBoundCodeEvent = !!(event.code && typeof runMode === "string" && runMode === event.code);
    if ((evSrc === "vk" || evSrc === "hid") && this._xbuttonConsumerKeysFlag() !== 1 && !isBoundCodeEvent) {
      this._debugLog("xbutton bridge: ignore consumer-form event (src=" + evSrc + "), consumer capture disabled");
      return;
    }

    if (!this._addWordHotkeyActive()) {
      this._xbuttonNoteSkip("收到侧键，但未触发：「添加单词」快捷键未开启，或绑定模式不是鼠标侧键（请在设置页检查）", event);
      return;
    }
    var pending = this._getSelectionFirstPending();
    if (!pending) {
      // 兜底：缓存过期/未记录时，改读「屏幕上此刻仍然高亮的实时选区」。
      // 实测用户节奏是「划词 → 读一会儿/把手移到侧键 → 再按」，缓存只有 10 秒，
      // 于是高亮还在、插件却说没有选区——最容易被判成「侧键坏了」。
      try {
        if (typeof this._recoverSelectionFirstPending === "function") {
          pending = this._recoverSelectionFirstPending("xbutton");
          if (pending) {
            this._selectionFirstPending = pending;
            this._debugLog("xbutton: recovered live selection: " + JSON.stringify(String(pending.text).slice(0, 60)));
          }
        }
      } catch (e) {}
    }
    if (!pending) {
      var stale = this._selectionFirstPending;
      var extra = (stale && stale.text) ? "（上次划词已超过 10 秒，且当前页面没有选中文字）" : "";
      this._xbuttonNoteSkip("收到侧键，但当前没有选中单词" + extra, event);
      return;
    }

    // 检查是否匹配当前绑定：标准侧键按编号匹配，泛化键按信号指纹匹配
    var mode = runMode;
    var matched = false;
    var btnLabel = "";
    if (typeof mode === "string" && (mode.indexOf("vk:") === 0 || mode.indexOf("hid:") === 0)) {
      matched = (event.code === mode);
      btnLabel = this._xbuttonCodeLabel(mode);
    } else {
      var isX1 = (event.x1 === 1) && (mode === "xbutton1" || mode === "xbutton-both");
      var isX2 = (event.x2 === 1) && (mode === "xbutton2" || mode === "xbutton-both");
      matched = (isX1 || isX2);
      btnLabel = this._xbuttonLabel(event.x1 === 1 ? 1 : 2);
    }
    if (!matched) {
      this._xbuttonNoteSkip("收到" + btnLabel + "，但当前绑定为「"
        + this._xbuttonModeLabel(mode) + "」：请在设置页的「绑定侧键」框重新绑定", event);
      return;
    }

    // 成功触发：清掉上一次的「未触发」警示（null = 从状态 JSON 里删除该键），
    // 并记录本次按下的侧键——设置页状态行随之显示「最近：…」且不再带 ⚠️。
    this._updateXButtonBridgeStatus({
      lastBtn: (event.code ? this._xbuttonCodeLabel(event.code) : (event.x1 === 1 ? "XButton1" : "XButton2")),
      lastReason: null,
      lastNote: null,
      lastNoteTs: Date.now(),
    });
    this._debugLog("xbutton bridge: triggered via " + source
      + " (src=" + (event.src || "mouse") + ", code=" + (event.code || "-") + "), mode=" + mode);
    this._fireAddWordHotkey();
  },

  // 录制成功：写入绑定、更新识别状态、弹提示、按正常参数重启钩子
  _xbuttonBindDetected(dmode, src, code) {
    this._xbuttonRecordClear();
    this._xbuttonBridge.lastRecordButton = (dmode === "xbutton2") ? 2 : ((dmode === "xbutton1") ? 1 : 0);
    this._xbuttonBridge.lastRecordTs = Date.now();
    this._xbuttonBridge.lastRecordCode = code || "";
    try {
      this._data.addWordHotkeyMode = dmode;
      if (typeof this._saveData === "function") this._saveData();
    } catch (e) {}
    this._writeBridgeDebug("record: bound mode=" + dmode + " src=" + src);
    this._debugLog("xbutton detect: bound " + dmode + " (src=" + src + ")");
    this._showXButtonToast("已绑定：" + this._xbuttonModeLabel(dmode),
      "现在先划选单词，再按这颗键即可翻译。");
    // 录制结束 → 热切回正常参数（吞键），立即生效（不重启进程）
    this.syncXButtonBridge();
  },

  // 结束录制窗口：清定时器与收集缓存（不动绑定）
  _xbuttonRecordClear() {
    this._xbuttonBridge.recordUntil = 0;
    if (this._xbuttonBridge.recordTimer) {
      try { clearTimeout(this._xbuttonBridge.recordTimer); } catch (e0) {}
      this._xbuttonBridge.recordTimer = null;
    }
    if (this._xbuttonBridge.recordSettleTimer) {
      try { clearTimeout(this._xbuttonBridge.recordSettleTimer); } catch (e1) {}
      this._xbuttonBridge.recordSettleTimer = null;
    }
    this._xbuttonBridge.recordCodes = null;
  },

  // 泛化键指纹（vk:0xNN / hid:0xNNNN）→ 用户可读名称
  _xbuttonCodeLabel(code) {
    const m = /^vk:0x([0-9A-Fa-f]{2})$/.exec(String(code || ""));
    if (m) {
      const vk = m[1].toUpperCase();
      const names = {
        A6: "浏览器后退键", A7: "浏览器前进键", A8: "浏览器刷新键", A9: "浏览器停止键",
        AA: "浏览器搜索键", AB: "浏览器收藏键", AC: "浏览器主页键", AD: "静音键",
        AE: "音量减键", AF: "音量加键", B0: "下一曲键", B1: "上一曲键",
        B2: "停止播放键", B3: "播放/暂停键", B4: "邮件键", B5: "媒体选择键",
        B6: "自定义应用键 1", B7: "自定义应用键 2",
      };
      return (names[vk] || "多媒体键 0x" + vk) + "（多媒体键形态）";
    }
    const h = /^hid:0x([0-9A-Fa-f]{4})$/.exec(String(code || ""));
    if (h) return "多媒体键（消费页 0x" + h[1].toUpperCase() + "）";
    return String(code || "未识别的键");
  },

  // 侧键编号 → 用户可读名称
  _xbuttonLabel(btn) {
    return (btn === 2) ? "鼠标侧键 2（前进键）" : "鼠标侧键 1（后退键）";
  },

  // 绑定模式 → 用户可读名称
  _xbuttonModeLabel(mode) {
    if (mode === "xbutton1") return "鼠标侧键 1（后退键）";
    if (mode === "xbutton2") return "鼠标侧键 2（前进键）";
    if (mode === "xbutton-both") return "任意侧键（侧键 1 / 侧键 2 均可触发）";
    if (typeof mode === "string" && (mode.indexOf("vk:") === 0 || mode.indexOf("hid:") === 0)) {
      return this._xbuttonCodeLabel(mode);
    }
    return String(mode || "未绑定");
  },

  // 绑定码形状（vk:0xNN / hid:0xNNNN）的单一判定入口：runMode 是合法绑定码则
  // 原样返回，否则返回空串。指纹/参数/args 组装点共用，避免正则漂移。
  _xbuttonBindCodeOf(runMode) {
    return (typeof runMode === "string" && /^(vk:0x[0-9A-F]{2}|hid:0x[0-9A-F]{4})$/i.test(runMode))
      ? runMode : "";
  },

  // 判断绑定值是否属于「侧键/泛化键」家族（供 wanted/active/互斥逻辑共用）
  _xbuttonIsSideKeyMode(mode) {
    if (mode === "xbutton1" || mode === "xbutton2" || mode === "xbutton-both") return true;
    return typeof mode === "string" && (mode.indexOf("vk:") === 0 || mode.indexOf("hid:") === 0);
  },

  // 侧键相关提示统一入口（右下角 Progress Window）
  _showXButtonToast(headline, msg, ms) {
    try {
      if (typeof Zotero === "undefined" || !Zotero.ProgressWindow) return;
      var pw = new Zotero.ProgressWindow({ closeOnClick: true });
      pw.changeHeadline("单词翻译 · " + (headline || "鼠标侧键"));
      if (msg) pw.addDescription(String(msg));
      pw.show();
      pw.startCloseTimer(ms || 5000);
    } catch (e) {}
  },

  // 事件来源标签：钩子进程用三种探测器覆盖三类侧键形态，诊断时需要区分是哪条通道触发，
  // 因为只有「多媒体键形态」和「消费页报文」两条通道涉及蓝牙/厂商映射鼠标。
  _xbuttonSrcLabel(src) {
    if (src === "vk") return "多媒体键形态（系统映射为浏览器后退/前进键）";
    if (src === "hid") return "消费页报文形态（仅检测，无法拦截）";
    return "标准 XButton 形态";
  },

  // 「兼容模式」弹窗文案的唯一来源（设置页开启时与钩子确认时的弹窗共用同一段，
  // preferences.js 通过 Zotero.WordTranslator._compatNoticeLines() 取用）。
  // 刻意保持两行：一行讲后果，一行讲怎么关。悬停提示是另一句更短的话，见 preferences.js。
  _compatNoticeLines() {
    return [
      "系统级「后退/前进」被侧键接管，改为触发划词翻译。",
      "侧键正常时无需开启；不需要时在设置页随时关闭。",
    ];
  },

  // 兼容模式开启提醒（只在钩子确认时补一次、且终身一次：xbuttonConsumerNoticeAck 记住）。
  // 设置页「点击开启」时的弹窗由 preferences.js 负责——那里是用户明确的一次交互；
  // 这里若再弹就变成连弹两次（实测用户反馈），因此不再有 force 入口。
  _maybeNotifyConsumerTakeover() {
    try {
      const b = this._xbuttonBridge;
      if (this._xbuttonConsumerKeysFlag() !== 1 || this._xbuttonBlockFlag() !== 1) return;
      // 已经提示过并记住了（跨会话），或本次会话已弹过，就不再打扰
      if (this._data && this._data.xbuttonConsumerNoticeAck === true) return;
      if (b.consumerNoticeShown) return;
      b.consumerNoticeShown = true;
      if (typeof Zotero !== "undefined" && Zotero.ProgressWindow) {
        const pw = new Zotero.ProgressWindow({ closeOnClick: true });
        pw.changeHeadline("单词翻译 · 兼容模式已开启");
        for (const line of this._compatNoticeLines()) pw.addDescription(line);
        pw.show();
        pw.startCloseTimer(6000);
      }
      // 记住已提示（一次性）：下次启动不再弹。
      try {
        if (this._data && this._data.xbuttonConsumerNoticeAck !== true) {
          this._data.xbuttonConsumerNoticeAck = true;
          if (typeof this._saveData === "function") this._saveData();
        }
      } catch (e) {}
      this._writeBridgeDebug("compat-mode notice shown (block=" + this._xbuttonBlockFlag()
        + ", consumerKeys=" + this._xbuttonConsumerKeysFlag() + ")");
    } catch (e) {}
  },

  // 收到侧键但未触发：只记录到设置页状态行（结构化字段，界面上有 ⚠️ 提示），
  // 不再弹右下角 toast——PDF 页里读文献时按侧键，弹窗比不弹更打断人（用户实测反馈）。
  _xbuttonNoteSkip(reason, event) {
    try {
      const detail = (event && event.x1 === 1) ? "XButton1" : ((event && event.x2 === 1) ? "XButton2" : "XButton");
      const srcLabel = this._xbuttonSrcLabel(event && event.src);
      this._updateXButtonBridgeStatus({
        lastNote: detail + "（" + srcLabel + "）未触发: " + reason,
        lastBtn: detail,
        lastReason: String(reason),
        lastNoteTs: Date.now(),
      });
      this._debugLog("xbutton bridge: " + detail + " not triggered: " + reason);
    } catch (e) {}
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
      this._updateXButtonBridgeStatus({ hookError: "max-restarts" });
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

  // 状态写入：合并（不是整体覆盖）。
  // 状态来自多个来源（启动/停止、钩子确认、最近未触发原因、识别结果），覆盖式写入
  // 会让「最近一次为什么没触发」在下一次启动/停止时被抹掉——诊断信息就此消失，
  // 用户看到的永远是一个黑盒。（这正是此前的状态不可见问题之一。）
  // 需要清理某个字段时显式传 null（合并后置空）。
  // 白名单瘦身：状态行真正读的只有 5 个键（lastReason/lastNote/lastBtn/lastNoteTs/
  // hookError）；running/pid/confirmed/hookMode/mouseHook/kbHook/hidSink 等运行时
  // 状态在 _xbuttonBridge 活对象上、偏好页直接读活对象，写进 pref 只是冗余镜像——
  // 一律在写入器丢弃，防止载荷继续膨胀。
  _updateXButtonBridgeStatus(status) {
    const KEEP = { lastNote: 1, lastReason: 1, lastBtn: 1, lastNoteTs: 1, hookError: 1 };
    try {
      var prev = {};
      try {
        var cur = null;
        if (typeof Zotero !== "undefined" && Zotero.Prefs && typeof Zotero.Prefs.get === "function") {
          cur = Zotero.Prefs.get("extensions.zotero.wordtranslator.xbuttonBridgeStatus", true);
        } else if (typeof Services !== "undefined" && Services.prefs) {
          cur = Services.prefs.getStringPref("extensions.zotero.wordtranslator.xbuttonBridgeStatus", "");
        }
        if (cur) prev = JSON.parse(String(cur)) || {};
      } catch (e0) { prev = {}; }
      var merged = {};
      for (var k in prev) { if (Object.prototype.hasOwnProperty.call(prev, k)) merged[k] = prev[k]; }
      for (var k2 in (status || {})) {
        if (!Object.prototype.hasOwnProperty.call(status, k2)) continue;
        if (!KEEP[k2]) continue; // 白名单外的键：丢弃（运行时状态走活对象）
        if (status[k2] === null) delete merged[k2]; else merged[k2] = status[k2];
      }
      var json = JSON.stringify(merged);
      if (typeof Zotero !== "undefined" && Zotero.Prefs && typeof Zotero.Prefs.set === "function") {
        Zotero.Prefs.set("extensions.zotero.wordtranslator.xbuttonBridgeStatus", json, true);
      } else if (typeof Services !== "undefined" && Services.prefs) {
        Services.prefs.setStringPref("extensions.zotero.wordtranslator.xbuttonBridgeStatus", json);
      }
    } catch (e) {
      this._debugLog("_updateXButtonBridgeStatus ERROR: " + (e && (e.message || e)));
    }
  },

  // 「重启桥接」手动按钮已于热切换改造中移除：进程常驻 + 参数热应用后，
  // 手动重启反而会制造无钩子空窗（侧键漏给系统）。需要重建钩子时，关闭再
  // 开启上方「鼠标侧键」主开关即可（走 stop+start 完整链路）。

  // 侧键触发是否被「真正需要」：主开关（设置页「鼠标侧键」）+ 添加单词快捷键开启
  // + 绑定模式是侧键 + 划词先选开启（_fireAddWordHotkey 的硬性前置）。
  // 任一不满足就绝不装系统钩子——这样「关闭鼠标侧键」不会影响其他程序的后退/前进，
  // 也不会出现钩子吞键却永远不可能触发的静默空转。
  _xbuttonHotkeyWanted() {
    try {
      const d = this._data;
      if (!d) return false;
      if (d.xbuttonEnabled !== true) return false;          // 设置页主开关
      if (d.xbuttonBridgeEnabled === false) return false;   // 旧版内部总开关（保留兼容）
      if (!d.addWordHotkeyEnabled || !d.selectionFirstEnabled) return false;
      const mode = d.addWordHotkeyMode || "";
      return this._xbuttonIsSideKeyMode(mode);
    } catch (e) {
      return false;
    }
  },

  // ── 侧键录制（设置页「绑定侧键」框）─────────────────────────────
  // 为什么需要：绑定写死「侧键1」时，用户按的物理侧键可能是「侧键2」（不同鼠标/不同
  // 连接模式的上报顺序不同），表现为「侧键没用」；录制一次即可自动绑定正确的按键。
  // 录制期间同样吞键（用户点「绑定侧键」框即授权接管这几下按键，放行会让
  // PDF 翻页）。指纹随即变化，钩子进程常驻，参数经 bridge-params.json 热应用。
  _xbuttonRecordActive() {
    return Date.now() < (this._xbuttonBridge.recordUntil || 0);
  },

  startXButtonRecord() {
    try {
      this._refreshPrefsFromStorage(true);
      this._xbuttonBridge.recordUntil = Date.now() + this._XBUTTON_RECORD_MS;
      this._xbuttonBridge.lastRecordButton = 0;
        this._xbuttonBridge.lastRecordTs = 0;
      this._xbuttonBridge.lastRecordCode = "";
      this._xbuttonBridge.recordCodes = null;
      this._debugLog("xbutton record: started (" + Math.round(this._XBUTTON_RECORD_MS / 1000) + "s window, xbutton blocked)");
      this._writeBridgeDebug("record started (" + Math.round(this._XBUTTON_RECORD_MS / 1000) + "s window, xbutton blocked)");
      // 录制期间钩子以吞键参数重启；若还没绑定任何侧键模式，这里临时允许启动
      //（否则用户永远无法录制——鸡生蛋问题）。
      this.syncXButtonBridge();
      this._armRecordExpiry();
          } catch (e) {
      this._debugLog("startXButtonRecord ERROR: " + (e && (e.message || String(e))));
    }
  },

  // 录制窗口到期：必须显式复位并重新同步钩子参数。
  // 此前只在「识别成功」和「手动取消」时同步，窗口自然到期时没有任何回调——于是钩子
  // 会一直停在录制期间的重启参数，直到下次配置变化才恢复常规吞键语义。
  _armRecordExpiry() {
    try {
      if (this._xbuttonBridge.recordTimer) clearTimeout(this._xbuttonBridge.recordTimer);
      const self = this;
      this._xbuttonBridge.recordTimer = setTimeout(function () {
        self._xbuttonBridge.recordTimer = null;
        if (self._xbuttonRecordActive()) return; // 已被识别/取消处理
        self._debugLog("xbutton record: window expired without any side-key event");
        const secs = Math.round(self._XBUTTON_RECORD_MS / 1000);
        self._updateXButtonBridgeStatus({
          lastNote: "绑定超时：" + secs + " 秒内没有收到任何按键事件。若该键在厂商软件里被改成了手势/宏，"
            + "请先恢复为「后退/前进」；也可能是这颗键本身故障。",
          lastReason: "绑定超时：" + secs + " 秒内没有收到任何按键事件。请先确认该键在厂商软件里是"
            + "「后退/前进」而非手势/宏；若其他侧键能绑定，说明这颗键可能已故障。",
          lastBtn: "",
          lastNoteTs: Date.now(),
        });
        self._showXButtonToast("侧键绑定超时",
          secs + " 秒内没有收到按键事件。请先确认该键在厂商软件里是「后退/前进」而非手势/宏；"
          + "若其他侧键能绑定，说明这颗键可能已故障。");
        // 复位到正常参数（恢复吞键语义），否则会一直停在放行状态
        self.syncXButtonBridge();
      }, this._XBUTTON_RECORD_MS + 300);
    } catch (e) {}
  },

  stopXButtonRecord() {
    this._xbuttonRecordClear();
    this._debugLog("xbutton record: stopped");
    this.syncXButtonBridge();
  },


  // 传给钩子进程的吞键参数：1=吞掉（禁后退/前进误触）；0=放行。
  // 常规语义由「兼容模式」决定：兼容模式开 = 吞掉（标准侧键不再误触后退）；
  // 兼容模式关 = 放行，但被绑定的那颗标准侧键仍吞（绑定=接管）——未绑定的
  // 键与其他鼠标软件完全不受影响。录制窗口期间一律吞掉（见下方函数注释）。
  _xbuttonBlockFlag() {
    // 录制窗口期间同样吞键（block=1）：用户点了「绑定侧键」框，预期就是
    // 「我这下按键被插件拿走」——放行会让 PDF 翻页（用户实测反馈）。事件先
    // 上报后吞掉，绑定照常进行；窗口结束（成功/超时/取消）即恢复常规参数。
    if (this._xbuttonRecordActive()) return 1;
    return (this._data && this._data.xbuttonCompat === false) ? 0 : 1;
  },

  // 「兼容模式」的一部分。覆盖蓝牙鼠标、以及把侧键
  // 映射成浏览器后退/前进的厂商软件——这类设备不产生 XButton，而是发出
  // VK_BROWSER_BACK/FORWARD（低级键盘钩子可拦）或消费页 HID 报文（仅可检测）。
  // 代价：系统级后退/前进会被接管，因此有开关 + 开启时的提醒，取舍交给用户。
  // 录制窗口期间强制开启：泛化录制需要钩子把多媒体键/消费页键都报上来，
  // 兼容模式关着时这条通道根本不装，录不到第三颗侧键。
  _xbuttonConsumerKeysFlag() {
    if (this._xbuttonRecordActive()) return 1;
    return (this._data && this._data.xbuttonCompat === false) ? 0 : 1;
  },

  // 钩子进程启动参数指纹：唯一需要重建进程才能生效的配置是吞键/消费键开关、
  // 录制窗口（决定钩子是否上报全部多媒体键）与显式绑定的 code 键；绑定模式
  // （xbutton1/2/both）由 JS 侧匹配，改模式无需重启进程（但热切换参数要带
  // xbutton 字段——兼容模式关时 C# 按「绑定哪颗吞哪颗」工作，故指纹须含它）。
  _xbuttonBridgeFingerprint() {
    const runMode = (this._data && this._data.addWordHotkeyMode) || "";
    const bindCode = this._xbuttonBindCodeOf(runMode);
    return "block=" + this._xbuttonBlockFlag() + ";consumer=" + this._xbuttonConsumerKeysFlag()
      + ";record=" + (this._xbuttonRecordActive() ? 1 : 0) + ";bind=" + bindCode
      + ";xb=" + this._boundXButtonFlag();
  },

  // PowerShell 路径兜底：System32 优先，SysWOW64 兜底（32 位 Zotero 重定向下
  // 两者本就等价；极个别精简系统只有其一）。
  _resolvePowerShellPath() {
    const candidates = [
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
    ];
    for (const p of candidates) {
      try {
        const f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        f.initWithPath(p);
        if (f.exists()) return p;
      } catch (e) {}
    }
    return candidates[0];
  },

  // 配置变化后调用（偏好页 save / 模式切换 / 吞键开关）：
  // 进程已在运行 → 把 block/consumer/record/bind 写进 bridge-params.json，
  // C# 泵线程 200ms 内原地应用（钩子始终装着，零空窗——重启空窗曾让侧键
  // 漏到系统、PDF 翻页，用户实测 16:18 时段反复出现）。
  // 进程不在 → 正常启动（启动参数即最新配置）。
  syncXButtonBridge() {
    this._refreshPrefsFromStorage(true);
    const wanted = !!(this._data && this._data.xbuttonBridgeEnabled !== false
      && (this._xbuttonHotkeyWanted() || this._xbuttonRecordActive()));
    if (!wanted) {
      if (this._xbuttonBridge.active) {
        this._debugLog("xbutton bridge: no longer wanted (mode/enabled changed), stopping");
        this._stopXButtonBridge();
      }
      return;
    }
    const fp = this._xbuttonBridgeFingerprint();
    const unchanged = this._xbuttonBridge.active && this._xbuttonBridge.fingerprint === fp;
    if (unchanged) {
      this._debugLog("xbutton bridge: config unchanged, keep running");
      return;
    }
    // 热切换路径：进程活着 → 只写参数文件，不杀进程。
    // 这消除了「杀旧进程 → PowerShell 重新编译（0.7~1s，杀软扫描时更长）→ 新钩子
    // 装上」之间的无钩子空窗——录制开始/结束的瞬间按侧键，就是从那道空窗漏出去的。
    // 不要求 confirmed：只要进程还活着，C# 泵线程就会读到新参数（首次编译期间写进去
    // 也照样会在编译完成后第一轮轮询时应用），比「等确认再重启」更不容易漏。
    if (this._xbuttonBridge.active && this._xbuttonBridge.process) {
      this._xbuttonBridge.fingerprint = fp;
      this._writeBridgeParams();
      this._debugLog("xbutton bridge: hot-reconfigured via params file (" + fp + ")");
      return;
    }
    if (this._xbuttonBridge.active) this._stopXButtonBridge();
    this._xbuttonBridge.restartCount = 0;
    this._startXButtonBridge();
  },

  // 把当前 block/consumerKeys/record/bindCode/xbutton 写进参数文件（C# 泵线程轮询
  // + FSW 即时应用）。
  _writeBridgeParams() {
    try {
      // eventFile 未初始化时无处可写（C# 侧 _paramsFile 也为空、不轮询）——静默跳过。
      const evtFile = this._xbuttonBridge.eventFile;
      if (!evtFile) return;
      const runMode = (this._data && this._data.addWordHotkeyMode) || "";
      const bindCode = this._xbuttonBindCodeOf(runMode);
      const params = JSON.stringify({
        block: this._xbuttonBlockFlag(),
        consumerKeys: this._xbuttonConsumerKeysFlag(),
        record: this._xbuttonRecordActive() ? 1 : 0,
        bind: bindCode,
        // 绑定的是哪颗标准侧键：兼容模式关时 C# 只吞这一颗（绑定=接管），
        // 未绑定的侧键与系统后退/前进完全不受影响。
        xbutton: this._boundXButtonFlag(),
      });
      const paramsFile = evtFile.replace(/[\\/][^\\/]+$/, "") + "\\bridge-params.json";
      this._writeTextFile(paramsFile, params, false);
      this._debugLog("xbutton bridge: params written " + params);
    } catch (e) {
      this._debugLog("_writeBridgeParams ERROR: " + (e && (e.message || e)));
    }
  },

  // 绑定的标准侧键编号（C# 选择性吞键用）：0=无（code 绑定）1=XButton1
  // 2=XButton2 3=任意侧键。录制窗口期间无需考虑（block 已强制吞全部）。
  _boundXButtonFlag() {
    const mode = (this._data && this._data.addWordHotkeyMode) || "";
    if (mode === "xbutton1") return 1;
    if (mode === "xbutton2") return 2;
    if (mode === "xbutton-both") return 3;
    return 0;
  },

};

if (typeof WordTranslator !== "undefined") {
  try { Object.assign(WordTranslator, WordTranslatorModule_bridge); } catch (e) { try { Zotero.debug("[WordTranslator] module bridge assign ERROR: " + (e && (e.stack || e.message || e))); } catch (e2) {} }
}
