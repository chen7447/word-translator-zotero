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
    // Phase 5 拆分模块：与 bootstrap.js 加载顺序一致
    "content/scripts/hotkey.js",
    "content/scripts/xbutton-bridge.js",
    "content/scripts/wordbook-pane.js",
    "content/scripts/translate.js",
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

  // Phase 5 拆分校验：成员集合与拆分前基线完全一致（纯移动，无增无减）
  try {
    const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "_wt_keys_baseline.json"), "utf8"));
    const now = Object.keys(WT).sort();
    check("成员集合与拆分基线一致", JSON.stringify(now) === JSON.stringify(baseline),
      "diff: " + now.filter((k) => !baseline.includes(k)).concat(baseline.filter((k) => !now.includes(k))).join(","));
  } catch (e) {
    check("成员集合基线校验", false, e && e.message);
  }

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

    // 排序回归（b16）：离线轮先查变体；网络源只查原词，断网不再按变体烧超时
    {
      const calls = [];
      const save = {};
      for (const n of ["ecdict", "youdao", "freedict"]) {
        save[n] = D._providers[n];
        D._providers[n] = async (w) => { calls.push(n + ":" + w); return await save[n](w); };
      }
      delete D._cache["studies"];
      const e5 = await D.lookup("studies");
      check("离线变体命中零网络调用", !!e5 && !calls.some((c) => /^(youdao|freedict):/.test(c)));
      calls.length = 0;
      const e6 = await D.lookup("finges"); // 全链未命中：网络源各查一次且只查原词
      const net = calls.filter((c) => !c.startsWith("ecdict:"));
      check("网络源只查原词不烧变体", e6 === null && net.length === 2 && net.includes("youdao:finges") && net.includes("freedict:finges"));
      // exchange 屈折反查表：不规则变形（去后缀猜不出）离线命中
      for (const [inf, gloss] of [["ran", "跑"], ["children", "孩子"], ["went", "去"]]) {
        calls.length = 0;
        const e = await D.lookup(inf);
        check("屈折反查 " + inf + " 离线命中", !!e && (e.meanings[0].def || "").includes(gloss) && !calls.some((c) => /^(youdao|freedict):/.test(c)));
      }
      for (const n of ["ecdict", "youdao", "freedict"]) D._providers[n] = save[n];
    }
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

  // ============================================================
  // S5 翻译链路（Phase 2 回归）：提示词构造 / SSE 解析 / pending 状态
  // ============================================================
  section("S5 翻译链路（Phase 2 回归）");
  if (WT) {
    try {
      const savedData = WT._data;
      const savedTranslate = WT._translateWithTimeout;

      // a) _buildPromptParts：split / combined 两模式
      WT._data = WT._normalize({ promptMode: "split", promptSystem: "SYS", promptUser: "U {{word}}", promptGlobal: "G {{word}}" });
      const p1 = WT._buildPromptParts("cat");
      check("prompt split 模式", p1.system === "SYS" && p1.user === "U cat");
      WT._data = WT._normalize({ promptMode: "combined", promptGlobal: "G {{word}}" });
      const p2 = WT._buildPromptParts("cat");
      check("prompt combined 模式", p2.system === "" && p2.user === "G cat");
      // 缺省时回落 config-schema 默认提示词（不再返回空 system）
      WT._data = WT._normalize(null);
      const p3 = WT._buildPromptParts("cat");
      check("prompt 缺省回落 DEFAULTS", p3.system.length > 10 && p3.user.includes("cat"));

      // b) _parseSSEChunk：单 chunk 多事件 / 跨 chunk 行缓冲 / 残行留缓冲
      const r1 = WT._parseSSEChunk("", 'data: {"a":1}\n\ndata: [DONE]\n\n');
      check("SSE 单 chunk 多事件", r1.events.length === 2 && r1.events[0] === '{"a":1}' && r1.events[1] === "[DONE]" && r1.rest === "");
      const r2 = WT._parseSSEChunk('data: {"cho', 'ices": {"delta": {"content": "hi"}}}\n');
      check("SSE 跨 chunk 行缓冲拼齐", r2.events.length === 1 && JSON.parse(r2.events[0]).choices.delta.content === "hi");
      const r3 = WT._parseSSEChunk("data: partial", "");
      check("SSE 残行留缓冲", r3.events.length === 0 && r3.rest === "data: partial");

      // c) pending 状态布尔化：失败卡重复划词 → 重新翻译；已译卡 → 跳过 API
      WT._data = WT._normalize({ apis: [] });
      WT._itemWords = new Map();
      let translateCalls = 0;
      WT._translateWithTimeout = function () { translateCalls++; return Promise.reject(new Error("no api")); };
      const reader = { itemID: 987654 };
      await WT._addWordForReader(reader, "smokeword");
      check("首次划词调用翻译一次", translateCalls === 1);
      await WT._addWordForReader(reader, "smokeword");
      check("失败卡重复划词触发重译（旧版因字符串误判会跳过）", translateCalls === 2);
      const cardList = WT._itemWords.get(987654) || [];
      check("失败卡仍单张且标记失败", cardList.length === 1 && cardList[0].translation === WT.STATUS_FAILED && cardList[0].pending === false);
      cardList[0].translation = "真实译文";
      cardList[0].pending = false;
      await WT._addWordForReader(reader, "smokeword");
      check("已译卡重复划词跳过 API", translateCalls === 2);
      check("状态常量存在", WT.STATUS_TRANSLATING === "翻译中…" && WT.STATUS_FAILED === "翻译失败");

      // d) translate() 流式端到端（fetch 桩返回真实 SSE 分包，含跨包劈开场景）
      WT._data = WT._normalize({ apis: [{ name: "t", provider: "custom", apiKey: "k", model: "m", baseUrl: "https://example.invalid/v1" }] });
      mainSb.TextDecoder = TextDecoder;
      const enc = new TextEncoder();
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n',
      ];
      mainSb.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => "",
        body: {
          getReader: () => ({
            read: async () => (sseChunks.length
              ? { done: false, value: enc.encode(sseChunks.shift()) }
              : { done: true, value: undefined }),
          }),
        },
      });
      let lastPartial = "";
      const streamResult = await WT.translate("hi", null, (acc) => { lastPartial = acc; });
      check("流式端到端（fetch 桩）", streamResult === "你好" && lastPartial === "你好");

      // e) 无 fetch 环境：回退非流式请求，完整结果一次性回调（onChunk 契约不破）
      delete mainSb.fetch;
      const savedRequest = mainSb.Zotero.HTTP.request;
      mainSb.Zotero.HTTP.request = () => Promise.resolve({ status: 200, response: { choices: [{ message: { content: "完整译文" } }] } });
      let fallbackPartial = "";
      const fbResult = await WT.translate("hi", null, (acc) => { fallbackPartial = acc; });
      check("无 fetch 回退非流式并单次回调", fbResult === "完整译文" && fallbackPartial === "完整译文");
      mainSb.Zotero.HTTP.request = savedRequest;

      // 还原，避免影响后续 section
      WT._translateWithTimeout = savedTranslate;
      WT._data = savedData;
    } catch (e) {
      check("S5 执行无异常", false, e && (e.stack || e.message));
    }
  }

  // ============================================================
  // S6 渲染 body 解析（Phase 2.6 回归）：陈旧 body 防护
  // 历史 bug：插件重载后旧 body 仍连接，渲染/刷新全部写进不可见旧 body，
  // 表现为"保存成功但面板不显示、刷新无反应、重启恢复"。
  // ============================================================
  section("S6 渲染 body 解析（Phase 2.6 回归）");
  if (WT) {
    try {
      const mkBody = (uid, connected) => ({ dataset: { wtPaneUid: uid }, isConnected: connected });
      WT._latestPaneUID = "NEW";
      const docFake = { querySelectorAll: () => [mkBody("OLD", true), mkBody("NEW", true)] };
      const b1 = WT._resolvePaneBody(docFake, mkBody("OLD", true));
      check("陈旧 context body 切换到最新 uid", b1 && b1.dataset.wtPaneUid === "NEW");
      const b2 = WT._resolvePaneBody(docFake, mkBody("NEW", true));
      check("最新 body 保持不变", b2 && b2.dataset.wtPaneUid === "NEW");
      const b3 = WT._resolvePaneBody(docFake, mkBody("OLD", false));
      check("context 断连时选最新", b3 && b3.dataset.wtPaneUid === "NEW");

      WT._latestPaneUID = null;
      const doc2 = { querySelectorAll: () => [mkBody("ONLY", true)] };
      const b4 = WT._resolvePaneBody(doc2, mkBody("OTHER", false));
      check("无 latest 时回退第一个连接 body", b4 && b4.dataset.wtPaneUid === "ONLY");
      const b5 = WT._resolvePaneBody(null, mkBody("X", false));
      check("全不可用时返回 null", b5 === null);

      // 单 body 正常路径：context body 直接使用（不产生切换日志）
      WT._latestPaneUID = "SAME";
      const doc3 = { querySelectorAll: () => [mkBody("SAME", true)] };
      const b6 = WT._resolvePaneBody(doc3, mkBody("SAME", true));
      check("单 body 正常路径", b6 && b6.dataset.wtPaneUid === "SAME");
      WT._latestPaneUID = null;
    } catch (e) {
      check("S6 执行无异常", false, e && (e.stack || e.message));
    }
  }

  // ============================================================
  // S7 存储与生命周期（Phase 3 回归）：防抖/flush 语义 + 条目删除清理
  // 历史 bug：flushAll 只取消定时器不落盘（名为 flush 实为 cancel）；
  // 无 Notifier 观察者，条目删除后 words/<id>.json 孤儿文件永久堆积。
  // ============================================================
  section("S7 storage 防抖与 flush（Phase 3 回归）");
  try {
    const stSb = {
      console,
      setTimeout, clearTimeout,
      Zotero: { debug: () => {}, Profile: { dir: null } },
      Components: { classes: {}, interfaces: {} },
    };
    stSb.window = stSb;
    vm.createContext(stSb);
    vm.runInContext(readAddon("content/scripts/storage.js"), stSb, { filename: "storage.js" });
    const ST = stSb.WordTranslatorStorage;

    const saved = [];
    ST.saveWordsForItem = function (itemID, list) { saved.push([itemID, list]); return true; };

    ST.saveWordsForItemDebounced(1, ["a"], 30);
    ST.saveWordsForItemDebounced(1, ["a", "b"], 30);
    ST.saveWordsForItemDebounced(2, ["c"], 30);
    check("防抖待写记录 pending（同键合并）", Object.keys(ST._pendingSaves).length === 2 && ST._pendingSaves["1"].list.length === 2);
    check("防抖窗口内未落盘", saved.length === 0);

    ST.flushAll();
    check("flushAll 真正落盘并清空 pending/timers",
      saved.length === 2 && Object.keys(ST._pendingSaves).length === 0 && Object.keys(ST._timers).length === 0);
    const entry1 = saved.find((s) => s[0] === 1);
    const entry2 = saved.find((s) => s[0] === 2);
    check("flushAll 落盘内容正确", !!entry1 && entry1[1].length === 2 && !!entry2 && entry2[1].length === 1);

    saved.length = 0;
    ST.saveWordsForItemDebounced(3, ["d"], 10);
    await new Promise((r) => setTimeout(r, 60));
    check("防抖到期自动落盘并清 pending", saved.length === 1 && saved[0][0] === 3 && !ST._pendingSaves["3"]);

    saved.length = 0;
    ST.saveWordsForItemDebounced(4, ["e"], 10);
    ST.cancelPendingSave(4);
    await new Promise((r) => setTimeout(r, 40));
    check("cancelPendingSave 后不落盘", saved.length === 0 && !ST._pendingSaves["4"]);

    ST.flushAll();
    check("flushAll 空转安全", saved.length === 0);
  } catch (e) {
    check("S7 storage 执行无异常", false, e && (e.stack || e.message));
  }

  section("S7b 条目删除观察（Phase 3 回归）");
  if (WT) {
    try {
      let capturedObserver = null;
      const savedNotifier = mainSb.Zotero.Notifier;
      mainSb.Zotero.Notifier = {
        registerObserver: (obs) => { capturedObserver = obs; return "test-id"; },
        unregisterObserver: () => {},
        trigger: () => Promise.resolve(),
      };
      const deletedFiles = [];
      const savedStorage = mainSb.Zotero.WordTranslatorStorage;
      mainSb.Zotero.WordTranslatorStorage = {
        cancelPendingSave: () => {},
        saveWordsForItem: (id, list) => { if (!list || !list.length) deletedFiles.push(id); return true; },
      };

      WT._notifierID = null;
      WT.registerItemNotifier();
      check("notifier 注册成功且捕获 observer", WT._notifierID === "test-id" && !!capturedObserver);

      WT._itemWords = new Map([[777, [{ word: "x", translation: "y", pending: false }]]]);
      capturedObserver.notify("delete", "item", [777]);
      check("delete 事件清理内存并删文件", !WT._itemWords.has(777) && deletedFiles.includes(777));

      WT._itemWords.set(777, [{ word: "x", translation: "y", pending: false }]);
      capturedObserver.notify("trash", "item", [777]);
      check("trash 事件不清理（回收站可恢复）", WT._itemWords.has(777));
      capturedObserver.notify("delete", "search", [777]);
      check("非 item 类型忽略", WT._itemWords.has(777));
      capturedObserver.notify("delete", "item", [999888]);
      check("无关条目 id 忽略", WT._itemWords.has(777));

      WT._itemWords.delete(777);
      mainSb.Zotero.Notifier = savedNotifier;
      mainSb.Zotero.WordTranslatorStorage = savedStorage;
    } catch (e) {
      check("S7b 执行无异常", false, e && (e.stack || e.message));
    }
  }

  // ============================================================
  // S8 单词本局部重绘（Phase 6 回归）：迷你假 DOM 验证列表重绘、
  // 翻页控件同步、快/慢路径分派（快路径不触发全量 pane 刷新）。
  // ============================================================
  section("S8 单词本局部重绘（Phase 6 回归）");
  if (WT) {
    try {
      const mkEl = (tag) => ({
        tag, className: "", style: {}, attrs: {}, children: [], textContent: "",
        append(...cs) { for (const c of cs) this.children.push(c); },
        replaceChildren() { this.children = []; },
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; },
        addEventListener() {},
      });
      const docFake = {
        // defaultView：真实 document 必有，快路径据此判定 doc 有效
        defaultView: {},
        createElementNS: (ns, tag) => mkEl(tag),
        createTextNode: (s) => ({ text: String(s) }),
        querySelectorAll: () => [],
      };
      const list = mkEl("#list");
      const controls = { prev: mkEl("#prev"), next: mkEl("#next"), input: mkEl("#input"), total: mkEl("#total") };
      const bodyFake = {
        isConnected: true,
        dataset: { wtPaneUid: "U1", chromeItemID: "555" },
        replaceChildren() {},
        querySelector: (sel) => sel === ".wordtranslator-pane-list" ? list
          : sel === ".wt-page-prev" ? controls.prev
          : sel === ".wt-page-next" ? controls.next
          : sel === ".wt-page-input" ? controls.input
          : sel === ".wt-page-total" ? controls.total : null,
      };
      const rawWords = [];
      for (let i = 0; i < 25; i++) rawWords.push({ word: "w" + i, translation: "t" + i, pending: false });
      WT._itemWords = new Map();
      WT._itemWords.set(555, rawWords);
      WT._wordBookViewState.set(555, { page: 1, search: "" });
      const savedData8 = WT._data;
      WT._data = WT._normalize(null);

      // 1) 列表局部重绘：卡片数量与分页一致，翻页控件同步
      const ok1 = WT._renderCardList(docFake, bodyFake, 555, rawWords, { indices: [24, 23, 22, 21, 20, 19, 18, 17, 16, 15], page: 3, pageCount: 3, total: 25 });
      check("列表局部重绘返回 true", ok1 === true);
      check("渲染卡片数 = indices 数", list.children.length === 10);
      check("页码/总页控件同步", controls.input.value === "3" && controls.total.textContent === " / 3");
      // 第 3 页/共 3 页：下页禁用、上页可用
      check("翻页禁用态正确", controls.next.attrs.disabled === "disabled" && controls.prev.attrs.disabled === undefined);

      // 2) 快路径：上下文+外壳双一致 → 只重绘列表，不触发官方 pane 刷新
      const savedTrigger = mainSb.Zotero.Notifier.trigger;
      let refreshCalls = 0;
      mainSb.Zotero.Notifier.trigger = () => { refreshCalls++; return Promise.resolve(); };
      WT._paneRefresh = null;
      WT._currentPaneContext = { doc: docFake, body: bodyFake, itemID: 555, paneUID: "U1" };
      refreshCalls = 0;
      WT._applyWordBookView(555, { source: "test-fast" });
      check("快路径只重绘列表不触发全量刷新", refreshCalls === 0 && list.children.length === 10);

      // 3) forceFull：走全量刷新路径
      WT._applyWordBookView(555, { source: "test-full", forceFull: true });
      check("forceFull 走全量刷新路径", refreshCalls >= 1);

      // 4) 条目不一致 → 不走快路径（防 A 外壳渲染 B 卡片）
      refreshCalls = 0;
      WT._applyWordBookView(666, { source: "test-cross" });
      check("跨条目不走快路径", refreshCalls >= 1);

      // 5) 无外壳 → _renderCardList 返回 false
      const bodyEmpty = { isConnected: true, dataset: {}, querySelector: () => null };
      check("无外壳时返回 false",
        WT._renderCardList(docFake, bodyEmpty, 555, rawWords, { indices: [], page: 1, pageCount: 1, total: 25 }) === false);

      mainSb.Zotero.Notifier.trigger = savedTrigger;
      WT._data = savedData8;
      WT._itemWords = new Map();
    } catch (e) {
      check("S8 执行无异常", false, e && (e.stack || e.message));
    }
  }

  // ============================================================
  // S9 导出与译文缓存（Phase 7 回归）
  // ============================================================
  section("S9 导出与译文缓存（Phase 7 回归）");
  if (WT) {
    try {
      const savedData9 = WT._data;
      WT._data = WT._normalize(null);

      // 1) 译文缓存：载入/大小写归一读取/写入/flush 立即落盘
      const savedStorage9 = mainSb.Zotero.WordTranslatorStorage;
      let savedCacheObj = null;
      mainSb.Zotero.WordTranslatorStorage = {
        loadTranslationCache: () => ({ "cell": { translation: "细胞", ts: 1 } }),
        saveTranslationCache: (c) => { savedCacheObj = c; return true; },
      };
      WT._translationCache = null;
      WT._loadTranslationCache();
      check("译文缓存载入并大小写归一命中", WT._getCachedTranslation("CELL") === "细胞");
      WT._setCachedTranslation("plant", "植物");
      // 写盘是 800ms 防抖的：此刻只断言内存命中，落盘由下面的 flush 断言覆盖
      check("译文缓存写入", WT._getCachedTranslation("plant") === "植物");
      savedCacheObj = null;
      WT._flushTranslationCache();
      check("flush 立即落盘", !!savedCacheObj && !!savedCacheObj.cell);
      mainSb.Zotero.WordTranslatorStorage = savedStorage9;

      // 2) 导出数据收集：无 Zotero.Items 时标题回退
      WT._itemWords = new Map();
      WT._itemWords.set(42, [{ word: "cell", translation: "细胞", highlight: "amber" }, { word: "metabolism", translation: "新陈代谢" }]);
      const sections = WT._collectExportSections(42);
      check("收集当前条目", sections.length === 1 && sections[0].title === "条目 42" && sections[0].words.length === 2);
      check("全部条目模式", WT._collectExportSections(null).length === 1);
      WT._itemWords.set(43, [{ word: "enzyme", translation: "酶" }]);
      check("空条目跳过", WT._collectExportSections(null).length === 2);

      // 3) CSV：BOM + 表头 + 引号转义
      const csv = WT._formatExportCSV([{ id: 42, title: "论文\"A\",B", words: [{ word: "cell", translation: "细胞", highlight: "amber" }] }]);
      check("CSV 带 BOM 与表头", csv.charCodeAt(0) === 0xFEFF && csv.indexOf("word,translation,phonetic,pos,meaning,highlight,item") >= 0);
      check("CSV 字段引号转义", csv.indexOf('"论文""A"",B"') >= 0);

      // 4) Markdown / Anki tsv（多节才有 ## 分节标题）
      const md = WT._formatExportMD([
        { id: 42, title: "T", words: [{ word: "cell", translation: "细胞" }] },
        { id: 43, title: "T2", words: [{ word: "enzyme", translation: "酶" }] },
      ]);
      check("Markdown 含分节与词条", md.indexOf("## T") >= 0 && md.indexOf("**cell** -- 细胞") >= 0 && md.indexOf("## T2") >= 0);
      const anki = WT._formatExportAnki([{ id: 42, title: "T", words: [{ word: "cell\tX", translation: "细\n胞" }] }]);
      check("Anki tsv 制表/换行清洗", anki.indexOf("cell X\t细 胞") >= 0);

      // 5) 文件名清洗（连续非法字符合并为一个下划线）
      check("文件名非法字符清洗", WT._exportFileName("a/b:c*d?\"<>|") === "a_b_c_d_");

      WT._data = savedData9;
      WT._itemWords = new Map();
    } catch (e) {
      check("S9 执行无异常", false, e && (e.stack || e.message));
    }
  }

  // ============================================================
  // S10 功能 B（Phase 8 回归）：{{context}} / TTS 配置化 / 离线例句兜底
  // ============================================================
  section("S10 功能 B（Phase 8 回归）");
  if (WT) {
    try {
      const savedData10 = WT._data;
      // 1) {{context}} 三态
      WT._data = WT._normalize({ promptMode: "split", promptUser: "译 {{word}} 上下文：{{context}}", promptUseContext: true });
      const p1 = WT._buildPromptParts("cell", "The cell divides rapidly.");
      check("{{context}} 占位符替换", p1.user === "译 cell 上下文：The cell divides rapidly.");
      WT._data = WT._normalize({ promptMode: "split", promptUser: "译 {{word}}", promptUseContext: true });
      const p2 = WT._buildPromptParts("cell", "The cell divides.");
      check("无占位符时自动附加", p2.user.indexOf("译 cell") === 0 && p2.user.indexOf("该词所在上下文：The cell divides.") >= 0);
      WT._data = WT._normalize({ promptMode: "split", promptUser: "译 {{word}} 上下文：{{context}}", promptUseContext: true });
      const p3 = WT._buildPromptParts("cell", "");
      check("无上下文时占位符清空", p3.user === "译 cell 上下文：");
      WT._data = WT._normalize({ promptMode: "split", promptUser: "译 {{word}} 上下文：{{context}}", promptUseContext: false });
      const p4 = WT._buildPromptParts("cell", "The cell divides.");
      check("开关关闭时占位符清空且不带上下文", p4.user === "译 cell 上下文：");
      // 2) TTS 配置化 + normalize 回填
      WT._data = WT._normalize({ ttsApiModel: " gpt-4o-mini-tts ", ttsApiVoice: " nova " });
      check("TTS 模型/音色可配置", WT._data.ttsApiModel === "gpt-4o-mini-tts" && WT._data.ttsApiVoice === "nova");
      WT._data = WT._normalize(null);
      check("TTS 缺省 tts-1/alloy", WT._data.ttsApiModel === "tts-1" && WT._data.ttsApiVoice === "alloy" && WT._data.promptUseContext === false);

      // 3) dict 离线例句后台补抓（stub youdao 响应）
      const savedRequest = mainSb.Zotero.HTTP.request;
      let persisted = false;
      const D = mainSb.Zotero.WordTranslatorDict;
      mainSb.Zotero.HTTP.request = () => Promise.resolve({ status: 200, response: { blng_sents_part: { sents: [
        { sentence: "The cell divides.", sentence_translation: "细胞分裂。" },
        { sentence: "Each cell is small.", sentence_translation: "每个细胞很小。" },
      ] } } });
      D._cache = {};
      D._cache.cell = { entry: { word: "cell", phonetic: { us: "sel" }, meanings: [{ pos: "n", def: "细胞" }], examples: [] }, ts: 1 };
      D._schedulePersist = function () { persisted = true; };
      const beforeExamples = D._cache.cell.entry.examples.length;
      await D._fetchExamplesInBackground("cell");
      const afterExamples = D._cache.cell.entry.examples.length;
      check("离线命中补抓在线例句", beforeExamples === 0 && afterExamples === 2 && persisted === true);
      mainSb.Zotero.HTTP.request = savedRequest;

      WT._data = savedData10;
    } catch (e) {
      check("S10 执行无异常", false, e && (e.stack || e.message));
    }
  }

  console.log("\nRESULT pass=%d fail=%d", pass, fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(1); });
