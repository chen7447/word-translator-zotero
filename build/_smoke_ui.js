// UI 改版守门脚本：get()/id 一致性、服务商目录基线、结构耦合点、（改版后）tab 结构与 issue 链接
"use strict";
const fs = require("fs");
const dir = "F:/zotero插件/单词翻译/build/addon/content/";
const psrc = fs.readFileSync(dir + "preferences.js", "utf8");
const xsrc = fs.readFileSync(dir + "preferences.xhtml", "utf8");
const tsrc = fs.readFileSync(dir + "scripts/translate.js", "utf8");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log("FAIL: " + n); } };

// 1) 每个 get("id") 都有定义来源（preferences.js 的 id: 或 xhtml 静态 id）
const used = [...psrc.matchAll(/get\("([^"]+)"\)/g)].map((m) => m[1]);
const defined = new Set([...psrc.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
for (const m of xsrc.matchAll(/id="([^"]+)"/g)) defined.add(m[1]);
const missing = [...new Set(used)].filter((id) => !defined.has(id));
ok(missing.length === 0, "get() ids all defined: missing=" + missing.join(","));

// 2) 服务商目录基线：5 组 26 项，免费组第一且含 free
const catSrc = psrc.match(/const PROVIDER_CATALOG = (\[[\s\S]*?\n  \]);/);
ok(!!catSrc, "catalog extracted");
const catalog = new Function("return " + catSrc[1])();
ok(catalog.length === 5, "catalog 5 groups, got " + catalog.length);
const optCount = catalog.reduce((n, g) => n + g.options.length, 0);
ok(optCount === 26, "catalog 26 options, got " + optCount);
ok(catalog[0].group === "免费翻译", "free group first");
ok(catalog[0].options.some((o) => o.value === "free"), "free option present");

// 3) 结构耦合点仍在（setRowVisible 依赖 .wt-row 包裹；baseurl 行内 hint 同父）
ok(/closest\("\.wt-row"\)/.test(psrc) && (psrc.match(/class: "wt-row"/g) || []).length >= 20, "wt-row intact");
ok((psrc.match(/class: "wt-hint"/g) || []).length >= 15, "wt-hint intact");
const iBase = psrc.indexOf("wt-api-baseurl-row"), iKey = psrc.indexOf("wt-api-key-row"), iHint = psrc.indexOf('class: "wt-hint"', iBase);
ok(iBase > 0 && iKey > iBase && iHint > iBase && iHint < iKey, "baseurl row keeps its hint");

// 4) 改版后检查（源码出现 wt-tabs 才启用，改造前自动跳过）
if (psrc.includes("wt-tabs")) {
  ok((psrc.match(/class: "wt-tab[ ",]/g) || []).length >= 3, "3 tabs built");
  ok(/panelFanyi\.append\(sectionApis, sectionPrompt, sectionDictionary\)/.test(psrc), "fanyi panel order");
  ok(/panelHuaci\.append\(sectionGeneral, sectionTTS, sectionAppearance, sectionSearch\)/.test(psrc), "huaci panel order");
  ok(/panelData\.append\(sectionSaveDir, sectionAbout\)/.test(psrc), "data panel order");
  ok(/root\.append\(style, header, intro, tabBar, panelFanyi, panelHuaci, panelData, footer, statusBar\)/.test(psrc), "root append order + status bar last");
  ok((psrc.match(/issues"/g) || []).length >= 2, "issue links x2 in prefs page");
  ok(tsrc.includes("word-translator-zotero/issues"), "free-chain error carries issues URL");
}

console.log(pass + " passed, " + fail + " failed" + (psrc.includes("wt-tabs") ? "" : " (baseline only, tab checks skipped)"));
process.exit(fail ? 1 : 0);
