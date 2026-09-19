// WordTranslator Side-Button Hook (WH_MOUSE_LL + WH_KEYBOARD_LL + Raw Input) - v3
//
// Detects mouse side buttons at the OS level, BEFORE the browser sees them.
// Loaded IN-MEMORY by xbutton-bridge.js via PowerShell Add-Type (no -OutputAssembly,
// so nothing is written as an .exe - avoids AV quarantining a dropped global-hook binary).
// Compatible with .NET Framework 4.x (no NuGet dependencies).
// NOTE: keep this file pure ASCII - it is extracted to disk without BOM and csc
// would misinterpret non-ASCII text on some system codepages.
//
// WHY THREE DETECTORS (the three ways a "side button" can reach Windows):
//  A. WH_MOUSE_LL        - devices exposing a plain 5-button HID mouse report
//                          (WM_XBUTTONDOWN, XBUTTON1/2 in HIWORD of mouseData).
//  B. WH_KEYBOARD_LL     - devices/firmware that report side buttons as consumer
//                          usages which Windows maps to VK_BROWSER_BACK (0xA6) /
//                          VK_BROWSER_FORWARD (0xA7). Common for Bluetooth mice and
//                          for vendor software that remaps side buttons to
//                          "browser back/forward". VERIFIED: such keys are visible to
//                          a low-level keyboard hook AND can be blocked by it, so this
//                          path has the same "detect + swallow" power as path A.
//  C. Raw Input (RIDEV_INPUTSINK) - last-resort DETECTION ONLY for devices that emit
//                          consumer-page HID reports (usage AC Back 0x0224 / AC Forward
//                          0x0225) without ever turning into a virtual key. Raw input is
//                          an observation channel: such an event cannot be swallowed here,
//                          so the app-command side effect may still reach the foreground
//                          app. It exists so the button is at least not ignored.
//
// v2/v3 reliability design (why older builds "worked for days, then died silently"):
//  1. ZERO-ALLOC CALLBACKS. WH_*_LL hooks are silently removed by Windows when a callback
//     blocks longer than LowLevelHooksTimeout. The old callback did Marshal.PtrToStructure
//     (heap alloc -> GC pressure) and File.WriteAllText (blocking IO, can stall for seconds
//     on an AV-locked file) INSIDE the callback. Now both callbacks only read an int at a
//     fixed offset (no allocation) and hand the event to a dedicated writer thread.
//  2. SILENT HOOK REMOVAL SELF-HEALING. Even a lean managed callback can be paused by the GC
//     long enough for Windows to drop the hook - and the process keeps running, so nothing
//     restarts it. A watchdog thread tracks physical cursor movement (GetCursorPos) vs the
//     time of the last mouse-hook callback. If the cursor moved within the last 20s but the
//     hook received ZERO callbacks (not even mouse moves) for 20s, the hook is dead: the
//     watchdog asks the main pump thread to re-install ALL hooks. (A GC pause kills every
//     hook of the process at once, so one detector is enough to conclude the others died too.
//     Hooks must be (re)installed on a thread that pumps messages.)
//  3. PARTIAL PASS-THROUGH. -Block 0 reports events but still swallows the BOUND side
//     button (v4 selective take-over, binding = take over). Unbound side buttons pass
//     through untouched - vendor mouse software (installed earlier in the hook chain)
//     keeps receiving them; coexistence mode for Logi Options+/XMBC users.
//  4. [hook] diagnostics are appended to bridge-debug.log (from background threads only,
//     never from a hook callback).

using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace WordTranslatorBridge
{
    public class Program
    {
        // Entry point for in-memory Add-Type loading (PowerShell calls this directly;
        // it blocks in the message pump until the parent process dies or a ctrl event).
        public static int Run(string[] args) { return Main(args); }

        // ==================== P/Invoke ====================

        delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);
        delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
        delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        const int WH_MOUSE_LL = 14;
        const int WH_KEYBOARD_LL = 13;

        // XButton mouse message (wParam value; the only mouse message HookCallback reads)
        const int WM_XBUTTONDOWN = 0x020B;

        // Keyboard messages (wParam values)
        const int WM_KEYDOWN = 0x0100;
        const int WM_SYSKEYDOWN = 0x0104;

        // Window messages
        const int WM_DESTROY = 0x0002;
        const int WM_INPUT = 0x00FF;

        // XButton identifiers in the HIWORD of MSLLHOOKSTRUCT.mouseData
        const uint XBUTTON1 = 0x0001;
        const uint XBUTTON2 = 0x0002;

        // Consumer-control side buttons that Windows maps to virtual keys
        const int VK_BROWSER_BACK = 0xA6;
        const int VK_BROWSER_FORWARD = 0xA7;

        // Raw input
        const uint RIDEV_INPUTSINK = 0x00000100;
        const uint RID_INPUT = 0x10000003;
        const uint RIM_TYPEHID = 2;
        const ushort HID_USAGE_PAGE_CONSUMER = 0x000C;
        const ushort HID_USAGE_CONSUMER_CONTROL = 0x0001;
        const ushort HID_USAGE_AC_BACK = 0x0224;
        const ushort HID_USAGE_AC_FORWARD = 0x0225;

        // Message pump / quit
        const uint WM_QUIT = 0x0012;
        const uint WM_APP = 0x8000;
        const uint WM_APP_REINSTALL = WM_APP + 0x10; // watchdog -> pump: reinstall hooks
        // writer thread -> pump: install/uninstall the keyboard hook + raw sink after a
        // hot param change. MUST run on the pump thread: low-level hook callbacks are
        // dispatched to the thread that installed the hook, and a thread without a
        // message pump (the writer's WaitOne loop) would install a hook that NEVER fires.
        const uint WM_APP_APPLYCHAN = WM_APP + 0x11;
        // FSW -> pump: params file changed; apply immediately instead of waiting for
        // the writer loop's next 200ms poll. The poll latency raced fast users who
        // press the side key ~150ms after clicking the record box (observed: press at
        // +142ms landed before the flip to block=1 and leaked to the system).
        const uint WM_APP_PARAMS = WM_APP + 0x12;

        [StructLayout(LayoutKind.Sequential)]
        struct POINT
        {
            public int x;
            public int y;
        }

        // Layout (Pack=8): POINT 0-7 | mouseData 8-11 | flags 12-15 | time 16-19 | pad 20-23 | dwExtraInfo 24-31
        // => mouseData is at byte offset 8, read directly (no struct marshaling, no allocation).
        [StructLayout(LayoutKind.Sequential)]
        struct MSLLHOOKSTRUCT
        {
            public POINT pt;         // cursor position
            public uint mouseData;   // XButton id in HIWORD
            public uint flags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        // Layout: vkCode 0-3 | scanCode 4-7 | flags 8-11 | time 12-15 | dwExtraInfo 16-23
        // => vkCode is at byte offset 0, read directly (no marshaling, no allocation).
        [StructLayout(LayoutKind.Sequential)]
        struct KBDLLHOOKSTRUCT
        {
            public uint vkCode;
            public uint scanCode;
            public uint flags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct MSG
        {
            public IntPtr hwnd;
            public uint message;
            public IntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public int ptX;
            public int ptY;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTDEVICE
        {
            public ushort usUsagePage;
            public ushort usUsage;
            public uint dwFlags;
            public IntPtr hwndTarget;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTHEADER
        {
            public uint dwType;
            public uint dwSize;
            public IntPtr hDevice;
            public IntPtr wParam;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWHID
        {
            public uint dwSizeHid;
            public uint dwCount;
            // followed by dwCount * dwSizeHid bytes of raw report data
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        struct WNDCLASSEX
        {
            public uint cbSize;
            public uint style;
            public IntPtr lpfnWndProc;
            public int cbClsExtra;
            public int cbWndExtra;
            public IntPtr hInstance;
            public IntPtr hIcon;
            public IntPtr hCursor;
            public IntPtr hbrBackground;
            [MarshalAs(UnmanagedType.LPWStr)] public string lpszMenuName;
            [MarshalAs(UnmanagedType.LPWStr)] public string lpszClassName;
            public IntPtr hIconSm;
        }

        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll")]
        static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        static extern bool TranslateMessage(ref MSG lpMsg);

        [DllImport("user32.dll")]
        static extern IntPtr DispatchMessage(ref MSG lpMsg);

        [DllImport("user32.dll")]
        static extern bool PostThreadMessage(uint idThread, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll")]
        static extern uint GetCurrentThreadId();

        [DllImport("kernel32.dll")]
        static extern bool SetConsoleCtrlHandler(ConsoleCtrlDelegate handler, bool add);

        [DllImport("user32.dll")]
        static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern ushort RegisterClassEx(ref WNDCLASSEX lpwcx);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern IntPtr CreateWindowEx(uint dwExStyle, string lpClassName, string lpWindowName,
            uint dwStyle, int x, int y, int nWidth, int nHeight, IntPtr hWndParent, IntPtr hMenu,
            IntPtr hInstance, IntPtr lpParam);

        [DllImport("user32.dll")]
        static extern bool DestroyWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern IntPtr DefWindowProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        static extern void PostQuitMessage(int nExitCode);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);

        [DllImport("user32.dll", SetLastError = true)]
        static extern uint GetRawInputData(IntPtr hRawInput, uint uiCommand, IntPtr pData, ref uint pcbSize, uint cbSizeHeader);

        delegate bool ConsoleCtrlDelegate(int sig);

        // ==================== State ====================

        static LowLevelMouseProc _hookProc;
        static LowLevelKeyboardProc _kbHookProc;
        static WndProcDelegate _wndProc;
        static IntPtr _hookId = IntPtr.Zero;      // mouse hook
        static IntPtr _kbHookId = IntPtr.Zero;    // keyboard hook
        static IntPtr _hMod = IntPtr.Zero;
        static IntPtr _rawWnd = IntPtr.Zero;      // hidden window for raw input
        static int _parentPid = 0;
        static string _eventFile = null;   // event file path
        static string _logFile = null;     // bridge-debug.log path (same dir as event file)
        static volatile bool _running = true;
        static uint _mainThreadId;
        static object _sync = new object();
        static bool _hookInstalled = false;
        static bool _kbHookInstalled = false;
        static int _blockFlag = 1;         // 1 = swallow captured side buttons (default),
                                   // 0 = report + pass through (except the bound
                                   // side button, still swallowed - v4 take-over)
        static int _consumerKeys = 1;      // 1 = also capture consumer-key forms (VK_BROWSER_* / raw HID)
        // Record (bind) mode (-Record 1): report EVERY multimedia key (VK 0xA6..0xB7) and
        // every consumer-page usage so the user can bind ANY side button - including a third
        // extra button on gaming mice, which Windows typically delivers in these forms.
        // Binding one of them never swallows it (only XButton1/2 and browser Back/Forward
        // are ever blocked): a recorded "browser refresh" key keeps its native function.
        static int _recordFlag = 0;
        // Code-bound key at runtime (-BindCode vk:0xA8 / hid:0x0094): report that key as an
        // event so a generalized binding keeps working outside the record window.
        static string _bindCode = "";
        static int _bindVk = 0;            // parsed from _bindCode (vk form), 0 = none
        static int _bindHid = 0;           // parsed from _bindCode (hid form), 0 = none
        // Hot reconfigure: the addon writes bridge-params.json next to the event file.
        // The pump thread polls it every 200ms and applies changes IN PLACE - hooks stay
        // installed, so switching record/block never leaves a hookless gap (a restart
        // gap let side buttons reach the system and flipped PDF pages; observed 16:18).
        // Reinstalling hooks is only needed for reinstall-after-removal, not for param
        // changes, because HookCallback reads _blockFlag/_recordFlag/_bindVk/_bindHid
        // live and the keyboard hook + raw sink can be (un)installed here on demand.
        static string _paramsFile = "";
        static long _paramsLastWriteTicks = 0;
        // Process start time (UTC ticks): a params file written by a PREVIOUS process
        // run (e.g. one that died inside a record window, leaving record=1 behind) must
        // never override the CLI args of THIS run. Params older than the process are
        // consumed as baseline and ignored - the CLI args are authoritative at spawn.
        static long _processStartTicks = DateTime.UtcNow.Ticks;
        static int _lastAppliedBlock = -1, _lastAppliedConsumer = -1, _lastAppliedRecord = -1;
        static string _lastAppliedBind = null;
        static int _lastAppliedXButton = -1;
        static bool _chanApplyRequested = false;
        // Selective take-over: which standard side button is BOUND (1=XButton1, 2=XButton2,
        // 3=any side button). With compat OFF (block=0) the bound button is STILL swallowed:
        // "bind this key" means this key is ours now - it triggers translation and no longer
        // triggers the native back/forward (which is exactly the PDF page-flip complaint).
        // Unbound side buttons and browser Back/Forward keys stay fully native.
        static int _boundXButton = 0;
        // FSW-based instant params apply (WM_APP_PARAMS); the writer-loop poll is the fallback.
        static FileSystemWatcher _paramsWatcher = null;
        static bool _paramsDirty = false;

        // Writer-thread handoff: callbacks only do two Interlocked writes + Set(),
        // the writer thread does all file IO.
        static readonly AutoResetEvent _wake = new AutoResetEvent(false);
        static int _pendingXButton = 0;
        static volatile string _pendingSrc = "mouse"; // which detector produced the pending event
        // Code-event hand-off (record mode / code-bound keys). Two slots: one physical
        // press can arrive through BOTH the keyboard hook (vk) and the raw sink (hid);
        // the JS side collects both and prefers the vk form (it can be blocked).
        static int _pendingVk = 0;
        static int _pendingHid = 0;

        // Watchdog state (int tick ms; unchecked subtraction is wrap-safe across 49.7d)
        static int _lastCallbackTick = Environment.TickCount;
        // Start with the cursor baseline ALREADY expired: the first cycles must observe
        // fresh movement before declaring the hook dead (avoids a pointless reinstall
        // at the 20s mark on an idle machine).
        static int _lastCursorMoveTick = Environment.TickCount - IdleWatchMs - 1;
        static POINT _lastCursorPos;
        static volatile bool _reinstallRequested = false;
        static int _reinstallCount = 0;
        const int MaxReinstalls = 30;
        const int IdleWatchMs = 20000;     // cursor-active window vs zero-callback window

        static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        static readonly object _logSync = new object();
        const string RAW_WINDOW_CLASS = "WordTranslatorBridgeRawInput";

        // ==================== JSON helpers (no external deps) ====================

        static string MakeJson(long ts, bool x1, bool x2, string src, string code)
        {
            var sb = new StringBuilder(96);
            sb.Append("{\"ts\":").Append(ts.ToString());
            if (x1) sb.Append(",\"x1\":1");
            if (x2) sb.Append(",\"x2\":1");
            if (!string.IsNullOrEmpty(src))
            {
                sb.Append(",\"src\":\"").Append(src.Replace("\\", "").Replace("\"", "")).Append('"');
            }
            if (!string.IsNullOrEmpty(code))
            {
                sb.Append(",\"code\":\"").Append(code.Replace("\\", "").Replace("\"", "")).Append('"');
            }
            sb.Append('}');
            return sb.ToString();
        }

        static string MakeInitJson(bool ok, string error, bool kbHook, bool hidSink, bool mouseHook)
        {
            var sb = new StringBuilder(200);
            sb.Append("{\"_bridgeInit\":").Append(ok ? "true" : "false");
            sb.Append(",\"ts\":").Append(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString());
            sb.Append(",\"mouseHook\":").Append(mouseHook ? "true" : "false");
            sb.Append(",\"kbHook\":").Append(kbHook ? "true" : "false");
            sb.Append(",\"hidSink\":").Append(hidSink ? "true" : "false");
            if (!string.IsNullOrEmpty(error))
            {
                sb.Append(",\"error\":\"");
                sb.Append(error.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " "));
                sb.Append('"');
            }
            sb.Append('}');
            return sb.ToString();
        }

        // Write one JSON event line to the event file (writer thread only).
        // Small retry so a transient lock (AV scanning the file / addon mid-read) does
        // not lose the event.
        static void WriteEventJson(string json)
        {
            if (string.IsNullOrEmpty(_eventFile)) return;
            for (int attempt = 0; attempt < 3; attempt++)
            {
                try
                {
                    File.WriteAllText(_eventFile, json, Utf8NoBom);
                    return;
                }
                catch (ThreadInterruptedException) { return; }
                catch
                {
                    try { Thread.Sleep(15); } catch { return; }
                }
            }
        }

        static void EmitEvent(int xbutton, string src)
        {
            WriteEventJson(MakeJson(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), xbutton == 1, xbutton == 2, src, null));
        }

        static void EmitCodeEvent(long ts, string code, string src)
        {
            WriteEventJson(MakeJson(ts, false, false, src, code));
        }

        static void EmitInit(bool ok, string error)
        {
            bool kb = false, hid = false, mouse = false;
            lock (_sync)
            {
                kb = _kbHookInstalled;
                mouse = _hookInstalled;
                hid = _rawWnd != IntPtr.Zero;
            }
            WriteEventJson(MakeInitJson(ok, error, kb, hid, mouse));
        }

        // Append a "[hook]" diagnostic line to bridge-debug.log. Must NEVER be called
        // from a hook callback thread (blocking IO there gets the hook removed).
        static void LogLine(string msg)
        {
            if (string.IsNullOrEmpty(_logFile)) return;
            try
            {
                lock (_logSync)
                {
                    File.AppendAllText(_logFile,
                        "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] [hook] " + msg + Environment.NewLine,
                        Utf8NoBom);
                }
            }
            catch { }
        }

        // Single parse point for the bound-code key ("vk:0xA8" / "hid:0x0094"). The args
        // path clears _bindCode on invalid input; the params path used to keep garbage -
        // both now funnel through here so behavior is identical.
        static void TryParseBindCode(string code)
        {
            _bindCode = code ?? "";
            _bindVk = 0;
            _bindHid = 0;
            if (_bindCode.Length == 0) return;
            var m = System.Text.RegularExpressions.Regex.Match(
                _bindCode, @"^vk:0x([0-9A-Fa-f]{2})$|^hid:0x([0-9A-Fa-f]{4})$");
            if (!m.Success)
            {
                _bindCode = "";
                return;
            }
            if (m.Groups[1].Success) _bindVk = Convert.ToInt32(m.Groups[1].Value, 16);
            else _bindHid = Convert.ToInt32(m.Groups[2].Value, 16);
        }

        // Single predicate for "does anything need the keyboard channel": consumer capture
        // (Bluetooth / remapped side buttons), the record window (report multimedia keys),
        // or a bound code key (vk:0xNN / hid:0xNNNN) that must be reported at runtime.
        // Previously the three install sites used different predicates (startup: consumer;
        // ApplyChannels: consumer; ReinstallHook: consumer||record) - binding a code key
        // and then turning compat OFF silently killed that binding (hook torn down while
        // the JS "code bindings survive compat off" promise still stood), and the same
        // params could end up with the hook installed or not depending on which path
        // applied them. One predicate here, used everywhere.
        static bool KeyboardChannelWanted()
        {
            return _consumerKeys != 0 || _recordFlag != 0 || _bindVk != 0 || _bindHid != 0;
        }

        // Install / keep / tear down the keyboard channel to match KeyboardChannelWanted().
        // Reentrant-lock safe (Monitor): callers already holding _sync may call directly.
        static void EnsureKeyboardChannel()
        {
            lock (_sync)
            {
                if (KeyboardChannelWanted())
                {
                    if (_kbHookId == IntPtr.Zero)
                    {
                        _kbHookProc = KbHookCallback;
                        try
                        {
                            _kbHookId = SetWindowsHookEx(WH_KEYBOARD_LL, _kbHookProc, _hMod, 0);
                        }
                        catch (Exception ex)
                        {
                            _kbHookId = IntPtr.Zero;
                            LogLine("keyboard hook FAILED (exception: " + ex.Message + ")");
                        }
                        if (_kbHookId == IntPtr.Zero)
                        {
                            LogLine("keyboard hook FAILED (Win32 error " + Marshal.GetLastWin32Error() + ")");
                        }
                    }
                    if (_rawWnd == IntPtr.Zero) CreateRawInputWindow();
                }
                else if (_kbHookId != IntPtr.Zero)
                {
                    // Nothing needs the channel: tear it down. The mouse hook stays
                    // installed throughout - removing it would re-open the no-hook gap
                    // this hot path exists to close (side buttons leaking to the system).
                    try { UnhookWindowsHookEx(_kbHookId); } catch { }
                    _kbHookId = IntPtr.Zero;
                }
                _kbHookInstalled = (_kbHookId != IntPtr.Zero);
            }
        }

        // Apply a params file entry. Split in two halves for a hard Windows constraint:
        // low-level hook callbacks are delivered to the thread that INSTALLED the hook, and
        // that thread needs a message pump. The writer thread has none, so installing the
        // keyboard hook there would produce a hook that never fires (deterministic failure,
        // confirmed by E2E: "params applied: kbHook=True" logged, yet no key event arrived).
        //   - flags (block/record/bind): plain field writes, safe from any thread, applied
        //     immediately so the mouse hook's swallow behaviour flips instantly;
        //   - channels (kb hook / raw sink): deferred to the pump thread via WM_APP_APPLYCHAN.
        static void ApplyParams(int block, int consumer, int record, string bind, int xbutton)
        {
            lock (_sync)
            {
                _boundXButton = (xbutton >= 0 && xbutton <= 3) ? xbutton : 0;
                _blockFlag = (block != 0) ? 1 : 0;
                _recordFlag = (record != 0) ? 1 : 0;
                TryParseBindCode(bind);
                int consumerNow = (consumer != 0) ? 1 : 0;
                _consumerKeys = consumerNow;
                LogLine("params applied: block=" + _blockFlag + ", consumerKeys=" + _consumerKeys +
                        ", record=" + _recordFlag + ", bind=" + _bindCode +
                        ", xbutton=" + _boundXButton);
                // Any applied param can change what the keyboard channel needs (record
                // window on/off, bound code key appear/disappear), so always sync the
                // channel on apply. The predicate lives in one place
                // (KeyboardChannelWanted); the sync is idempotent and cheap.
                _chanApplyRequested = true;
                try { PostThreadMessage(_mainThreadId, WM_APP_APPLYCHAN, IntPtr.Zero, IntPtr.Zero); } catch { }
            }
        }

        // Channel half of ApplyParams - PUMP THREAD ONLY (see the note above).
        static void ApplyChannels()
        {
            EnsureKeyboardChannel();
            LogLine("params: channels applied - kbHook=" + _kbHookInstalled +
                    ", rawSink=" + (_rawWnd != IntPtr.Zero));
        }

        // Parse the params file and apply changed values. File is tiny JSON written
        // by the addon via os.File.writeAtomic; a torn/partial write just fails the
        // parse and is retried on the next tick.
        static void PollParamsFile()
        {
            if (string.IsNullOrEmpty(_paramsFile)) return;
            try
            {
                var fi = new FileInfo(_paramsFile);
                if (!fi.Exists) return;
                long ticks = fi.LastWriteTimeUtc.Ticks;
                if (ticks == _paramsLastWriteTicks) return; // unchanged since last apply
                // Stale from a previous process run: consume the cursor, never apply.
                // The CLI args passed to THIS process are the authoritative spawn state.
                if (ticks <= _processStartTicks)
                {
                    _paramsLastWriteTicks = ticks;
                    return;
                }
                string json;
                try { json = File.ReadAllText(_paramsFile, Encoding.UTF8); }
                catch { return; } // mid-write / locked: retry on the next tick
                // Only advance the cursor once a FULL, parseable payload was read.
                // Advancing first meant a torn read (addon truncate+write) was marked as
                // "already applied" and the config silently never took effect.
                if (json.IndexOf('{') < 0 || json.IndexOf('}') < 0) return;
                int block = _blockFlag, consumer = _consumerKeys, record = _recordFlag;
                string bind = _bindCode;
                var mb = System.Text.RegularExpressions.Regex.Match(json, @"""block""\s*:\s*(\d)");
                var mc = System.Text.RegularExpressions.Regex.Match(json, @"""consumerKeys""\s*:\s*(\d)");
                var mr = System.Text.RegularExpressions.Regex.Match(json, @"""record""\s*:\s*(\d)");
                var md = System.Text.RegularExpressions.Regex.Match(json, @"""bind""\s*:\s*""([^""]*)""");
                var mx = System.Text.RegularExpressions.Regex.Match(json, @"""xbutton""\s*:\s*(\d)");
                if (mb.Success) block = Convert.ToInt32(mb.Groups[1].Value);
                if (mc.Success) consumer = Convert.ToInt32(mc.Groups[1].Value);
                if (mr.Success) record = Convert.ToInt32(mr.Groups[1].Value);
                if (md.Success) bind = md.Groups[1].Value;
                int xbutton = _boundXButton;
                if (mx.Success) xbutton = Convert.ToInt32(mx.Groups[1].Value);
                _paramsLastWriteTicks = ticks;
                if (block != _lastAppliedBlock || consumer != _lastAppliedConsumer ||
                    record != _lastAppliedRecord || bind != _lastAppliedBind ||
                    xbutton != _lastAppliedXButton)
                {
                    _lastAppliedBlock = block; _lastAppliedConsumer = consumer;
                    _lastAppliedRecord = record; _lastAppliedBind = bind;
                    _lastAppliedXButton = xbutton;
                    ApplyParams(block, consumer, record, bind, xbutton);
                }
            }
            catch { }
        }

        // Instant params apply: watch the params file and wake the pump on change.
        // The 200ms writer-loop poll raced users who press the side key ~150ms after
        // clicking the record box - the press landed before block flipped to 1 and the
        // native back/forward fired (PDF page flip). FSW fires within milliseconds.
        static void StartParamsWatcher()
        {
            if (string.IsNullOrEmpty(_paramsFile) || _paramsWatcher != null) return;
            try
            {
                _paramsWatcher = new FileSystemWatcher(
                    Path.GetDirectoryName(_paramsFile), Path.GetFileName(_paramsFile));
                _paramsWatcher.NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName;
                _paramsWatcher.Created += OnParamsFsEvent;
                _paramsWatcher.Changed += OnParamsFsEvent;
                _paramsWatcher.EnableRaisingEvents = true;
                LogLine("params watcher armed (instant apply)");
            }
            catch (Exception ex)
            {
                LogLine("params watcher FAILED: " + ex.Message + " (poll fallback stays active)");
                _paramsWatcher = null;
            }
        }

        static void OnParamsFsEvent(object sender, FileSystemEventArgs e)
        {
            // Threadpool thread: only set flags + post; the pump does the work.
            _paramsDirty = true;
            try { PostThreadMessage(_mainThreadId, WM_APP_PARAMS, IntPtr.Zero, IntPtr.Zero); } catch { }
        }

        // Hand an event to the writer thread (safe from hook callbacks: no allocation,
        // no IO, no locks).
        static void EmitAsync(int xbutton, string src)
        {
            _pendingSrc = src;
            Interlocked.Exchange(ref _pendingXButton, xbutton);
            try { _wake.Set(); } catch { }
        }

        // ==================== Hook callbacks (hot path: keep them tiny) ====================

        static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            // Any callback (even WM_MOUSEMOVE) proves the mouse hook is alive.
            Volatile.Write(ref _lastCallbackTick, Environment.TickCount);
            try
            {
                if (nCode >= 0 && wParam.ToInt32() == WM_XBUTTONDOWN)
                {
                    // mouseData lives at byte offset 8 (see MSLLHOOKSTRUCT layout comment)
                    int mouseData = Marshal.ReadInt32(lParam, 8);
                    uint hiWord = (uint)((mouseData >> 16) & 0xFFFF);
                    int xbutton = (hiWord == XBUTTON1) ? 1 : ((hiWord == XBUTTON2) ? 2 : 0);
                    if (xbutton > 0)
                    {
                        EmitAsync(xbutton, "mouse");
                        bool swallow = _blockFlag != 0;
                        if (!swallow && _boundXButton != 0)
                        {
                            // Selective take-over with compat OFF: the BOUND side button is
                            // ours - swallow it so it triggers translation without the
                            // native back/forward (the PDF page-flip complaint). Unbound
                            // side buttons keep passing through.
                            swallow = (_boundXButton == 3) || (_boundXButton == xbutton);
                        }
                        if (swallow)
                        {
                            // Block the event: prevents back/forward navigation in the
                            // browser layer AND stops the click through.
                            return (IntPtr)1;
                        }
                        // Pass-through mode: earlier-installed hooks (vendor mouse
                        // software) and the target app still receive the event.
                    }
                }
            }
            catch { /* never throw out of a hook */ }
            return CallNextHookEx(_hookId, nCode, wParam, lParam);
        }

        static IntPtr KbHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            try
            {
                if (nCode >= 0)
                {
                    int msg = wParam.ToInt32();
                    if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
                    {
                        // vkCode lives at byte offset 0 (see KBDLLHOOKSTRUCT layout comment)
                        int vk = Marshal.ReadInt32(lParam, 0);
                        if (_recordFlag != 0)
                        {
                            // Record window: every multimedia key (browser/media/launch
                            // cluster, 0xA6..0xB7 - none of them typing keys) becomes a
                            // bindable candidate. Browser Back/Forward are still swallowed
                            // when blocking is on (the user explicitly entered the record
                            // window; pass-through here would flip the PDF page - observed
                            // in real use). Other multimedia keys keep passing through.
                            if (vk >= 0xA6 && vk <= 0xB7)
                            {
                                Interlocked.Exchange(ref _pendingVk, vk);
                                try { _wake.Set(); } catch { }
                                if (_blockFlag != 0 && (vk == VK_BROWSER_BACK || vk == VK_BROWSER_FORWARD))
                                {
                                    return (IntPtr)1;
                                }
                            }
                        }
                        else if (_bindVk != 0 && vk == _bindVk)
                        {
                            // Code-bound key (checked BEFORE the browser-back branch: a key
                            // explicitly bound as vk:0xA6/0xA7 must be reported as its code
                            // event, otherwise the JS code matching never sees it).
                            // Browser Back/Forward stay swallowed when blocking is on;
                            // any other bound key is reported but never swallowed.
                            Interlocked.Exchange(ref _pendingVk, vk);
                            try { _wake.Set(); } catch { }
                            if (_blockFlag != 0 && (vk == VK_BROWSER_BACK || vk == VK_BROWSER_FORWARD))
                            {
                                return (IntPtr)1;
                            }
                        }
                        else if (vk == VK_BROWSER_BACK || vk == VK_BROWSER_FORWARD)
                        {
                            int btn = (vk == VK_BROWSER_BACK) ? 1 : 2;
                            EmitAsync(btn, "vk");
                            if (_blockFlag != 0)
                            {
                                // Blocking the key also suppresses the app-command that
                                // would otherwise trigger back/forward navigation.
                                return (IntPtr)1;
                            }
                        }
                    }
                }
            }
            catch { }
            return CallNextHookEx(_kbHookId, nCode, wParam, lParam);
        }

        // ==================== Raw input (consumer-page detection, observe-only) ====================

        // Scan one HID report for consumer usages AC Back / AC Forward.
        // Consumer controls are reported as an array of 16-bit usage codes, so a plain
        // 16-bit little-endian scan finds them regardless of the report id / bit padding
        // used by the device. Pure function (unit-testable).
        // Returns 0 = nothing, 1 = AC Back, 2 = AC Forward.
        static int ScanConsumerReport(byte[] report, int length)
        {
            if (report == null || length < 2) return 0;
            if (length > report.Length) length = report.Length;
            for (int i = 0; i + 1 < length; i++)
            {
                int usage = report[i] | (report[i + 1] << 8);
                if (usage == HID_USAGE_AC_BACK) return 1;
                if (usage == HID_USAGE_AC_FORWARD) return 2;
            }
            return 0;
        }

        // Record mode: find the first plausible consumer usage in a report. Consumer-page
        // controls live roughly in [0x20..0xFFF]; the scan skips zeros (padding) and tiny
        // values (report ids / noise). Imprecise by design - the JS side settles on the
        // best candidate and only ever uses the result as a bindable fingerprint.
        static int FindFirstConsumerUsage(byte[] report, int length)
        {
            if (report == null || length < 2) return 0;
            if (length > report.Length) length = report.Length;
            for (int i = 0; i + 1 < length; i++)
            {
                int usage = report[i] | (report[i + 1] << 8);
                if (usage >= 0x20 && usage <= 0xFFF) return usage;
            }
            return 0;
        }

        static IntPtr RawWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
        {
            try
            {
                if (msg == WM_INPUT)
                {
                    ProcessRawInput(lParam);
                }
                else if (msg == WM_DESTROY)
                {
                    PostQuitMessage(0);
                }
            }
            catch { }
            return DefWindowProc(hWnd, msg, wParam, lParam);
        }

        static void ProcessRawInput(IntPtr hRawInput)
        {
            // Drop WM_INPUT at the source when no consumer-form interest exists at all.
            // The raw window may outlive a hot consumer=0 switch (it is only torn down
            // with the process); without this guard a leftover sink would keep reporting
            // hid events. The record window and a bound hid code key still need the
            // sink - hence the exemptions.
            if (_consumerKeys == 0 && _recordFlag == 0 && _bindHid == 0) return;
            uint headerSize = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
            uint size = 0;
            try
            {
                uint probe = GetRawInputData(hRawInput, RID_INPUT, IntPtr.Zero, ref size, headerSize);
                if (probe != 0 || size == 0 || size > 4096) return;

                IntPtr buf = Marshal.AllocHGlobal((int)size);
                try
                {
                    uint got = GetRawInputData(hRawInput, RID_INPUT, buf, ref size, headerSize);
                    if (got == unchecked((uint)-1) || got == 0) return;

                    uint type = (uint)Marshal.ReadInt32(buf, 0);
                    if (type != RIM_TYPEHID) return;

                    int off = (int)headerSize;
                    uint sizeHid = (uint)Marshal.ReadInt32(buf, off);
                    uint count = (uint)Marshal.ReadInt32(buf, off + 4);
                    if (sizeHid == 0 || sizeHid > 64 || count == 0 || count > 32) return;

                    int dataOff = off + 8;
                    byte[] report = new byte[sizeHid];
                    for (uint i = 0; i < count; i++)
                    {
                        IntPtr src = new IntPtr(buf.ToInt64() + dataOff + (long)(i * sizeHid));
                        Marshal.Copy(src, report, 0, (int)sizeHid);
                        if (_recordFlag != 0)
                        {
                            // Record window: report the first plausible usage as a code
                            // candidate. No legacy btn mapping here - a consumer-form
                            // Back/Forward must be bound as hid:0x0224/0x0225, NOT as a
                            // standard XButton (the settle window prefers the vk form when
                            // Windows also synthesizes a key event).
                            int usageRec = FindFirstConsumerUsage(report, (int)sizeHid);
                            if (usageRec > 0)
                            {
                                Interlocked.Exchange(ref _pendingHid, usageRec);
                                try { _wake.Set(); } catch { }
                                break;
                            }
                            continue;
                        }
                        if (_bindHid != 0)
                        {
                            // Code-bound consumer key (checked BEFORE the legacy Back/Forward
                            // scan: an explicitly bound hid usage must arrive as its code
                            // event). Observe-only, never swallowed at this layer.
                            int usageBind = FindFirstConsumerUsage(report, (int)sizeHid);
                            if (usageBind == _bindHid)
                            {
                                Interlocked.Exchange(ref _pendingHid, usageBind);
                                try { _wake.Set(); } catch { }
                                break;
                            }
                        }
                        int btn = ScanConsumerReport(report, (int)sizeHid);
                        if (btn > 0)
                        {
                            // Observe-only channel: raw input cannot swallow the event,
                            // so the app-command effect may still reach the app.
                            EmitAsync(btn, "hid");
                            LogLine("raw input: consumer usage detected (btn=" + btn + "), cannot be swallowed at this layer");
                            break;
                        }
                    }
                }
                finally { Marshal.FreeHGlobal(buf); }
            }
            catch { }
        }

        // Create the hidden window that receives WM_INPUT and register the raw input sink.
        static bool CreateRawInputWindow()
        {
            try
            {
                _wndProc = RawWndProc;
                WNDCLASSEX wc = new WNDCLASSEX();
                wc.cbSize = (uint)Marshal.SizeOf(typeof(WNDCLASSEX));
                wc.style = 0;
                wc.lpfnWndProc = Marshal.GetFunctionPointerForDelegate(_wndProc);
                wc.hInstance = _hMod;
                wc.lpszClassName = RAW_WINDOW_CLASS;
                RegisterClassEx(ref wc); // ERROR_CLASS_ALREADY_EXISTS is harmless

                _rawWnd = CreateWindowEx(0, RAW_WINDOW_CLASS, "WordTranslatorRawInput", 0,
                    0, 0, 0, 0, IntPtr.Zero, IntPtr.Zero, _hMod, IntPtr.Zero);
                if (_rawWnd == IntPtr.Zero)
                {
                    LogLine("raw input: CreateWindowEx FAILED (Win32 error " + Marshal.GetLastWin32Error() + ")");
                    return false;
                }

                RAWINPUTDEVICE[] devices = new RAWINPUTDEVICE[1];
                devices[0].usUsagePage = HID_USAGE_PAGE_CONSUMER;
                devices[0].usUsage = HID_USAGE_CONSUMER_CONTROL;
                devices[0].dwFlags = RIDEV_INPUTSINK;
                devices[0].hwndTarget = _rawWnd;

                bool ok = RegisterRawInputDevices(devices, 1, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
                if (!ok)
                {
                    LogLine("raw input: RegisterRawInputDevices FAILED (Win32 error " + Marshal.GetLastWin32Error() + ")");
                    return false;
                }
                LogLine("raw input: consumer-page sink registered (observe-only)");
                return true;
            }
            catch (Exception ex)
            {
                LogLine("raw input: setup EXCEPTION " + ex.Message);
                return false;
            }
        }

        // ==================== Writer thread ====================

        static void EventWriterLoop()
        {
            while (_running)
            {
                try { _wake.WaitOne(200); } catch { }
                if (!_running) break;
                PollParamsFile();
                int v = Interlocked.Exchange(ref _pendingXButton, 0);
                if (v != 0)
                {
                    string src = _pendingSrc ?? "mouse";
                    EmitEvent(v, src);
                }
                long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                int rvk = Interlocked.Exchange(ref _pendingVk, 0);
                if (rvk != 0)
                {
                    EmitCodeEvent(now, "vk:0x" + rvk.ToString("X2"), "vk");
                }
                int rhid = Interlocked.Exchange(ref _pendingHid, 0);
                if (rhid != 0)
                {
                    EmitCodeEvent(now, "hid:0x" + rhid.ToString("X4"), "hid");
                }
            }
        }

        // ==================== Watchdog thread ====================

        static void HookWatchdog()
        {
            while (_running)
            {
                try { Thread.Sleep(5000); } catch { break; }
                if (!_running) break;
                try
                {
                    POINT cur = new POINT();
                    bool gotCursor = false;
                    try { gotCursor = GetCursorPos(out cur); } catch { }
                    int now = Environment.TickCount;
                    if (gotCursor && (cur.x != _lastCursorPos.x || cur.y != _lastCursorPos.y))
                    {
                        _lastCursorPos = cur;
                        _lastCursorMoveTick = now;
                    }

                    bool cursorActive = unchecked(now - _lastCursorMoveTick) < IdleWatchMs;
                    bool callbackIdle = unchecked(now - Volatile.Read(ref _lastCallbackTick)) > IdleWatchMs;

                    if (cursorActive && callbackIdle)
                    {
                        // The cursor is moving but the mouse hook has not been called back at
                        // all (not even WM_MOUSEMOVE) for 20s: Windows silently removed the
                        // hooks. A GC pause kills all of them at once, so re-install every
                        // hook on the pump thread.
                        int count = Interlocked.Increment(ref _reinstallCount);
                        if (count <= MaxReinstalls)
                        {
                            LogLine("watchdog: hooks look dead (cursor active, zero callbacks >20s), requesting reinstall #" + count);
                            _reinstallRequested = true;
                            try { PostThreadMessage(_mainThreadId, WM_APP_REINSTALL, IntPtr.Zero, IntPtr.Zero); } catch { }
                        }
                        else
                        {
                            LogLine("watchdog: reinstall limit reached (" + MaxReinstalls + "), giving up");
                        }
                        // Reset baselines so the next check requires fresh activity.
                        Volatile.Write(ref _lastCallbackTick, now);
                        _lastCursorMoveTick = unchecked(now - IdleWatchMs - 1);
                    }
                }
                catch { }
            }
        }

        // ==================== Reinstall (pump thread only) ====================

        static void ReinstallHook()
        {
            lock (_sync)
            {
                try
                {
                    if (_hookId != IntPtr.Zero) UnhookWindowsHookEx(_hookId);
                }
                catch { }
                try
                {
                    if (_kbHookId != IntPtr.Zero) UnhookWindowsHookEx(_kbHookId);
                }
                catch { }
                _hookId = IntPtr.Zero;
                _kbHookId = IntPtr.Zero;

                try
                {
                    _hookId = SetWindowsHookEx(WH_MOUSE_LL, _hookProc, _hMod, 0);
                }
                catch (Exception ex)
                {
                    _hookId = IntPtr.Zero;
                    LogLine("hook reinstall FAILED mouse (exception: " + ex.Message + ")");
                }
                if (KeyboardChannelWanted())
                {
                    EnsureKeyboardChannel();
                }

                _hookInstalled = (_hookId != IntPtr.Zero);
                _kbHookInstalled = (_kbHookId != IntPtr.Zero);
                LogLine("hooks reinstalled (#" + _reinstallCount + "): mouse=" + _hookInstalled + " keyboard=" + _kbHookInstalled);
            }
        }

        // ==================== Console handler / cleanup ====================

        static bool OnConsoleCtrl(int sig)
        {
            _running = false;
            CleanupHook();
            try { PostThreadMessage(_mainThreadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero); } catch { }
            return true; // handled - prevent hard kill
        }

        static void CleanupHook()
        {
            lock (_sync)
            {
                if (_hookInstalled && _hookId != IntPtr.Zero)
                {
                    try { UnhookWindowsHookEx(_hookId); } catch { }
                    _hookId = IntPtr.Zero;
                }
                if (_kbHookInstalled && _kbHookId != IntPtr.Zero)
                {
                    try { UnhookWindowsHookEx(_kbHookId); } catch { }
                    _kbHookId = IntPtr.Zero;
                }
                _hookInstalled = false;
                _kbHookInstalled = false;
            }
        }

        // ==================== Parent process watcher ====================

        static void ParentWatcher()
        {
            while (_running)
            {
                try
                {
                    Thread.Sleep(3000);
                    if (!_running) break;
                    if (_parentPid > 0)
                    {
                        Process.GetProcessById(_parentPid); // throws if gone
                    }
                }
                catch
                {
                    // Parent process exited (or was never there).
                    // Clear low-level hooks so the side buttons
                    // are no longer swallowed by us.
                    CleanupHook();
                    _running = false;
                    try { PostThreadMessage(_mainThreadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero); } catch { }
                    break;
                }
            }
        }

        // ==================== Main ====================

        static int Main(string[] args)
        {
            // ---- parse args ----
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "-EventFile" && i + 1 < args.Length)
                {
                    _eventFile = args[++i];
                }
                else if (args[i] == "-ParentPid" && i + 1 < args.Length)
                {
                    int pid;
                    if (int.TryParse(args[++i], out pid)) _parentPid = pid;
                }
                else if (args[i] == "-Block" && i + 1 < args.Length)
                {
                    int b;
                    if (int.TryParse(args[++i], out b)) _blockFlag = (b != 0) ? 1 : 0;
                }
                else if (args[i] == "-ConsumerKeys" && i + 1 < args.Length)
                {
                    int c;
                    if (int.TryParse(args[++i], out c)) _consumerKeys = (c != 0) ? 1 : 0;
                }
                else if (args[i] == "-Record" && i + 1 < args.Length)
                {
                    int r;
                    if (int.TryParse(args[++i], out r)) _recordFlag = (r != 0) ? 1 : 0;
                }
                else if (args[i] == "-XButton" && i + 1 < args.Length)
                {
                    // Which standard side button is bound (1/2, 3 = any). With block=0
                    // (compat off) this button is STILL swallowed: bind = take over the
                    // bound key; unbound side buttons and browser keys stay native.
                    int xb;
                    if (int.TryParse(args[++i], out xb)) _boundXButton = (xb >= 0 && xb <= 3) ? xb : 0;
                }
                else if (args[i] == "-BindCode" && i + 1 < args.Length)
                {
                    // "vk:0xA8" or "hid:0x0094" - the code-bound key to report at runtime.
                    TryParseBindCode(args[++i]);
                }
            }

            if (!string.IsNullOrEmpty(_eventFile))
            {
                try
                {
                    _logFile = Path.Combine(Path.GetDirectoryName(_eventFile), "bridge-debug.log");
                    _paramsFile = Path.Combine(Path.GetDirectoryName(_eventFile), "bridge-params.json");
                }
                catch { _logFile = null; _paramsFile = ""; }
            }

            _mainThreadId = GetCurrentThreadId();
            try { SetConsoleCtrlHandler(OnConsoleCtrl, true); } catch { }
            try { Console.OutputEncoding = Encoding.UTF8; } catch { } // may throw when stdout is redirected/no console

            // ---- module handle for SetWindowsHookEx ----
            try
            {
                Process cur = Process.GetCurrentProcess();
                if (cur != null && cur.MainModule != null)
                {
                    _hMod = GetModuleHandle(cur.MainModule.ModuleName);
                }
            }
            catch { }

            // ---- install the low-level mouse hook ----
            _hookProc = HookCallback;
            try
            {
                _hookId = SetWindowsHookEx(WH_MOUSE_LL, _hookProc, _hMod, 0);
            }
            catch (Exception ex)
            {
                _hookId = IntPtr.Zero;
                EmitInit(false, "SetWindowsHookEx(mouse) threw: " + ex.Message);
                return 1;
            }

            if (_hookId == IntPtr.Zero)
            {
                int err = Marshal.GetLastWin32Error();
                EmitInit(false, "SetWindowsHookEx(mouse) failed (Win32 error " + err + ")");
                return 1;
            }

            // ---- keyboard channel (shared predicate: consumer capture OR record window OR a
            // bound code key - see KeyboardChannelWanted) ----
            EnsureKeyboardChannel();

            lock (_sync)
            {
                _hookInstalled = true;
                _kbHookInstalled = (_kbHookId != IntPtr.Zero);
            }

            EmitInit(true, "");
            LogLine("hook started: block=" + _blockFlag + ", consumerKeys=" + _consumerKeys +
                    ", record=" + _recordFlag + ", bind=" + (_bindCode ?? "") +
                    ", xbutton=" + _boundXButton +
                    ", mouseHook=" + _hookInstalled + ", kbHook=" + _kbHookInstalled +
                    ", parentPid=" + _parentPid + ", eventFile=" + (_eventFile ?? ""));
            // Baseline for the params poller: whatever was passed via args is already
            // applied; avoid a redundant ApplyParams on the first poll tick.
            _lastAppliedBlock = _blockFlag;
            _lastAppliedConsumer = _consumerKeys;
            _lastAppliedRecord = _recordFlag;
            _lastAppliedBind = _bindCode ?? "";
            _lastAppliedXButton = _boundXButton;
            StartParamsWatcher();

            // ---- writer thread (all event-file IO lives here, never in a callback) ----
            Thread writer = new Thread(EventWriterLoop);
            writer.IsBackground = true;
            writer.Start();

            // ---- watchdog (self-heals silently removed hooks) ----
            Thread watchdog = new Thread(HookWatchdog);
            watchdog.IsBackground = true;
            watchdog.Start();

            // ---- parent watcher thread ----
            if (_parentPid > 0)
            {
                Thread watcher = new Thread(ParentWatcher);
                watcher.IsBackground = true;
                watcher.Start();
            }

            // ---- message pump (REQUIRED for WH_*_LL hooks AND for WM_INPUT) ----
            MSG msg;
            while (_running && GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
            {
                // Re-install must run on this pumping thread (LL hooks are dispatched to
                // the thread that installed them; installing from a non-pumping thread
                // would produce a hook that never fires).
                if (msg.message == WM_APP_REINSTALL && _reinstallRequested)
                {
                    _reinstallRequested = false;
                    ReinstallHook();
                    continue;
                }
                // Hot param change: install/uninstall the keyboard channel here, on the
                // thread that owns the pump. Same constraint as above - a hook installed
                // from the writer thread would never fire. The mouse hook is never touched
                // here, so side buttons can never leak while reconfiguring.
                if (msg.message == WM_APP_APPLYCHAN && _chanApplyRequested)
                {
                    _chanApplyRequested = false;
                    ApplyChannels();
                    continue;
                }
                // Instant params apply path (FSW); the writer-loop poll is the fallback.
                if (msg.message == WM_APP_PARAMS && _paramsDirty)
                {
                    _paramsDirty = false;
                    PollParamsFile();
                    continue;
                }
                // Window messages (WM_INPUT) only reach the WndProc through DispatchMessage.
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }

            // ---- cleanup ----
            CleanupHook();
            try { if (_rawWnd != IntPtr.Zero) DestroyWindow(_rawWnd); } catch { }

            return 0;
        }
    }
}