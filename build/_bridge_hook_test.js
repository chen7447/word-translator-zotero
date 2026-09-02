// 一次性自检：验证 xbutton-bridge.js 的 PowerShell 内存加载命令构造正确（重点是转义）。
// 跑法：node build/_bridge_hook_test.js   （GOOD 路径会真装 ~3s 全局钩子，父进程 pid 用不存在的 999999 令其自动退出）
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const d = fs.mkdtempSync(path.join(os.tmpdir(), "wt-hook-test-"));
const cs = path.join(d, "bridge-hook.cs");
fs.copyFileSync(path.join(__dirname, "addon", "content", "scripts", "bridge-hook.cs"), cs);
const bad = path.join(d, "bad.cs");
fs.writeFileSync(bad, "this is not valid C# @@@ class {{{", "utf8");

function buildPsCommand(csPath, eventFile, zoteroPid) {
  // ---- 与 xbutton-bridge.js 中的构造保持逐字一致 ----
  const evtQ = String(eventFile).replace(/'/g, "''");
  const csQ = String(csPath).replace(/'/g, "''");
  const psCommand =
    "$ErrorActionPreference='Stop';" +
    "try { Add-Type -TypeDefinition (Get-Content -LiteralPath '" + csQ + "' -Raw) } catch {" +
    " $e = $_.Exception.Message -replace '[\\r\\n\"\\\\]',' ';" +
    " try { [IO.File]::WriteAllText('" + evtQ + "', ('{\"_bridgeInit\":false,\"error\":\"CS compile: ' + $e + '\"}'), (New-Object System.Text.UTF8Encoding($false))) } catch {};" +
    " exit 1 };" +
    "try { [WordTranslatorBridge.Program]::Run(@('-EventFile','" + evtQ + "','-ParentPid','" + String(zoteroPid) + "')) | Out-Null } catch { exit 2 }";
  // ---------------------------------------------------
  return psCommand;
}

function run(label, csPath, expectInit) {
  const evt = path.join(d, label + ".json");
  let status = 0;
  try {
    execFileSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", buildPsCommand(csPath, evt, "999999")],
      { stdio: "inherit" });
  } catch (e) { status = (e && e.status != null) ? e.status : -1; }
  let raw = "";
  try { raw = fs.readFileSync(evt, "utf8"); } catch (e) {}
  let o = null;
  try { o = JSON.parse(raw); } catch (e) {}
  const ok =
    o && o._bridgeInit === expectInit && raw.charCodeAt(0) !== 0xFEFF /* 无 BOM */ &&
    (expectInit === true ? status === 0 : status !== 0);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}: exit=${status} parsed=${o ? "_bridgeInit=" + o._bridgeInit : "NO-JSON/UNPARSEABLE"}`);
  return ok;
}

const r1 = run("good", cs, true);    // 编译+装钩子成功 → _bridgeInit:true，进程自动退出 0
const r2 = run("bad", bad, false);   // 语法错 → catch 写 _bridgeInit:false 且 JSON 可被 JSON.parse
try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
console.log(r1 && r2 ? "ALL PASS" : "FAILURES PRESENT");
process.exit(r1 && r2 ? 0 : 1);
