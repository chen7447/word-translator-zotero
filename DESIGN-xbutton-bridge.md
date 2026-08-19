# 鼠标侧键桥接设计方案

## 1. 背景与问题

### 1.1 为什么现有方案不生效

- 鼠标侧键（XButton1/XButton2）在浏览器层被自动拦截为前进/后退导航，JavaScript 无法监听或拦截此行为
- 现有代码注释称「用 PowerToys Mouse Utilities 把 XButton 映射为键盘组合键」，但 PowerToys **没有**此功能（Keyboard Manager 仅键盘，Mouse Without Borders 是跨设备控制）
- 因此键盘事件从未被产生，插件的 `keydown` 监听器永远收不到触发

### 1.2 方案核心思路

**自建系统级桥接进程**，在操作系统层检测 XButton 按下，绕过浏览器层，直接通知插件执行动作。**桥接不依赖 PowerToys**——PowerShell 脚本编译并运行 C# 低层鼠标钩子（WH_MOUSE_LL），PowerToys 只是偏好页上留存的功能（检测/安装），与桥接无任何功能关联。

**双引擎架构**：
- **主引擎（WH_MOUSE_LL 钩子）**：C# 编译的 bridge-hook.exe，安装全局低层鼠标钩子，事件驱动，可拦截浏览器前进/后退导航。
- **回退引擎（GetAsyncKeyState 轮询）**：当 C# 编译失败时（如受限环境），自动回落为 PowerShell 原生轮询方案。

```
xbuttonBridgeEnabled = true
  → 启动 PowerShell 桥接进程（Subprocess）
    → bridge.ps1 编译 bridge-hook.cs → bridge-hook.exe
      → 成功 → 运行 WH_MOUSE_LL 钩子（事件驱动，零轮询）
        → XButton 按下 → 钩子回调写 stdout + 事件文件
          → 插件 stdout 管道读取 → _fireAddWordHotkey()
      → 失败 → 回退 GetAsyncKeyState 轮询（legacy）
        → 15ms 轮询 VK_XBUTTON1/2 → 写事件文件
          → 插件 100ms 轮询事件文件 → _fireAddWordHotkey()
```

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Zotero 主进程                             │
│                                                                  │
│  addon.js                                                        │
│    init() ──→ _startXButtonBridge() ──→ 提取 bridge.ps1         │
│       │                                   │  + bridge-hook.cs    │
│       │                                   │ 启动 Subprocess      │
│       │                                   │ 启动 stdout 读取     │
│       │                                   │ 启动轮询定时器(兜底)  │
│       ▼                                   ▼                      │
│    registerReaderEvents()             Subprocess 监听            │
│    _bindGlobalHotkeyListener()        process.wait().then()      │
│                                         → 重启桥接               │
│    shutdown() ──→ _stopXButtonBridge()                          │
│                     → kill 进程                                  │
│                     → 清定时器/事件文件                            │
│                                                                  │
│  preferences.js (偏好页)                                          │
│    PowerToys 检测区块（保留）                                     │
│    侧键桥接状态区块（显示钩子模式）                                │
└─────────────────────────────────────────────────────────────────┘
         │ Subprocess 启动
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  bridge.ps1 — PowerShell 桥接包装器                               │
│  参数: -EventFile <path> -IntervalMs 15 -ParentPid <zotero_pid>  │
│                                                                  │
│  PHASE 1: 编译并运行 bridge-hook.exe (WH_MOUSE_LL)               │
│    Add-Type -OutputAssembly → bridge-hook.exe                    │
│      → 成功 → 启动 exe，等待退出                                  │
│      → 失败 → 进入 PHASE 2                                       │
│                                                                  │
│  PHASE 2: 回退引擎 (GetAsyncKeyState 轮询)                       │
│    Add-Type 注入 C# 类 XButtonHelper                              │
│    loop: (15ms 间隔)                                              │
│      GetAsyncKeyState(VK_XBUTTON1=0x05)                          │
│      GetAsyncKeyState(VK_XBUTTON2=0x06)                          │
│      if 新按下 → WriteAllText(EventFile, JSON)                   │
│      if 父进程已死 → break (self-exit)                            │
│      Sleep(15ms)                                                 │
└─────────────────────────────────────────────────────────────────┘
         │ StartProcess
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  bridge-hook.exe — C# WH_MOUSE_LL 低层鼠标钩子                    │
│  参数: -EventFile <path> -ParentPid <zotero_pid>                 │
│                                                                  │
│  SetWindowsHookEx(WH_MOUSE_LL) → 全局钩子                        │
│  GetMessage 消息泵（必须，钩子依赖消息泵唤醒）                     │
│                                                                  │
│  HookCallback:                                                   │
│    WM_XBUTTONDOWN → MSLLHOOKSTRUCT.mouseData                     │
│      → HIWORD = XBUTTON1(0x0001) / XBUTTON2(0x0002)             │
│      → 写 JSON 事件到 stdout + 事件文件（兜底）                   │
│      → return (IntPtr)1 阻塞事件（浏览器永不收到前进/后退）       │
│      → 普通鼠标事件 → CallNextHookEx 放行                        │
│                                                                  │
│  父进程监视线程 (3秒间隔)                                         │
│  控制台 Ctrl+C / 进程退出时清理钩子                               │
└─────────────────────────────────────────────────────────────────┘
         │ 写 stdout (事件驱动，零轮询)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  addon.js _readXButtonStdout() / _processXButtonEvent()          │
│                                                                  │
│  stdout 管道 50ms 轮询（纯内存操作，不写盘）                       │
│  按行解析 JSON 事件                                              │
│    _bridgeInit → 确认钩子模式 / 回退模式                          │
│    XButton 事件 → ts 去重（双通道）→ 2秒时效校验                  │
│      → _addWordHotkeyActive() + _getSelectionFirstPending()      │
│      → 模式匹配（xbutton1/xbutton2/xbutton-both）                │
│      → _fireAddWordHotkey()                                      │
└─────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 桥接启动脚本 (bridge.ps1)

### 3.1 脚本路径与角色

打包在 XPI 内：`content/scripts/bridge.ps1`

插件启动时提取到数据目录：`<profileDir>/wordtranslator/bridge.ps1`

**bridge.ps1 现在是双引擎包装器**，不再直接执行检测逻辑：
- **Phase 1**：编译并运行 `bridge-hook.exe`（WH_MOUSE_LL 钩子，优先级最高）
- **Phase 2**：编译失败时回退到 `GetAsyncKeyState` 轮询

### 3.2 完整脚本逻辑 (Phase 1 — WH_MOUSE_LL 钩子)

```powershell
param(
    [string]$EventFile,          # 事件文件路径（必需）
    [int]$IntervalMs = 15,       # 轮询间隔（仅回退模式使用）
    [int]$ParentPid = 0          # 父 Zotero 进程 PID
)

# ─── Phase 1: 编译并运行 C# WH_MOUSE_LL 钩子 ───
$scriptDir = [System.IO.Path]::GetDirectoryName($PSCommandPath)
$hookSource = Join-Path $scriptDir "bridge-hook.cs"
$hookExe = Join-Path $scriptDir "bridge-hook.exe"

if (Test-Path $hookSource) {
    # 检查是否需要重新编译
    $needCompile = (-not (Test-Path $hookExe)) -or
        ((Get-Item $hookSource).LastWriteTime -gt (Get-Item $hookExe).LastWriteTime)
    
    if ($needCompile) {
        Add-Type -OutputAssembly $hookExe `
                 -OutputType ConsoleApplication `
                 -TypeDefinition (Get-Content $hookSource -Raw) `
                 -WarningAction SilentlyContinue
    }
    
    if (Test-Path $hookExe) {
        $proc = Start-Process -FilePath $hookExe `
            -ArgumentList "-EventFile `"$EventFile`" -ParentPid $ParentPid" `
            -NoNewWindow -PassThru -WindowStyle Hidden
        $proc.WaitForExit()
        if ($proc.ExitCode -eq 0) { return }  # 父进程退出，正常退出
        # 非零 → 钩子安装失败，进入 Phase 2 回退
    }
}

# ─── Phase 2: GetAsyncKeyState 轮询（回退） ───
# ...（原有代码，添加 fallback 标记）
```

### 3.3 完整脚本逻辑 (Phase 2 — GetAsyncKeyState 轮询，回退)

```powershell
# 注入 Win32 P/Invoke
Add-Type -WarningAction SilentlyContinue @"
using System;
using System.Runtime.InteropServices;
public class WordTranslatorXButtonHelper
{
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
    public const int VK_XBUTTON1 = 0x05;
    public const int VK_XBUTTON2 = 0x06;
    public static bool IsDown(int vKey) { return (GetAsyncKeyState(vKey) & 0x8000) != 0; }
    public static bool IsNewPress(int vKey) { return (GetAsyncKeyState(vKey) & 0x1) != 0; }
}
"@

$lastX1 = $false
$lastX2 = $false
$parentCheckLoops = [math]::Max(1, [int](3000 / [math]::Max(1, $IntervalMs)))
$parentCheckCounter = 0

while ($true)
{
    # 自退出检测（每 3 秒）
    $parentCheckCounter++
    if ($ParentPid -gt 0 -and $parentCheckCounter -ge $parentCheckLoops) { ... }

    $now1 = [WordTranslatorXButtonHelper]::IsDown(0x05)
    $now2 = [WordTranslatorXButtonHelper]::IsDown(0x06)
    $press1 = ($now1 -and -not $lastX1) -or [WordTranslatorXButtonHelper]::IsNewPress(0x05)
    $press2 = ($now2 -and -not $lastX2) -or [WordTranslatorXButtonHelper]::IsNewPress(0x06)
    $lastX1 = $now1; $lastX2 = $now2

    if ($press1 -or $press2) {
        WriteAllText($EventFile, JSON)  # 含 fallback: true 标记
    }
    Sleep(15ms)
}
```

### 3.4 事件文件格式

```json
// XButton1 按下（钩子模式）
{"x1":1,"ts":1752643123456}

// XButton2 按下（钩子模式）
{"x2":1,"ts":1752643123457}

// 桥接启动确认（钩子模式）
{"_bridgeInit":true,"ts":1752643123000}

// 桥接启动确认（回退模式）
{"_bridgeInit":true,"ts":1752643123000,"fallback":true}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `x1` | number | `1` 表示 XButton1 被按下 |
| `x2` | number | `1` 表示 XButton2 被按下 |
| `ts` | number | Unix 毫秒时间戳 |
| `_bridgeInit` | bool | 启动确认标记 |
| `fallback` | bool | 回退模式标记（仅 Phase 2 设置） |
| `error` | string | 编译/钩子安装失败的错误信息 |

---

## 3.5 C# 低层鼠标钩子 (bridge-hook.cs / bridge-hook.exe)

### 3.5.1 为什么需要 C# exe

`WH_MOUSE_LL` 全局钩子需要一个**持续运行的 Windows 消息泵**（`GetMessage` 循环），PowerShell 脚本无法提供此能力。因此需要将检测逻辑编译为独立的 C# 控制台可执行文件。

### 3.5.2 编译方式

`bridge.ps1` 在 Phase 1 中调用 `Add-Type -OutputAssembly` 将 `bridge-hook.cs` 编译为 `bridge-hook.exe`。编译产物为标准的 .NET Framework 4.x 可执行文件，约 9KB。

### 3.5.3 执行流程

```
Main()
  ├─ 解析命令行参数（-EventFile, -ParentPid）
  ├─ SetConsoleCtrlHandler() 注册清理回调
  ├─ SetWindowsHookEx(WH_MOUSE_LL, HookCallback, hMod, 0) 安装钩子
  ├─ 写 _bridgeInit:true 到 stdout + 事件文件
  ├─ 启动父进程监视线程（3 秒间隔，Process.GetProcessById）
  ├─ GetMessage 消息泵（核心循环）
  │    └─ 钩子回调在消息泵内部被 OS 调用
  └─ 退出时 UnhookWindowsHookEx 清理
```

### 3.5.4 HookCallback 逻辑

```csharp
static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
{
    if (nCode >= 0)
    {
        int msg = wParam.ToInt32();
        if (msg == WM_XBUTTONDOWN)  // 0x020B
        {
            MSLLHOOKSTRUCT ms = Marshal.PtrToStructure<MSLLHOOKSTRUCT>(lParam);
            uint hiWord = (ms.mouseData >> 16) & 0xFFFF;
            int xbutton = 0;
            if (hiWord == XBUTTON1) xbutton = 1;     // 0x0001
            else if (hiWord == XBUTTON2) xbutton = 2; // 0x0002

            if (xbutton > 0)
            {
                // 写 JSON 事件到 stdout + 事件文件
                EmitEvent(xbutton);
                // 返回非零值阻止事件传递
                // 浏览器永不收到 WM_XBUTTONDOWN
                return (IntPtr)1;
            }
        }
    }
    return CallNextHookEx(_hookId, nCode, wParam, lParam);
}
```

### 3.5.5 关键设计决策

| 项 | 选择 | 原因 |
|----|------|------|
| 钩子类型 | `WH_MOUSE_LL` (14) | 全局低层鼠标钩子，无需注入 DLL，在安装线程的上下文中回调 |
| 检测方式 | `MSLLHOOKSTRUCT.mouseData` HIWORD | 直接读取 XButton 标识，无论鼠标驱动是否拦截均可捕获 |
| 事件拦截 | `return (IntPtr)1` | 阻止 XButton 事件继续传播，浏览器层永不收到前进/后退导航 |
| 普通鼠标事件 | 调用 `CallNextHookEx` 放行 | 左键/右键/滚轮等正常传递，不干扰用户操作 |
| 消息泵 | `GetMessage` 阻塞循环 | WH_MOUSE_LL 钩子依赖消息泵唤醒，OS 通过 posting message 触发回调 |
| 父进程监控 | 独立线程，3 秒间隔 | 防止 Zotero 崩溃后钩子进程残留，全局钩子独占 XButton |
| 通信方式 | stdout 管道（主）+ 事件文件（兜底） | 事件驱动低延迟，文件兜底兼容旧插件版本 |
| JSON 序列化 | 手动 `StringBuilder` | 零外部依赖，不依赖 System.Text.Json 等 NuGet 包 |
| 编译环境 | .NET Framework 4.x (csc.exe) | 所有 Windows 10/11 系统自带，无需额外安装 |

## 4. Subprocess 启动/保活/退出清理（addon.js）

### 4.1 状态变量

```js
_xbuttonBridge: {
    active: false,           // 桥接是否启用
    process: null,           // Subprocess 进程对象
    pollTimer: null,         // 事件文件轮询定时器（legacy 兜底）
    stdoutTimer: null,       // stdout 管道读取定时器（WH_MOUSE_LL 钩子模式）
    eventFile: null,         // 事件文件路径
    scriptPath: null,        // 提取后的 bridge.ps1 路径
    hookSourcePath: null,    // 提取后的 bridge-hook.cs 路径
    restartCount: 0,         // 重启计数（用于退避）
    startedAt: 0,            // 最近启动时间戳
    restartTimer: null,      // 重启退避定时器
    hookMode: false,         // 是否运行 WH_MOUSE_LL 钩子模式
    lastEventTs: 0,          // 最近处理的事件 ts（双通道去重）
    stdoutBuffer: "",        // stdout 管道累积缓冲
},
```

### 4.2 启动桥接（`_startXButtonBridge`）

```js
async _startXButtonBridge() {
    try {
        if (this._xbuttonBridge.active) return;
        if (!this._data || !this._data.xbuttonBridgeEnabled) return;

        // ── 准备文件路径 ──
        const dataDir = Zotero.WordTranslatorStorage.getDataDirPath();
        if (!dataDir) return;
        this._xbuttonBridge.eventFile = dataDir + "\\bridge-events.json";
        this._xbuttonBridge.scriptPath = dataDir + "\\bridge.ps1";

        // ── 提取桥接脚本（从 addon 资源 → 数据目录）──
        await this._extractBridgeScript();

        // ── 清理旧事件文件 ──
        try {
            const f = ...; // nsIFile for eventFile
            if (f.exists()) f.remove(false);
        } catch (e) {}

        // ── 启动 PowerShell ──
        const Subprocess = ...; // 按现有方式获取 Subprocess
        const zoteroPid = ...; // Services.appinfo.processID
        this._xbuttonBridge.process = await Subprocess.call({
            command: "powershell.exe",
            arguments: [
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy", "Bypass",
                "-File", this._xbuttonBridge.scriptPath,
                "-EventFile", this._xbuttonBridge.eventFile,
                "-IntervalMs", "15",
                "-ParentPid", String(zoteroPid),
            ],
            stderr: "ignore",
            // stdin 不传，但保留默认管道
        });
        this._xbuttonBridge.active = true;
        this._xbuttonBridge.startedAt = Date.now();
        this._xbuttonBridge.restartCount = 0;
        this._debugLog("XButton bridge started: PID=" + this._xbuttonBridge.process.pid +
            ", eventFile=" + this._xbuttonBridge.eventFile);

        // ── 保活监视：进程退出时自动重启 ──
        this._xbuttonBridge.process.wait().then(() => {
            this._debugLog("XButton bridge process exited");
            this._xbuttonBridge.active = false;
            this._xbuttonBridge.process = null;
            // 自动重启（有限次 + 退避）
            this._scheduleBridgeRestart();
        });

        // ── 启动事件文件轮询 ──
        this._startXButtonPolling();

        // ── 更新状态 pref ──
        this._updateXButtonBridgeStatus({ running: true, pid: this._xbuttonBridge.process.pid });

    } catch (e) {
        this._debugLog("_startXButtonBridge ERROR: " + (e && (e.stack || e.message || e)));
    }
}
```

### 4.3 提取桥接脚本（`_extractBridgeScript`）

```js
async _extractBridgeScript() {
    const scriptPath = this._xbuttonBridge.scriptPath;
    if (!scriptPath) return;
    // 检查是否已提取（避免重复写盘）
    try {
        const f = ...; // nsIFile
        if (f.exists() && f.fileSize > 0) return;
    } catch (e) {}

    // 从 addon 资源读取
    const uri = this._addonRoot + "content/scripts/bridge.ps1";
    let content = "";
    try {
        // Zotero 7+: fetch 可用
        const response = await fetch(uri);
        if (response.ok) content = await response.text();
    } catch (e) {
        // 兜底: NetUtil.asyncFetch
        content = await new Promise((resolve, reject) => {
            NetUtil.asyncFetch({ uri }, (stream, status) => {
                if (Components.isSuccessCode(status)) {
                    resolve(NetUtil.readInputStreamToString(stream, stream.available(), { charset: "utf-8" }));
                } else {
                    reject(new Error("NetUtil fetch failed"));
                }
            });
        });
    }
    if (!content) return;

    // 写入数据目录
    // ... nsIFileOutputStream / IOUtils.writeUTF8
    // 注意：生成的 .ps1 文件不要设置执行权限，PowerShell -File 不需要
}
```

### 4.4 事件读取（双通道：stdout 管道 + 文件轮询兜底）

**stdout 管道（钩子模式主通道，事件驱动）：**

```js
_startXButtonStdoutReading() {
    const readLoop = () => {
        if (!this._xbuttonBridge.active) return;
        this._xbuttonBridge.stdoutTimer = setTimeout(() => {
            try { this._readXButtonStdout(); } catch (e) {}
            readLoop();
        }, 50);
    };
    readLoop();
}

_readXButtonStdout() {
    const pipe = this._xbuttonBridge.process && this._xbuttonBridge.process.stdout;
    if (!pipe) return;
    // 读取管道所有可用数据 → 按行解析 JSON 事件
    // 每行一个事件 → this._processXButtonEvent(event, "stdout")
}

// 文件轮询（legacy 兜底）
_checkXButtonEvent() {
    // 读事件文件 → 立即删除 → this._processXButtonEvent(event, "file")
}
```

**共享事件处理器（stdout 与文件共用）：**

```js
_processXButtonEvent(event, source) {
    // 1. _bridgeInit 标记 → 确认钩子/回退模式 + 更新状态 pref
    // 2. XButton 事件 → ts 双通道去重（lastEventTs）
    // 3. 2 秒时效校验
    // 4. _addWordHotkeyActive() + _getSelectionFirstPending()
    // 5. addWordHotkeyMode 匹配（xbutton1/xbutton2/xbutton-both）
    // 6. _fireAddWordHotkey()
}
```

### 4.5 停止桥接（`_stopXButtonBridge`）

```js
_stopXButtonBridge() {
    // 取消重启定时器
    if (this._xbuttonBridge.restartTimer) { clearTimeout(...); }
    // 停止 stdout 读取
    if (this._xbuttonBridge.stdoutTimer) { clearTimeout(...); }
    // 停止文件轮询
    if (this._xbuttonBridge.pollTimer) { clearTimeout(...); }
    // 杀进程
    if (this._xbuttonBridge.process) {
        try { this._xbuttonBridge.process.kill(); } catch (e) {}
        this._xbuttonBridge.process = null;
    }
    // 清理事件文件
    // 重置 hookMode / stdoutBuffer / lastEventTs
    this._xbuttonBridge.active = false;
    this._updateXButtonBridgeStatus({ running: false, pid: 0 });
}
```

### 4.6 接入点

| 生命周期 | 接入位置 | 操作 |
|---------|---------|------|
| **init 结尾** | `registerReaderEvents()` 之后（line 332 附近） | `this._startXButtonBridge()` |
| **shutdown** | `_cleanupHotkeyDomListeners()` 附近（line 224） | `this._stopXButtonBridge()` |
| **配置更新** | `wordtranslator-config-updated` 事件处理 | 根据 `xbuttonBridgeEnabled` 开关启停桥接 |

### 4.7 重启退避逻辑

```js
_scheduleBridgeRestart() {
    const rc = this._xbuttonBridge.restartCount;
    if (rc >= 5) {
        this._debugLog("XButton bridge: too many restarts, giving up");
        this._updateXButtonBridgeStatus({ running: false, error: "max-restarts" });
        return;
    }
    const delay = Math.min(1000 * Math.pow(2, rc), 30000); // 1s, 2s, 4s, 8s, 16s, 30s
    this._xbuttonBridge.restartCount = rc + 1;
    this._debugLog("XButton bridge: restart in " + delay + "ms (attempt " + rc + ")");
    setTimeout(() => {
        if (!this._xbuttonBridge.active) {
            this._startXButtonBridge();
        }
    }, delay);
}
```

---

## 5. 配置项（prefs.js / config-schema.js）

### 5.1 新增 pref

| Pref | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `extensions.zotero.wordtranslator.xbuttonBridgeEnabled` | bool | `true` | 侧键桥接总开关 |
| `extensions.zotero.wordtranslator.xbuttonBridgeStatus` | string (JSON) | `""` | 桥接状态，由 addon.js 写入 |

### 5.2 config-schema.js 扩展

在 `addWordHotkeyMode` 的合法值中新增：
```js
addWordHotkeyMode: (raw.addWordHotkeyMode === "ctrl" || raw.addWordHotkeyMode === "alt" ||
    raw.addWordHotkeyMode === "shift" || raw.addWordHotkeyMode === "custom" ||
    raw.addWordHotkeyMode === "xbutton1" || raw.addWordHotkeyMode === "xbutton2" ||
    raw.addWordHotkeyMode === "xbutton-both")
    ? raw.addWordHotkeyMode : "ctrl",
```

### 5.3 addon.js 的 `_addWordHotkeyActive` 扩展

```js
_addWordHotkeyActive() {
    if (!this._data || !this._data.addWordHotkeyEnabled) return false;
    const mode = this._data.addWordHotkeyMode || "custom";
    if (mode === "ctrl" || mode === "alt" || mode === "shift") return true;
    if (mode === "custom") return !!this._data.addWordHotkey;
    // 侧键模式：依赖桥接是否运行
    if (mode === "xbutton1" || mode === "xbutton2" || mode === "xbutton-both") {
        return this._xbuttonBridge.active;
    }
    return false;
}
```

---

## 6. 偏好页 UI 变动（preferences.js）

### 6.1 保留 PowerToys 区块（不变）

现有的 `—— 鼠标侧键绑定（PowerToys 检测）——` 区块完全保留，包括：
- PowerToys 检测状态行
- winget 检测状态行
- 一键安装、镜像下载、手动目录、检测按钮
- 诊断对话框

> ⚠️ **PowerToys 与侧键桥接无任何功能关联**。此区块仅作为既有功能留存（待桥接方案验证通过后再决定去留），其检测结果不影响桥接的启动与运行。

### 6.2 新增「侧键桥接」区块

在 PowerToys 区块之后、快捷键-划词翻译区块之前插入：

```
—— 鼠标侧键桥接（B-2） ——

[启用桥接] checkbox（绑定到 xbuttonBridgeEnabled）

[状态] ● 桥接运行中 (PID: 12345)
       | ○ 桥接未启动
       | ○ 桥接错误: 原因

[桥接脚本路径] <profileDir>/wordtranslator/bridge.ps1

[事件文件] <profileDir>/wordtranslator/bridge-events.json

[上次侧键事件] XButton1 于 12:34:56.789

[重启桥接] [测试侧键事件] [桥接诊断]
```

### 6.3 绑定模式中新增侧键选项

在现有的「绑定快捷键」模式单选按钮中，增加三个选项：

```
○ Ctrl
○ Alt
○ Shift
○ 自定义绑定按键
○ 鼠标侧键 1（后退键）  ← 新增（启用桥接后生效）
○ 鼠标侧键 2（前进键）  ← 新增（启用桥接后生效）
```

当选择侧键模式时，下方的提示文字显示：
「鼠标侧键监听需要桥接进程运行中。当桥接就绪时，选中单词后按鼠标侧键即可触发。」

### 6.4 状态读取

`preferences.js` 通过读 pref `xbuttonBridgeStatus` 获取桥接状态：

```js
function applyXButtonBridgeUI() {
    const statusStr = Zotero.Prefs.get("extensions.zotero.wordtranslator.xbuttonBridgeStatus", true);
    let status = {};
    try { status = JSON.parse(statusStr); } catch (e) {}
    // 更新 UI 状态行
    const statusEl = get("wt-xbutton-bridge-status");
    if (statusEl) {
        if (status.running) {
            statusEl.textContent = "● 桥接运行中 (PID: " + (status.pid || "?") + ")";
        } else if (status.error) {
            statusEl.textContent = "○ 桥接错误: " + status.error;
        } else {
            statusEl.textContent = "○ 桥接未启动";
        }
    }
}
```

---

## 7. 事件文件格式

```json
// XButton1 按下
{"x1":1,"ts":1752643123456}

// XButton2 按下
{"x2":1,"ts":1752643123457}

// 两者同时（极罕见，但支持）
{"x1":1,"x2":1,"ts":1752643123456}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `x1` | number | `1` 表示 XButton1 被按下 |
| `x2` | number | `1` 表示 XButton2 被按下 |
| `ts` | number | Unix 毫秒时间戳 |

---

## 8. 边界情况与风险

### 8.1 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| PowerShell + C# 编译启动慢（~1-3s） | 桥接启动后延迟才生效 | 不影响，启动后持续运行；exe 缓存避免每次重编译 |
| C# 编译失败（受限环境/杀软） | 钩子不可用 | Phase 2 自动回退 GetAsyncKeyState 轮询 |
| `WH_MOUSE_LL` 钩子全局拦截 XButton | 其他应用也收不到 XButton | 预期行为（侧键专用于翻译）；Zotero 退出时钩子自动清理 |
| `WH_MOUSE_LL` 钩子被其他进程抢占 | 检测失效 | 系统只允许每个进程安装自己的钩子；多钩子并存时按安装顺序回调 |
| 事件文件被其他进程误写 | 误触发 | 文件在 dataDir 下，仅插件和桥接进程应知 |
| 桥接进程僵死（Zotero 崩溃） | 钩子进程残留，XButton 被独占 | `-ParentPid` 自退出机制（C# 用父进程监视线程） |
| `GetAsyncKeyState` 位 0 被消耗（仅回退模式） | 漏检点击 | 上升沿兜底检测 |
| 用户快速连击 XButton | 写入冲突 | stdout 管道 + 事件文件双通道；ts 去重 |
| 桥接进程反复崩溃 | 日志爆炸、性能下降 | 重启退避（最多 5 次，间隔递增） |

### 8.2 边界情况

| 场景 | 行为 |
|------|------|
| 用户未选择文本时按侧键 | 钩子写事件（stdout+文件），插件 `_getSelectionFirstPending()` 返回 null，不触发 |
| 用户选择文本后 10 秒才按侧键 | `_getSelectionFirstPending()` 返回 null（10s 超时），不触发 |
| 鼠标驱动拦截 XButton（罗技/雷蛇等） | **钩子模式可捕获**（WH_MOUSE_LL 截获所有鼠标事件）；回退模式捕获不到 |
| 浏览器后退/前进导航 | **钩子模式已阻止**（return 1）；回退模式浏览器仍会导航 |
| 用户关闭 addword hotkey | 桥接仍在运行，但插件 `_addWordHotkeyActive()` 返回 false，不触发 |
| 用户切换绑定模式为 Ctrl | 侧键事件被忽略，但桥接仍在运行 |
| 插件更新/重载 | `shutdown()` 杀桥接进程 → `init()` 重新启动 |
| 事件 ts 超过 2 秒 | 视为过期事件，忽略（stdout 路径不删除文件；文件路径已删） |
| 事件文件读取时正在被写入 | 读取失败，下次轮询再试 |
| stdout 管道无数据（回退模式） | 钩子未启动，`hookMode=false`，仅文件轮询工作 |

---

## 9. 开发/测试步骤

### 阶段一：验证 C# 钩子编译

1. 手动编译：`csc.exe /out:bridge-hook.exe bridge-hook.cs`（确认无编译错误）
2. 或通过 bridge.ps1 的 `Add-Type -OutputAssembly` 编译
3. 手动运行：`bridge-hook.exe -EventFile test.json -ParentPid 12345`，观察 stdout 输出 `{"_bridgeInit":true,...}`

### 阶段二：测试钩子安装与拦截

1. 运行 bridge-hook.exe 后，在任何应用（浏览器/资源管理器）中按 XButton1 → 确认：
   - stdout 收到 `{"x1":1,"ts":...}`
   - 浏览器不执行前进/后退导航（被拦截）
2. 测试自退出：父进程 PID 填假值 → 3 秒内进程自动退出
3. 测试 Ctrl+C：进程收到 Ctrl+C 后清理钩子并退出

### 阶段三：修改 addon.js

1. 添加 `_xbuttonBridge` 状态变量（含 stdoutTimer / hookMode / lastEventTs）
2. 实现 `_startXButtonBridge()`、`_stopXButtonBridge()`
3. 实现 `_startXButtonStdoutReading()` / `_readXButtonStdout()` 管道读取
4. 实现 `_processXButtonEvent()` 共享事件处理
5. 实现 `_scheduleBridgeRestart()` 退避重启
6. 修改 `_addWordHotkeyActive()` 侧键模式支持
7. 在 `init()` 和 `shutdown()` 中接入

### 阶段四：修改 preferences.js

1. 新增「侧键桥接」区块 UI（显示钩子模式标签）
2. 新增绑定模式单选：xbutton1 / xbutton2 / xbutton-both
3. 实现桥接状态读取更新（含 hookMode）
4. 实现「测试侧键事件」按钮（手动写事件文件）
5. 实现「桥接诊断」弹窗（显示检测模式）

### 阶段五：修改 config-schema.js

1. `addWordHotkeyMode` 合法值列表新增 `xbutton1` / `xbutton2` / `xbutton-both`

### 阶段六：集成测试

1. 打开偏好页 → 确认桥接状态显示「WH_MOUSE_LL」模式（无需安装 PowerToys）
2. 选中 PDF 文本 → 按 XButton1 → 确认翻译触发
3. 浏览器不跳转（钩子拦截生效）
4. 重复测试多次，确认无重复触发
5. 重启 Zotero → 确认桥接自动启动
6. 关闭 `xbuttonBridgeEnabled` → 确认桥接停止
7. 重新开启 → 确认桥接恢复
8. 模拟编译失败（删除/改名 bridge-hook.cs）→ 确认回退到 GetAsyncKeyState 模式

---

## 10. 后续优化方向

- ~~**桥接模式切换**：从 `GetAsyncKeyState` 轮询升级为 `WH_MOUSE_LL` 钩子~~ ✅ **已实现**（bridge-hook.cs + 自动回退）
- ~~**内嵌 exe**：从 PowerShell 脚本迁移到小型 C# exe 以减少启动延迟~~ ✅ **已实现**（bridge-hook.exe 编译缓存）
- **启动自检**：桥接启动后 2 秒内检测 XButton 信号，无信号则提示用户鼠标不产生标准 XBUTTON 事件（引导用 PowerToys 保底）
- **多配置**：支持 XButton1 和 XButton2 分别绑定不同快捷键
- **Linux/Mac 支持**：各自平台需要不同的系统级检测方案（xdotool / CGEvent）