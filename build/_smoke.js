// 冒烟测试骨架（v6.14 优化 Phase 0 建立）
// 运行：node build/_smoke.js；退出码 0 = 通过。
// 约定：每个修复/功能 Phase 向本文件追加回归 section（新增，不改既有断言）。
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const base = path.join(__dirname, "addon");
const readAddon = (rel) => fs.readFileSync(path.join(base, rel), "utf8");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (detail ? "  -> " + detail : "")); }
}
function section(title) { console.log("\n===== " + title + " ====="); }

(async () => {
  // ============================================================
  // S1 主模块加载骨架：按 bootstrap.js 的顺序加载
  //    storage.js → config-schema.js → dict.js → addon.js
  // ============================================================
  section("S1 主模块加载（bootstrap 顺序）");
  function makeMainSandbox() {
    const sandbox = {
      console,
      setTimeout, clearTimeout,
      Zotero: {
        debug: function () {},
        Prefs: { get: () => null, set: () => {}, clear: () => {} },
        HTTP: { request: () => Promise.resolve({ status: 200, response: {} }) },
        Notifier: { trigger: () => Promise.resolve(), registerObserver: () => "id", unregisterObserver: () => {} },
        Reader: { registerEventListener: () => {}, unregisterEventListener: () => {}, _readers: [] },
        ItemPaneManager: { registerSection: () => "key", unregisterSection: () => {} },
        PreferencePanes: { register: () => {}, unregister: () => {} },
        Profile: { dir: null },
        getMainWindow: () => null,
        initializationPromise: Promise.resolve(),
        WordTranslator: null,
        WordTranslatorStorage: null,
        WordTranslatorDict: null,
        Utilities: {},
      },
      Services: {
        scriptloader: {},
        io: {},
        appinfo: { processID: 1 },
        prefs: { setStringPref: () => {}, getStringPref: () => "" },
      },
      Components: { classes: {}, interfaces: {}, isSuccessCode: () => true },
      ChromeUtils: {},
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    return sandbox;
  }

  const mainSb = makeMainSandbox();
  const LOAD_ORDER = [
    "content/scripts/storage.js",
    "content/scripts/config-schema.js",
    "content/scripts/dict.js",
    "content/scripts/addon.js",
  ];
  let loadError = null;
  try {
    for (const rel of LOAD_ORDER) {
      vm.runInContext(readAddon(rel), mainSb, { filename: rel });
    }
  } catch (e) { loadError = e; }
  check("四模块按 bootstrap 顺序加载无异常", loadError === null, loadError && (loadError.stack || loadError.message));

  const Z = mainSb.Zotero;
  check("Zotero.WordTranslatorStorage 导出", !!(Z.WordTranslatorStorage && typeof Z.WordTranslatorStorage.loadApiConfig === "function"));
  check("Zotero.WordTranslatorConfig 导出", !!(Z.WordTranslatorConfig && typeof Z.WordTranslatorConfig.normalize === "function"));
  check("Zotero.WordTranslatorDict 导出", !!(Z.WordTranslatorDict && typeof Z.WordTranslatorDict.lookup === "function"));

  const WT = Z.WordTranslator;
  check("Zotero.WordTranslator 导出", !!WT);
  if (WT) {
    const need = [
      "init", "shutdown", "translate", "testApi", "checkForUpdates",
      "getActiveApi", "_normalize", "_addWordForReader", "_renderPaneBody",
      "_bindHotkeyResetListener", "_bindHotkeyModifierListener",
      "_refreshPrefsFromStorage", "_applyWordBookView", "_speakWord",
      "_startXButtonBridge", "_stopXButtonBridge",
    ];
    for (const m of need) check("addon 方法存在: " + m, typeof WT[m] === "function");
    // vm 上下文里的 Map 与宿主 realm 不同，instanceof 判定会误报，改用 toStringTag
    const isMap = (x) => Object.prototype.toString.call(x) === "[object Map]";
    check("addon 嵌套注册表存在",
      isMap(WT._translateAdapters) && !!WT._speakRegistry && isMap(WT._wordBookSearchStrategies));
  }
  check("storage 关键方法齐全", !!(Z.WordTranslatorStorage && [
    "loadApiConfig", "saveApiConfig", "getApiConfigMtime", "saveWordsForItem",
    "saveWordsForItemDebounced", "flushAll", "loadDictCache", "saveDictCache",
  ].every((m) => typeof Z.WordTranslatorStorage[m] === "function")));
  check("dict 关键方法齐全", !!(Z.WordTranslatorDict && [
    "lookup", "getCached", "loadCache", "flush", "_chain",
  ].every((m) => typeof Z.WordTranslatorDict[m] === "function")));

  // ============================================================
  // S2 config-schema：单源默认值 + normalize 幂等
  // ============================================================
  section("S2 config-schema normalize");
  const CFG = Z.WordTranslatorConfig;
  try {
    const d = CFG.normalize(null);
    check("normalize(null) 用默认值",
      d.enabled === true && d.pageSize === 10 && d.sortMode === "reverse" &&
      d.dictProvider === "auto" && d.ttsEngine === "system" && d.defaultHighlight === "amber");
    const raw = {
      apis: [{ name: "x", provider: "openai", apiKey: "k" }],
      activeApiIndex: 0,
      pageSize: "abc",
      hotkeyModifier: "alt+shift",
      addWordHotkeyMode: "mouse4",
      dictDisplayMode: "xyz",
      ttsEngine: "bogus",
      defaultHighlight: "pink",
    };
    const once = CFG.normalize(raw);
    const twice = CFG.normalize(JSON.parse(JSON.stringify(once)));
    check("normalize 幂等", JSON.stringify(once) === JSON.stringify(twice));
    check("非法值回填默认",
      once.pageSize === 10 && once.hotkeyModifier === "ctrl" &&
      once.addWordHotkeyMode === "ctrl" && once.dictDisplayMode === "he" &&
      once.ttsEngine === "system" && once.defaultHighlight === "amber");
  } catch (e) {
    check("S2 执行无异常", false, e && (e.stack || e.message));
  }

  // ============================================================
  // S3 dict 离线 ecdict 适配器 + 词形回退（独立沙箱，桩掉网络）
  // ============================================================
  section("S3 dict 离线查询（ecdict）");
  try {
    const dictSb = {
      addonRoot: "chrome://testaddon/",
      console,
      fetch: async (url) => {
        const rel = url.replace("chrome://testaddon/", "");
        const text = fs.readFileSync(path.join(base, rel), "utf8");
        return { ok: true, json: async () => JSON.parse(text) };
      },
      Zotero: {
        WordTranslatorStorage: {
          loadApiConfig: () => ({ dictEnabled: true, dictProvider: "auto" }),
          loadDictCache: () => ({}),
          saveDictCache: () => true,
        },
      },
      setTimeout, clearTimeout,
    };
    dictSb.window = dictSb;
    vm.createContext(dictSb);
    vm.runInContext(readAddon("content/scripts/dict.js"), dictSb, { filename: "dict.js" });
    const D = dictSb.WordTranslatorDict;

    const e1 = await D.lookup("the");                 // 离线命中（高频词）
    check("lookup('the') offline hit", !!e1 && e1.meanings.length > 0 && !!e1.phonetic.us);

    const e2 = await D.lookup("studies");             // 词形回退 → study
    check("lookup('studies') variant->study hit", !!e2 && !!D.getCached("studies"));

    const e3 = await D.lookup("zzzqqq");              // 未命中 → null
    check("lookup miss returns null", e3 === null);

    const e4 = await D.lookup("analysis");            // 命中后同步读缓存
    check("lookup('analysis') hit", !!e4);
    const c = D.getCached("analysis");
    check("getCached('analysis')", !!c && c.meanings[0].def.includes("分析"));

    check("cache stable", D.getCached("the") === D.getCached("the"));
  } catch (e) {
    check("S3 执行无异常", false, e && (e.stack || e.message));
  }

  // ============================================================
  // S4 热键 reset 监听注册与语义（Phase 1 回归）
  // 历史 bug：_bindHotkeyResetListener 因编辑事故从未注册成功，
  // 但窗口已被先标记“已绑定”，监听永不重建。
  // ============================================================
  section("S4 热键 reset 监听（Phase 1 回归）");
  if (WT) {
    try {
      const makeWin = () => {
        const calls = [];
        return {
          calls,
          addEventListener(type, fn, cap) { calls.push({ type, fn, cap }); },
          removeEventListener() {},
        };
      };
      const H = WT._hotkeyResetHandlers = new Map();

      // 1) main-window：注册 blur/pagehide/deactivate 三个监听
      const w1 = makeWin();
      WT._bindHotkeyResetListener(w1, "main-window");
      check("main-window 注册 3 个监听",
        w1.calls.length === 3 && w1.calls.map((c) => c.type).join(",") === "blur,pagehide,deactivate");
      check("注册成功后才标记已绑定", w1.__wordTranslatorHotkeyResetBound === true && H.get(w1).length === 3);

      // 2) blur → 清空会话与 keyState
      WT._selectionTranslateKeyState = null;
      WT._selectionTranslateSession = { active: true, mouseDown: false, selectionReady: false, popupContext: null };
      H.get(w1)[0].handler();
      check("main-window blur 清空会话", WT._selectionTranslateSession === null && WT._selectionTranslateKeyState === null);

      // 3) 连续划词保护：keyState 活跃且近期 → blur 不清
      WT._selectionTranslateKeyState = { active: true, time: Date.now() };
      WT._selectionTranslateSession = { active: true, mouseDown: false, selectionReady: false, popupContext: null };
      H.get(w1)[0].handler();
      check("keyState 活跃+近期时 blur 不清（连续划词保护）", !!(WT._selectionTranslateSession && WT._selectionTranslateSession.active));

      // 4) deactivate + 进行中会话 → 保留
      WT._selectionTranslateKeyState = null;
      WT._selectionTranslateSession = { active: true, mouseDown: true, selectionReady: false, popupContext: null };
      H.get(w1)[2].handler();
      check("deactivate 有 pending 会话时保留", !!(WT._selectionTranslateSession && WT._selectionTranslateSession.active));

      // 5) deactivate 无 pending → 清空
      WT._selectionTranslateSession = { active: true, mouseDown: false, selectionReady: false, popupContext: null };
      H.get(w1)[2].handler();
      check("deactivate 无 pending 时清空", WT._selectionTranslateSession === null);

      // 6) reader-window：不注册 deactivate；blur + pending 选区 → 保留
      const w2 = makeWin();
      WT._bindHotkeyResetListener(w2, "reader-window");
      check("reader-window 只注册 blur/pagehide",
        w2.calls.length === 2 && w2.calls.map((c) => c.type).join(",") === "blur,pagehide");
      WT._selectionTranslateSession = { active: true, mouseDown: false, selectionReady: true, popupContext: { text: "w" } };
      H.get(w2)[0].handler();
      check("reader blur 有 pending 选区时保留", !!(WT._selectionTranslateSession && WT._selectionTranslateSession.active));

      // 7) reader blur 无 pending 无 keyState → 清空
      WT._selectionTranslateSession = { active: true, mouseDown: false, selectionReady: false, popupContext: null };
      H.get(w2)[0].handler();
      check("reader blur 无 pending 无 keyState 时清空", WT._selectionTranslateSession === null);

      // 8) 注册抛错时不标记“已绑定”，允许下次重试
      const w3 = { addEventListener() { throw new Error("boom"); }, removeEventListener() {} };
      WT._bindHotkeyResetListener(w3, "main-window");
      check("注册失败不标记已绑定", !w3.__wordTranslatorHotkeyResetBound);
    } catch (e) {
      check("S4 执行无异常", false, e && (e.stack || e.message));
    }
  }

  console.log("\nRESULT pass=%d fail=%d", pass, fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(1); });
