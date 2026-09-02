// WordTranslator XButton Low-Level Mouse Hook (WH_MOUSE_LL)
// Detects XButton1/XButton2 at the OS level, BEFORE the browser sees them,
// and BLOCKS the event so the browser never receives back/forward navigation.
// Loaded IN-MEMORY by xbutton-bridge.js via PowerShell Add-Type (no -OutputAssembly,
// so nothing is written as an .exe — avoids AV quarantining a dropped global-hook binary).
// Compatible with .NET Framework 4.x (no NuGet dependencies).

using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace WordTranslatorBridge
{
    public class Program
    {
        // Entry point for in-memory Add-Type loading (PowerShell calls this directly;
        // it blocks in the message pump until the parent process dies or a ctrl event).
        public static int Run(string[] args) { return Main(args); }

        // ==================== P/Invoke ====================

        delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

        const int WH_MOUSE_LL = 14;

        // Mouse messages (wParam values)
        const int WM_MOUSEMOVE = 0x0200;
        const int WM_LBUTTONDOWN = 0x0201;
        const int WM_LBUTTONUP = 0x0202;
        const int WM_RBUTTONDOWN = 0x0204;
        const int WM_RBUTTONUP = 0x0205;
        const int WM_MBUTTONDOWN = 0x0207;
        const int WM_MBUTTONUP = 0x0208;
        const int WM_XBUTTONDOWN = 0x020B;
        const int WM_XBUTTONUP = 0x020C;

        // XButton identifiers in the HIWORD of MSLLHOOKSTRUCT.mouseData
        const uint XBUTTON1 = 0x0001;
        const uint XBUTTON2 = 0x0002;

        // Message pump / quit
        const uint WM_QUIT = 0x0012;

        [StructLayout(LayoutKind.Sequential)]
        struct POINT
        {
            public int x;
            public int y;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct MSLLHOOKSTRUCT
        {
            public POINT pt;         // cursor position
            public uint mouseData;   // XButton id in HIWORD
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

        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll")]
        static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        static extern bool PostThreadMessage(uint idThread, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll")]
        static extern uint GetCurrentThreadId();

        [DllImport("kernel32.dll")]
        static extern bool SetConsoleCtrlHandler(ConsoleCtrlDelegate handler, bool add);

        delegate bool ConsoleCtrlDelegate(int sig);

        // ==================== State ====================

        static LowLevelMouseProc _hookProc;
        static IntPtr _hookId = IntPtr.Zero;
        static int _parentPid = 0;
        static string _eventFile = null;   // optional fallback file (may be empty)
        static volatile bool _running = true;
        static uint _mainThreadId;
        static object _sync = new object();
        static bool _hookInstalled = false;

        // ==================== JSON helper (no external deps) ====================

        static string MakeJson(long ts, bool x1, bool x2)
        {
            var sb = new StringBuilder(64);
            sb.Append("{\"ts\":").Append(ts.ToString());
            if (x1) sb.Append(",\"x1\":1");
            if (x2) sb.Append(",\"x2\":1");
            sb.Append('}');
            return sb.ToString();
        }

        static string MakeInitJson(bool ok, string error)
        {
            var sb = new StringBuilder(96);
            sb.Append("{\"_bridgeInit\":").Append(ok ? "true" : "false");
            sb.Append(",\"ts\":").Append(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString());
            if (!string.IsNullOrEmpty(error))
            {
                sb.Append(",\"error\":\"");
                sb.Append(error.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " "));
                sb.Append('"');
            }
            sb.Append('}');
            return sb.ToString();
        }

        // Write one JSON event line to the event file.
        // The plugin polls this file every 100ms via _checkXButtonEvent().
        // We intentionally do NOT write to stdout because:
        // 1. The stdout pipe may not be read (Subprocess pipe.available is a getter,
        //    not a function, which breaks the addon.js guard condition).
        // 2. Writing to a full pipe inside a WH_MOUSE_LL hook callback blocks the
        //    hook thread, causing Windows to remove the hook — deadlocking the
        //    entire bridge.
        static void EmitEvent(int xbutton)
        {
            if (string.IsNullOrEmpty(_eventFile)) return;
            string json = MakeJson(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), xbutton == 1, xbutton == 2);
            try
            {
                File.WriteAllText(_eventFile, json, new UTF8Encoding(false));
            }
            catch { /* file locked; ignore */ }
        }

        static void EmitInit(bool ok, string error)
        {
            if (string.IsNullOrEmpty(_eventFile)) return;
            string json = MakeInitJson(ok, error);
            try
            {
                File.WriteAllText(_eventFile, json, new UTF8Encoding(false));
            }
            catch { }
        }

        // ==================== Hook callback ====================

        static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int msg = wParam.ToInt32();
                if (msg == WM_XBUTTONDOWN)
                {
                    try
                    {
                        MSLLHOOKSTRUCT ms = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
                        uint hiWord = (ms.mouseData >> 16) & 0xFFFF;
                        int xbutton = 0;
                        if (hiWord == XBUTTON1) xbutton = 1;
                        else if (hiWord == XBUTTON2) xbutton = 2;

                        if (xbutton > 0)
                        {
                            EmitEvent(xbutton);
                            // Block the event: prevents back/forward navigation
                            // in the browser layer AND stops the click through.
                            return (IntPtr)1;
                        }
                    }
                    catch { /* never throw out of a hook */ }
                }
            }
            return CallNextHookEx(_hookId, nCode, wParam, lParam);
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
                    _hookInstalled = false;
                }
            }
        }

        // ==================== Parent process watcher ====================

        static void ParentWatcher()
        {
            while (_running)
            {
                try
                {
                    System.Threading.Thread.Sleep(3000);
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
            }

            _mainThreadId = GetCurrentThreadId();
            try { SetConsoleCtrlHandler(OnConsoleCtrl, true); } catch { }
            try { Console.OutputEncoding = Encoding.UTF8; } catch { } // may throw when stdout is redirected/no console

            // ---- install the low-level mouse hook ----
            _hookProc = HookCallback;
            IntPtr hMod = IntPtr.Zero;
            try
            {
                Process cur = Process.GetCurrentProcess();
                if (cur != null && cur.MainModule != null)
                {
                    hMod = GetModuleHandle(cur.MainModule.ModuleName);
                }
            }
            catch { }

            try
            {
                _hookId = SetWindowsHookEx(WH_MOUSE_LL, _hookProc, hMod, 0);
            }
            catch (Exception ex)
            {
                _hookId = IntPtr.Zero;
                EmitInit(false, "SetWindowsHookEx threw: " + ex.Message);
                return 1;
            }

            if (_hookId == IntPtr.Zero)
            {
                int err = Marshal.GetLastWin32Error();
                EmitInit(false, "SetWindowsHookEx failed (Win32 error " + err + ")");
                return 1;
            }

            lock (_sync) { _hookInstalled = true; }

            EmitInit(true, "");

            // ---- parent watcher thread ----
            if (_parentPid > 0)
            {
                System.Threading.Thread watcher = new System.Threading.Thread(ParentWatcher);
                watcher.IsBackground = true;
                watcher.Start();
            }

            // ---- message pump (REQUIRED for WH_MOUSE_LL) ----
            MSG msg;
            while (_running && GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
            {
                // hook callbacks are dispatched by the OS inside GetMessage
                // no TranslateMessage/DispatchMessage needed for LL hooks
            }

            // ---- cleanup ----
            CleanupHook();

            return 0;
        }
    }
}