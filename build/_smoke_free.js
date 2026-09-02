// 免费直连功能自检：链调度、注入逻辑、目录完整性（纯逻辑层，无网络请求）
"use strict";
const path = "F:/zotero插件/单词翻译/build/addon/content/scripts/";
const fs = require("fs");

// --- config-schema 注入逻辑 ---
const src = fs.readFileSync(path + "config-schema.js", "utf8");
const sandbox = {};
new Function("Zotero", src.replace(/^"use strict";/, ""))(sandbox.Zotero = {});
const C = sandbox.Zotero.WordTranslatorConfig || (typeof WordTranslatorConfig !== "undefined" ? WordTranslatorConfig : null);
// new Function 内的 var 不落在 sandbox 上，改用返回值捕获：重新执行并显式 return
const C2 = new Function(src + "\nreturn WordTranslatorConfig;")();
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; } else { fail++; console.log("FAIL: " + name); } }

// 1) 全新安装（raw=null）→ 注入免费直连且默认
const fresh = C2.normalize(null);
ok(Array.isArray(fresh.apis) && fresh.apis.length === 1, "fresh: apis=[1]");
ok(fresh.apis[0].provider === "free" && fresh.activeApiIndex === 0, "fresh: provider=free, idx=0");
// 2) 旧用户（apis 已存在）→ 不动
const existing = C2.normalize({ apis: [{ name: "x", provider: "openai", baseUrl: "", apiKey: "k", model: "m" }], activeApiIndex: 0 });
ok(existing.apis.length === 1 && existing.apis[0].provider === "openai", "existing: untouched");
// 3) 用户删光（apis=[]）→ 尊重，不注入
const emptied = C2.normalize({ apis: [], activeApiIndex: 0 });
ok(emptied.apis.length === 0, "emptied: respected");
// 4) deeplx 过滤仍生效
const legacy = C2.normalize({ apis: [{ provider: "deeplx" }, { provider: "free" }], activeApiIndex: 1 });
ok(legacy.apis.length === 1 && legacy.apis[0].provider === "free", "deeplx filtered");

// --- translate.js 链逻辑 ---
const tsrc = fs.readFileSync(path + "translate.js", "utf8");
const t = new Function(tsrc + "\nreturn { get chain() { return _FREE_CHAIN; }, get idx() { return _freeChainIndex; }, set idx(v) { _freeChainIndex = v; } };")();
ok(Array.isArray(t.chain) && t.chain.length === 5, "chain: 5 hops");
ok(t.chain.map((h) => h.provider).join() === "bing,tencenttransmart,youdao-free,google,mymemory", "chain: order");

// --- preferences.js 目录完整性 ---
const psrc = fs.readFileSync(path.replace(/\//g, "\\") + "..\\preferences.js", "utf8");
const m = psrc.match(/const PROVIDER_CATALOG = (\[[\s\S]*?\n  \]);/);
ok(!!m, "catalog: extracted");
const catalog = new Function("return " + m[1])();
const opts = {};
for (const g of catalog) for (const o of g.options) opts[o.value] = o;
ok(opts.free && opts.bing && opts.tencenttransmart && opts["youdao-free"], "catalog: new providers present");
ok(opts.free.noCredentials && opts.free.managedConfig && opts.free.requiresModel === false, "free: no-cred managed flags");
const groups = catalog.map((g) => g.group);
ok(groups[0] === "免费翻译", "catalog: 免费翻译 first");
ok(groups.indexOf("免费翻译") !== groups.lastIndexOf("免费翻译") ? false : true, "catalog: no duplicate group");
// 注册表 provider 与目录一致（除 free 走链、mtranserver 未接入）
const reg = tsrc.match(/_translateAdapters: new Map\(\[([\s\S]*?)\]\)/)[1];
for (const p of ["bing", "tencenttransmart", "youdao-free", "free"]) {
  ok(new RegExp("\\[\"" + p + "\",").test(reg), "registry has " + p);
}

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
