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
  // 新增功能会合法扩充成员集合：用 WT_REGEN_BASELINE=1 重新生成基线，再正常跑一遍校验。
  try {
    const baselinePath = path.join(__dirname, "_wt_keys_baseline.json");
    const now = Object.keys(WT).sort();
    if (process.env.WT_REGEN_BASELINE === "1") {
      fs.writeFileSync(baselinePath, JSON.stringify(now, null, 2) + "\n");
      check("成员集合基线已重新生成（" + now.length + " 项）", true);
    } else {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
      check("成员集合与拆分基线一致", JSON.stringify(now) === JSON.stringify(baseline),
        "diff: " + now.filter((k) => !baseline.includes(k)).concat(baseline.filter((k) => !now.includes(k))).join(","));
    }
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

  // ============================================================
  // S11 卡片「修」原地编辑（6.16.0b4）：编辑态只写本地数据，
  // 不触发翻译 API、不写译文缓存、不动词典缓存
  // ============================================================
  section("S11 卡片「修」编辑");
  if (WT) {
    try {
      // 1) 方法与状态字段存在
      check("_showCardEdit/_hideCardEdit 存在",
        typeof WT._showCardEdit === "function" && typeof WT._hideCardEdit === "function");
      check("_cardEdit 状态字段存在", "_cardEdit" in WT);
      // 2) 保存路径不触发翻译：_showCardEdit 源码不调用翻译/词典/译文缓存
      const paneSrc = readAddon("content/scripts/wordbook-pane.js");
      const editSrc = paneSrc.slice(paneSrc.indexOf("_showCardEdit(itemID, index, card, cardEl)"));
      const editBody = editSrc.slice(0, editSrc.indexOf("_retryTranslationForCard"));
      check("编辑保存不调翻译 API", editBody.indexOf("_translateWithTimeout") < 0);
      check("编辑保存不写译文缓存", editBody.indexOf("_setCachedTranslation") < 0);
      check("编辑保存不动词典", editBody.indexOf("_enrichDict") < 0);
      // 3) 菜单含「修」按钮且在 ↻/✕ 前
      const menuSrc = paneSrc.slice(paneSrc.indexOf("_showCardMenu(ev, itemID, index, card)"));
      const menuBody = menuSrc.slice(0, menuSrc.indexOf("翻译超时兜底"));
      check("卡片菜单含「修」按钮", /txt\("修"\)/.test(menuBody));
      check("菜单顺序 修→↻→✕",
        menuBody.indexOf('txt("修")') < menuBody.indexOf('txt("↻")') &&
        menuBody.indexOf('txt("↻")') < menuBody.indexOf('txt("✕")'));
      // 4) _renderCard 手势屏蔽已扩展到编辑态
      check("dblclick/contextmenu 屏蔽编辑态", /\.wt-card-edit"\)\) return/.test(paneSrc.replace(/\n/g, "")) || /\.wt-card-edit/.test(menuBody));
      // 5) _renderPaneBody/_renderCardList 清理编辑态
      check("全量重绘清理编辑态", /_renderPaneBody\(doc, body, item\) \{\s*try \{ this\._hideCardMenu\(\); \} catch \(e\) \{\}\s*try \{ this\._hideCardEdit\(\); \} catch/.test(paneSrc.replace(/\r/g, "")));
      // 6) 编辑态隐藏的 actionWrap 恢复原 display（防 flex 布局被毁）
      check("actionWrap 恢复原 display", /actionWrapDisplay \|\| ""/.test(paneSrc));
    } catch (e) {
      check("S11 执行无异常", false, e && (e.stack || e.message));
    }
  }

  // ============================================================
  // S12 侧键三形态捕获（Phase 12 回归：多媒体键/消费页通道 + 接管提醒）
  // ============================================================
  section("S12 侧键三形态捕获");
  if (WT) {
    try {
      const bridgeSrc = readAddon("content/scripts/xbutton-bridge.js");
      const csSrc = readAddon("content/scripts/bridge-hook.cs");

      // 1) 默认值：「兼容模式」默认开启（蓝牙鼠标开箱可用），且可被配置关闭
      const d12 = CFG.normalize(null);
      check("xbuttonCompat 默认开启", d12.xbuttonCompat === true);
      check("normalize 保留显式关闭", CFG.normalize({ xbuttonCompat: false }).xbuttonCompat === false);
      check("normalize 非布尔回落默认值", CFG.normalize({ xbuttonCompat: "no" }).xbuttonCompat === true);
      // 老数据迁移：原来两个开关（吞键 + 消费键）都为开 → 兼容模式开
      check("老数据迁移：两开关都开 → 兼容模式开",
        CFG.normalize({ xbuttonCompat: true }).xbuttonCompat === true);
      check("老数据迁移：任一个关 → 兼容模式关",
        CFG.normalize({ xbuttonBlockEvents: false, xbuttonConsumerKeys: true }).xbuttonCompat === false
        && CFG.normalize({ xbuttonCompat: false }).xbuttonCompat === false);

      // 2) 开关读取：兼容模式统一决定两条通道（-Block 与 -ConsumerKeys）
      WT._data = { xbuttonCompat: undefined };
      check("_xbuttonConsumerKeysFlag 默认 1", WT._xbuttonConsumerKeysFlag() === 1);
      check("_xbuttonBlockFlag 默认 1", WT._xbuttonBlockFlag() === 1);
      WT._data = { xbuttonCompat: false };
      check("兼容模式关闭 → 消费键通道 0", WT._xbuttonConsumerKeysFlag() === 0);
      check("兼容模式关闭 → 不吞键（放行）", WT._xbuttonBlockFlag() === 0);

      // 3) 指纹必须包含这两个参数：否则改了开关不重建进程，用户以为开关无效
      WT._data = { xbuttonCompat: true };
      const fpOn = WT._xbuttonBridgeFingerprint();
      WT._data = { xbuttonCompat: false };
      const fpOff = WT._xbuttonBridgeFingerprint();
      check("指纹含 consumer 且随开关变化", fpOn !== fpOff && fpOn.indexOf("consumer=1") >= 0 && fpOff.indexOf("consumer=0") >= 0);
      check("指纹含 block（与 consumer 同步变化）", fpOn.indexOf("block=1;consumer=1") >= 0 && fpOff.indexOf("block=0;consumer=0") >= 0);

      // 4) 事件来源标签可区分三形态（诊断提示要能说清是哪种侧键）
      const l1 = WT._xbuttonSrcLabel("mouse"), l2 = WT._xbuttonSrcLabel("vk"), l3 = WT._xbuttonSrcLabel("hid");
      check("src 标签三形态各不相同", l1 !== l2 && l2 !== l3 && l1 !== l3 && l1 !== undefined);
      check("src=vk 标签点明多媒体键形态", /多媒体键/.test(String(l2)));
      check("src=hid 标签点明仅检测", /仅检测|无法拦截/.test(String(l3)));

      // 5) 接管提醒的门控：兼容模式关闭（既不捕获也不吞键）时不提示
      WT._data = { xbuttonCompat: false };
      WT._xbuttonBridge.consumerNoticeShown = false;
      WT._maybeNotifyConsumerTakeover(false);
      check("兼容模式关闭时不提示接管", WT._xbuttonBridge.consumerNoticeShown === false);

      // 5b) 提示一次即记住（跨会话不重复打扰）；设置页开启时的弹窗由 prefs 负责，
      // 钩子确认时只补一次（ack 后永不重复）——保证用户开启时只看到一次弹窗
      WT._data = { xbuttonCompat: true };
      WT._maybeNotifyConsumerTakeover();
      check("兼容模式开启时提示一次", WT._xbuttonBridge.consumerNoticeShown === true);
      check("提示后写入 ack 并落盘", WT._data.xbuttonConsumerNoticeAck === true);
      WT._xbuttonBridge.consumerNoticeShown = false;
      WT._maybeNotifyConsumerTakeover();
      check("已 ack 后不再重复提示", WT._xbuttonBridge.consumerNoticeShown === false);
      check("不再有 force 二次弹窗入口（用户实测连弹两次的根源）",
        !/\.maybeNotifyConsumerTakeover\(true\)/.test(bridgeSrc));
      check("xbuttonConsumerNoticeAck 默认 false", CFG.normalize(null).xbuttonConsumerNoticeAck === false);

      // 5c) 弹窗文案唯一来源：两行短句（一行讲后果，一行讲怎么关）
      const noticeLines = WT._compatNoticeLines();
      check("兼容模式弹窗为 2 行短句", Array.isArray(noticeLines) && noticeLines.length === 2);
      check("弹窗第 1 行讲清后果", /后退\/前进.*被侧键接管|被侧键接管/.test(noticeLines[0]));
      check("弹窗第 2 行讲清可随时关闭", /随时关闭/.test(noticeLines[1]));

      // 6) 启动参数确实把 -ConsumerKeys 传给钩子进程（否则开关是摆设）
      check("PS 命令传 -ConsumerKeys", /'-ConsumerKeys','" \+ consumerFlag/.test(bridgeSrc));
      check("PS 命令传 -Block 回归", /'-Block','" \+ blockFlag/.test(bridgeSrc));

      // 7) C# 侧：三通道 + 两个开关参数都落地
      check("C# 安装低级键盘钩子(WH_KEYBOARD_LL=13)", /WH_KEYBOARD_LL = 13/.test(csSrc) && /_kbHookId = SetWindowsHookEx\(WH_KEYBOARD_LL/.test(csSrc));
      check("C# 识别 VK_BROWSER_BACK/FORWARD", /VK_BROWSER_BACK = 0xA6/.test(csSrc) && /VK_BROWSER_FORWARD = 0xA7/.test(csSrc));
      check("C# 键盘回调可吞键（返回 1）", (() => {
        // 按函数体切片断言（不依赖注释长度，中间插注释也不会误报）
        const at = csSrc.indexOf("static IntPtr KbHookCallback");
        if (at < 0) return false;
        const body = csSrc.slice(at, csSrc.indexOf("CallNextHookEx(_kbHookId", at));
        return body.indexOf('EmitAsync(btn, "vk")') >= 0
          && body.indexOf("_blockFlag != 0") >= 0
          && body.indexOf("return (IntPtr)1;") >= 0;
      })());
      check("C# 注册消费页原始输入 sink", /RIDEV_INPUTSINK/.test(csSrc) && /RegisterRawInputDevices/.test(csSrc));
      check("C# 消费页报文扫描仅认 AC_BACK/FORWARD", /HID_USAGE_AC_BACK = 0x0224/.test(csSrc) && /HID_USAGE_AC_FORWARD = 0x0225/.test(csSrc));
      check("C# -ConsumerKeys 参数解析", /args\[i\] == "-ConsumerKeys"/.test(csSrc));
      check("C# 重装钩子同时恢复两条钩子", /hooks reinstalled[\s\S]{0,120}keyboard=/.test(csSrc));
      check("C# _bridgeInit 回报探测器状态", /kbHook/.test(csSrc) && /hidSink/.test(csSrc));

      // 8) 事件源标记贯穿：钩子写 src → JS 读取用于诊断
      check("C# 事件 JSON 带 src 字段", /Append\(",\\"src\\":\\""\)/.test(csSrc));
      check("JS 诊断读取 event.src", /_xbuttonSrcLabel\(event && event\.src\)/.test(bridgeSrc));

      // 9) 设置页 UI 与开关联动（兼容模式 = 原两开关合并）
      const prefSrc = readAddon("content/preferences.js");
      check("设置页含兼容模式复选框", /id: "wt-xbutton-compat"/.test(prefSrc));
      check("设置页已移除旧的两个复选框",
        !/id: "wt-xbutton-block"/.test(prefSrc) && !/id: "wt-xbutton-consumer"/.test(prefSrc));
      check("复选框回显读 xbuttonCompat", /compat\.checked = data\.xbuttonCompat !== false/.test(prefSrc));
      check("复选框改动触发 syncBridge", /xbCompat\.addEventListener\("change"[\s\S]{0,300}syncBridge\(\);/.test(prefSrc));
      check("开启时弹窗（prefs 内，唯一入口）", /function showCompatNotice\(\)/.test(prefSrc)
        && /data\.xbuttonConsumerNoticeAck = true;/.test(prefSrc) && /showCompatNotice\(\);/.test(prefSrc));
      check("悬停提示是独立短文案（用户指定的一句话）",
        /COMPAT_TOOLTIP = "侧键正常时无需开启/.test(prefSrc)
        && /title: COMPAT_TOOLTIP/.test(prefSrc));

      // 10) 端到端（JS 决策路径）：钩子回写的 _bridgeInit 应被识别并记录探测器状态
      const savedRefresh = WT._refreshPrefsFromStorage;
      const savedFire = WT._fireAddWordHotkey;
      const savedPending = WT._getSelectionFirstPending;
      try {
        WT._refreshPrefsFromStorage = () => {};
        WT._data = { xbuttonCompat: true, xbuttonConsumerNoticeAck: true,
          addWordHotkeyEnabled: true, addWordHotkeyMode: "xbutton1", selectionFirstEnabled: true };
        WT._xbuttonBridge.active = true;
        WT._processXButtonEvent({ _bridgeInit: true, kbHook: true, hidSink: true }, "file");
        check("_bridgeInit 确认时记录 kbHook/hidSink",
          WT._xbuttonBridge.confirmed === true && WT._xbuttonBridge.kbHook === true && WT._xbuttonBridge.hidSink === true);

        // 11) 多媒体键形态（src=vk）的事件应走通到「添加单词」触发（此前该形态根本到不了这里）
        let fired = 0;
        WT._fireAddWordHotkey = () => { fired++; };
        WT._getSelectionFirstPending = () => true;
        WT._xbuttonBridge.lastEventTs = 0;
        WT._processXButtonEvent({ ts: Date.now(), x1: 1, src: "vk" }, "file");
        check("src=vk 的侧键事件可触发划词翻译", fired === 1);

        // 12) 同样的事件在「兼容模式关闭」时不会启动（开关真的生效）
        WT._data.xbuttonCompat = false;
        WT._xbuttonBridge.lastEventTs = 0;
        fired = 0;
        WT._processXButtonEvent({ ts: Date.now(), x1: 1, src: "vk" }, "file");
        check("关闭兼容模式后不再由该形态触发", fired === 0);
      } finally {
        WT._refreshPrefsFromStorage = savedRefresh;
        WT._fireAddWordHotkey = savedFire;
        WT._getSelectionFirstPending = savedPending;
        WT._xbuttonBridge.active = false;
        WT._xbuttonBridge.confirmed = false;
        WT._xbuttonBridge.lastEventTs = 0;
        WT._xbuttonBridge._lastNoteTs = 0;
      }
    } catch (e) {
      check("S12 执行无异常", false, e && (e.stack || e.message));
    }
  }

  // ============================================================
  // S13 侧键主开关 + 识别绑定 + 实时选区兜底（Phase 13 回归）
  // 背景（实测日志）：用户按的物理侧键上报 XButton2、绑定是 xbutton1 → 不匹配；
  // 且缓存 10 秒过期后屏幕上高亮还在却报「没有划词选区」。
  // ============================================================
  section("S13 侧键主开关 / 识别 / 选区兜底");
  if (WT) {
    try {
      const bridgeSrc = readAddon("content/scripts/xbutton-bridge.js");
      const prefSrc = readAddon("content/preferences.js");
      const hotkeySrc = readAddon("content/scripts/hotkey.js");
      const savedRefresh = WT._refreshPrefsFromStorage;
      const savedFire = WT._fireAddWordHotkey;
      const savedPending = WT._getSelectionFirstPending;
      const savedRecover = WT._recoverSelectionFirstPending;
      try {
        WT._refreshPrefsFromStorage = () => {};
        WT._xbuttonBridge.active = false;
        WT._xbuttonBridge.recordUntil = 0;
        WT._xbuttonBridge.lastRecordButton = 0;
        WT._xbuttonBridge.lastRecordTs = 0;
        WT._xbuttonBridge.lastConsumerSync = null;

        // 1) 主开关门控：关闭时绝不装钩子（也不影响其他程序的侧键）
        WT._data = { xbuttonEnabled: false, xbuttonCompat: true,
          addWordHotkeyEnabled: true, addWordHotkeyMode: "xbutton1", selectionFirstEnabled: true };
        check("主开关关闭 → wanted=false", WT._xbuttonHotkeyWanted() === false);
        WT._data.xbuttonEnabled = true;
        check("主开关开启 + 侧键模式 → wanted=true", WT._xbuttonHotkeyWanted() === true);
        WT._data.addWordHotkeyMode = "ctrl";
        check("键盘模式 → wanted=false", WT._xbuttonHotkeyWanted() === false);
        WT._data.addWordHotkeyMode = "xbutton-both";
        check("任意侧键模式 → wanted=true", WT._xbuttonHotkeyWanted() === true);
        WT._data.addWordHotkeyEnabled = false;
        check("添加单词关闭 → wanted=false", WT._xbuttonHotkeyWanted() === false);
        WT._data.addWordHotkeyEnabled = true;
        WT._data.selectionFirstEnabled = false;
        check("划词先选关闭 → wanted=false", WT._xbuttonHotkeyWanted() === false);

        // 2) 老数据迁移：已在用侧键的用户升级后不失效，其余默认关闭
        check("迁移：xbutton1 → xbuttonEnabled=true", CFG.normalize({ addWordHotkeyMode: "xbutton1" }).xbuttonEnabled === true);
        check("迁移：xbutton-both → true", CFG.normalize({ addWordHotkeyMode: "xbutton-both" }).xbuttonEnabled === true);
        check("迁移：ctrl → false（默认不接管）", CFG.normalize({ addWordHotkeyMode: "ctrl" }).xbuttonEnabled === false);
        check("迁移：显式 false 被尊重", CFG.normalize({ addWordHotkeyMode: "xbutton1", xbuttonEnabled: false }).xbuttonEnabled === false);
        check("xbuttonEnabled 默认值存在", CFG.DEFAULTS.xbuttonEnabled === false);

        // 3) 识别流程：识别期间放行不吞键，识别成功后自动绑定
        WT._data = { xbuttonEnabled: true, xbuttonCompat: true,
          addWordHotkeyEnabled: true, addWordHotkeyMode: "ctrl", selectionFirstEnabled: true };
        check("未识别时 block=1", WT._xbuttonBlockFlag() === 1);
        WT.startXButtonRecord();
        check("识别窗口已开启", WT._xbuttonRecordActive() === true);
        check("录制期间强制吞键 block=1（防 PDF 翻页，用户实测反馈）", WT._xbuttonBlockFlag() === 1);
        let detectFired = 0;
        WT._fireAddWordHotkey = () => { detectFired++; };
        WT._processXButtonEvent({ ts: Date.now(), x2: 1, src: "mouse" }, "file");
        check("识别：按侧键2 → 自动绑定 xbutton2", WT._data.addWordHotkeyMode === "xbutton2");
        check("识别：识别期间不触发翻译", detectFired === 0);
        check("识别：窗口已结束、恢复吞键", WT._xbuttonRecordActive() === false && WT._xbuttonBlockFlag() === 1);
        check("识别：结果可供设置页回显", WT._xbuttonBridge.lastRecordButton === 2 && WT._xbuttonBridge.lastRecordTs > 0);
        WT.startXButtonRecord();
        WT.stopXButtonRecord();
        check("识别可手动取消", WT._xbuttonRecordActive() === false);

        // 4) 状态写入必须是合并语义：局部更新不得抹掉「最近未触发原因」
        //（覆盖式写入正是状态一直是黑盒的原因之一：启动/停止会清掉诊断信息）
        const realPrefs = Z.Prefs;
        try {
          const store = {};
          Z.Prefs = {
            get: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
            set: (k, v) => { store[k] = v; },
            clear: (k) => { delete store[k]; },
          };
          const KEY = "extensions.zotero.wordtranslator.xbuttonBridgeStatus";
          WT._updateXButtonBridgeStatus({ lastNote: "收到侧键，但绑定不匹配", lastNoteTs: 111 });
          WT._updateXButtonBridgeStatus({ hookError: null });
          const merged = JSON.parse(store[KEY]);
          check("局部状态更新保留 lastNote（诊断信息不再被抹掉）",
            merged.lastNote === "收到侧键，但绑定不匹配" && merged.lastNoteTs === 111 && !("running" in merged));
          WT._updateXButtonBridgeStatus({ hookError: null });
          check("显式 null 可清除字段（启动成功清掉旧错误）",
            !Object.prototype.hasOwnProperty.call(JSON.parse(store[KEY]), "error"));
          WT._updateXButtonBridgeStatus({ hookError: "hook-init-failed" });
          WT._updateXButtonBridgeStatus({ hookError: null });
          check("错误字段可写可清", !Object.prototype.hasOwnProperty.call(JSON.parse(store[KEY]), "error"));
        } finally {
          Z.Prefs = realPrefs;
        }
        check("启动成功时清掉旧错误（error:null 调用点在位）",
          /hookError: null/.test(bridgeSrc));

        // 5) 实时选区兜底：缓存过期但屏幕仍有高亮 → 照常触发
        WT._data = { xbuttonEnabled: true, xbuttonCompat: true,
          addWordHotkeyEnabled: true, addWordHotkeyMode: "xbutton2", selectionFirstEnabled: true };
        WT._xbuttonBridge.active = true; // 侧键模式要求桥接运行中（_addWordHotkeyActive 的实际前置）
        WT._getSelectionFirstPending = () => null;
        let fireCount = 0;
        WT._fireAddWordHotkey = () => { fireCount++; };
        WT._recoverSelectionFirstPending = () => ({ reader: {}, text: "gibberellins", doc: null, append: null, time: Date.now(), recovered: true });
        WT._xbuttonBridge.lastEventTs = 0;
        WT._processXButtonEvent({ ts: Date.now(), x2: 1, src: "mouse" }, "file");
        check("缓存过期但屏幕仍有选区 → 正常触发（本次修复点）", fireCount === 1);
        WT._xbuttonBridge.lastEventTs = 0;
        fireCount = 0;
        WT._recoverSelectionFirstPending = () => null;
        WT._processXButtonEvent({ ts: Date.now(), x2: 1, src: "mouse" }, "file");
        check("无缓存且无实时选区 → 不触发（不引入误触发）", fireCount === 0);
        check("hotkey 路径也接入了选区兜底", /_getSelectionFirstPending\(\) \|\| this\._recoverSelectionFirstPending/.test(hotkeySrc));
        check("兜底读 PDF iframe 的实时选区", /_getHotkeyTargetWindow\(reader\)[\s\S]{0,400}getSelection/.test(hotkeySrc));
        check("兜底有候选阅读器链（当前标签 → 最近划词）",
          /_lastSelectionPopup && this\._lastSelectionPopup\.reader/.test(hotkeySrc)
          && /_selectionFirstPending && this\._selectionFirstPending\.reader/.test(hotkeySrc));
        check("兜底仍走选区合法性校验", /_recoverSelectionFirstPending[\s\S]{0,2000}_isSelectionTextAllowed/.test(hotkeySrc));

        // 5) 诊断可见：未触发原因带「按下的键 vs 绑定的键」，并指向绑定框
        check("不匹配提示点名按下的键与绑定", /收到" \+ btnLabel[\s\S]{0,120}_xbuttonModeLabel\(mode\)/.test(bridgeSrc));
        check("不匹配提示指向「绑定侧键」框", /请在设置页的「绑定侧键」框重新绑定/.test(bridgeSrc));
        check("事件形态标签仍在诊断中使用", /_xbuttonSrcLabel\(/.test(bridgeSrc));

        // 6) 设置页结构：开关 → 绑定框 + 任意侧键勾选 → 实时状态（录制框方案 A）
        check("设置页含主开关", /id: "wt-xbutton-enabled"/.test(prefSrc));
        check("绑定区默认隐藏（开关开启后才出现）", /id: "wt-xbutton-config-wrap"[^)]*display:none/.test(prefSrc));
        check("主开关控制绑定区显隐", /wrap\.style\.display = \(data\.xbuttonEnabled === true\)/.test(prefSrc));
        check("设置页含「绑定侧键」录制框", /id: "wt-xbutton-bind-box"/.test(prefSrc));
        check("绑定框 tooltip 指导录制", /点击后按一下你的侧键，自动绑定为翻译键/.test(prefSrc));
        check("设置页含「任意侧键」勾选框", /id: "wt-xbutton-any"/.test(prefSrc));
        check("勾选「任意侧键」前记住具体绑定（取消时恢复）", /data\.xbuttonPrevBind = data\.addWordHotkeyMode/.test(prefSrc));
        check("绑定框点击启动录制", /WT\.startXButtonRecord\(\)/.test(prefSrc));
        check("录制中再点一次可取消（Esc 同）", /WT\.stopXButtonRecord\(\)/.test(prefSrc));
        check("设置页含实时状态行", /id: "wt-xbutton-status-line"/.test(prefSrc));
        check("状态轮询已启动且有清理钩子", /startXbuttonStatusPoll\(\)/.test(prefSrc) && /addEventListener\("unload"/.test(prefSrc));
        check("主开关改动触发 syncBridge", /xbEnabled\.addEventListener\("change"[\s\S]{0,800}syncBridge\(\);/.test(prefSrc));
        check("开启主开关时默认绑定侧键 1（勾选「任意侧键」才切 xbutton-both）",
          /xbEnabled\.addEventListener\("change"[\s\S]{0,400}data\.addWordHotkeyMode = "xbutton1"/.test(prefSrc));
        check("勾选框在绑定框上方（先勾选策略、后展示具体绑定）",
          (() => {
            const anyAt = prefSrc.indexOf('id: "wt-xbutton-any"');
            const boxAt = prefSrc.indexOf('id: "wt-xbutton-bind-box"');
            return anyAt > 0 && boxAt > anyAt;
          })());
        check("任意侧键文案不再用「两颗」（用户反馈歧义）",
          prefSrc.indexOf("两颗都触发") < 0 && bridgeSrc.indexOf("两颗都触发") < 0
            && /任意侧键（侧键 1 \/ 侧键 2 均可触发）/.test(prefSrc));
        check("成功触发只占一行：最近一次侧键触发：XButtonN（时间）",
          /最近一次侧键触发：" \+ st\.lastBtn \+ \(when \? "（" \+ when \+ "）" : ""\)/.test(prefSrc));
        check("未触发原因下方带触发自检三步",
          /触发检测：① 选中单词 → ② 按下绑定的侧键 → ③ 观察是否翻译/.test(prefSrc));
        check("未触发文案不再引导回 PDF（自检行承担步骤说明）",
          bridgeSrc.indexOf("请先在 PDF/网页中划选单词") < 0);
      } finally {
        WT._refreshPrefsFromStorage = savedRefresh;
        WT._fireAddWordHotkey = savedFire;
        WT._getSelectionFirstPending = savedPending;
        WT._recoverSelectionFirstPending = savedRecover;
        WT._xbuttonBridge.active = false;
        WT._xbuttonBridge.confirmed = false;
        WT._xbuttonBridge.recordUntil = 0;
        WT._xbuttonBridge.lastRecordButton = 0;
        WT._xbuttonBridge.lastRecordTs = 0;
        WT._xbuttonBridge.lastEventTs = 0;
        WT._xbuttonBridge._lastNoteTs = 0;
      }
    } catch (e) {
      check("S13 执行无异常", false, e && (e.stack || e.message));
    }
  }

  // ============================================================
  // S14 兼容模式语义 + 识别窗口复位 + 设置页合并/展开（Phase 14 回归）
  // 背景：① 原「吞掉侧键」与「捕获多媒体键形态侧键」两个开关合并为一个
  // 「兼容模式」；② 识别窗口自然到期此前没有任何回调，钩子会一直停在放行参数；
  // ③ 关闭兼容模式时识别必须仍能「看见」多媒体键形态，否则会把
  // 「信号存在但没监听」误判成「该键没发出任何信号」。
  // ============================================================
  section("S14 兼容模式 / 识别窗口复位 / 设置页合并");
  if (WT) {
    try {
      const bridgeSrc = readAddon("content/scripts/xbutton-bridge.js");
      const prefSrc = readAddon("content/preferences.js");
      const csSrc = readAddon("content/scripts/bridge-hook.cs");
      const schemaSrc = readAddon("content/scripts/config-schema.js");
      // manifest 打包完整性：曾因 PowerShell Set-Content -Encoding UTF8 写入 BOM
      // （Zotero JSON 解析失败 → 「无法安装/可能不兼容」），同时中文字段被按 GBK
      // 误读成乱码。这里把「无 BOM + JSON 可解析 + 必需字段齐全」固化为断言。
      {
        const mfBytes = fs.readFileSync(path.join(base, "manifest.json"));
        const mfNoBom = !(mfBytes[0] === 0xEF && mfBytes[1] === 0xBB && mfBytes[2] === 0xBF);
        let mfJson = null;
        try { mfJson = JSON.parse(mfBytes.toString("utf8")); } catch (e) {}
        check("manifest 无 BOM（UTF-8 裸码）", mfNoBom);
        check("manifest 是合法 JSON", !!mfJson);
        check("manifest 版本号为 b 版格式", !!mfJson && /^6\.\d+\.\d+b\d+$/.test(mfJson.version || ""));
        check("manifest 必需字段齐全（id/update_url/strict_max_version）",
          !!mfJson && !!mfJson.applications && !!mfJson.applications.zotero
            && !!mfJson.applications.zotero.id && !!mfJson.applications.zotero.update_url
            && !!mfJson.applications.zotero.strict_max_version);
        check("manifest 中文名无乱码（mojibake 特征字节检查）",
          !!mfJson && typeof mfJson.name === "string" && mfJson.name.indexOf("翻译") >= 0);
      }
      const savedRefresh = WT._refreshPrefsFromStorage;
      const savedSync = WT.syncXButtonBridge;
      const savedToast = WT._showXButtonToast;
      const savedFire = WT._fireAddWordHotkey;
      const savedPending = WT._getSelectionFirstPending;
      const savedStatusWrite = WT._updateXButtonBridgeStatus;
      let lastStatusWrite = null;
      try {
        WT._refreshPrefsFromStorage = () => {};
        WT._showXButtonToast = () => {};
        // 拦截状态写盘：断言写入内容即可，避免测试触碰真实偏好存储
        WT._updateXButtonBridgeStatus = (o) => { lastStatusWrite = o; return true; };
        WT._data = { xbuttonEnabled: true, xbuttonCompat: true,
          addWordHotkeyEnabled: true, addWordHotkeyMode: "xbutton-both", selectionFirstEnabled: true };
        WT._xbuttonBridge.recordUntil = 0;
        WT._xbuttonBridge.lastRecordTs = 0;
        WT._xbuttonBridge.lastEventTs = 0;

        // 1) 测试功能已清理（自动诊断通道 + 无 UI 入口的测试函数都不再存在）
        check("已移除 -Diag 诊断通道（C#）", !/"-Diag"/.test(csSrc) && !/_diagFlag/.test(csSrc));
        check("已移除诊断采集与异步写入", !/DiagAsync/.test(csSrc) && !/\[input\] key vk=0x/.test(csSrc));
        check("已移除 JS 侧诊断代码", !/_summarizeBridgeDiag|_readTextFileTail|_bridgeDebugLogPath|_xbuttonDiagFlag/.test(bridgeSrc));
        check("已移除无入口的 testXButtonEvent", !/testXButtonEvent/.test(bridgeSrc));
        check("_bridgeInit 仍回报 mouseHook（属可观测性，非测试功能）",
          /\\"mouseHook\\":/.test(csSrc) && /MakeInitJson\(bool ok, string error, bool kbHook, bool hidSink, bool mouseHook\)/.test(csSrc));
        check("识别窗口到期复位保留（属 bug 修复）", /_armRecordExpiry\(\)/.test(bridgeSrc)
          && /record started \(/.test(bridgeSrc));

        // 2) 兼容模式：一个开关同时决定 block 与 consumer（两条通道同开同关）
        WT._data.xbuttonCompat = true;
        check("兼容模式开 → 吞键 + 捕获多媒体键形态",
          WT._xbuttonBlockFlag() === 1 && WT._xbuttonConsumerKeysFlag() === 1);
        WT._data.xbuttonCompat = false;
        check("兼容模式关 → 不吞键 + 只认标准侧键",
          WT._xbuttonBlockFlag() === 0 && WT._xbuttonConsumerKeysFlag() === 0);

        // 3) 识别期间强制开启观察通道（观察 ≠ 接管：block 仍为 0）
        WT._xbuttonBridge.recordUntil = Date.now() + 5000;
        check("识别期间强制开启观察通道", WT._xbuttonConsumerKeysFlag() === 1);
        check("录制期间一律吞键（block=1）", WT._xbuttonBlockFlag() === 1);
        // 兼容模式关闭 + 识别到多媒体键形态 → 明确引导开启兼容模式，且不绑定
        WT._xbuttonBridge.lastEventTs = 0;
        WT._processXButtonEvent({ ts: Date.now(), x1: 1, src: "vk" }, "file");
        const compatNote = (lastStatusWrite && lastStatusWrite.lastNote) || "";
        check("识别到多媒体键形态但兼容模式关闭 → 引导开启兼容模式",
          /兼容模式/.test(compatNote), compatNote);
        check("此时不把该形态绑定成侧键", WT._data.addWordHotkeyMode === "xbutton-both");
        check("此时识别窗口立即结束", WT._xbuttonRecordActive() === false);

        // 4) 打开兼容模式后，同一形态可正常识别并绑定
        WT._data.xbuttonCompat = true;
        WT._xbuttonBridge.recordUntil = Date.now() + 5000;
        WT._xbuttonBridge.lastEventTs = 0;
        WT._processXButtonEvent({ ts: Date.now(), x1: 1, src: "vk" }, "file");
        check("兼容模式开启后多媒体键形态可识别绑定", WT._data.addWordHotkeyMode === "xbutton1");

        // 5) 识别窗口到期必须复位钩子参数（否则永远停在放行、吞键静默失效）
        let syncCalls = 0;
        WT.syncXButtonBridge = () => { syncCalls++; };
        const realWindow = WT._XBUTTON_RECORD_MS;
        WT._XBUTTON_RECORD_MS = 60;
        WT._xbuttonBridge.recordUntil = 0;
        WT._xbuttonBridge.recordTimer = null;
        WT.startXButtonRecord();
        check("识别启动即同步钩子（放行参数）", syncCalls >= 1);
        check("识别窗口期间 detectActive=true", WT._xbuttonRecordActive() === true);
        await new Promise((r) => setTimeout(r, 500));
        check("识别窗口到期后自动结束", WT._xbuttonRecordActive() === false);
        check("识别窗口到期后复位钩子参数", syncCalls >= 2, "syncCalls=" + syncCalls);
        check("绑定超时写入可读结论（指向厂商软件/硬件）",
          /绑定超时/.test(String((lastStatusWrite && lastStatusWrite.lastNote) || "")));
        WT._XBUTTON_RECORD_MS = realWindow;

        // 5b) 热切换契约：进程活着时配置变化绝不走「杀进程→重启」路径（重启空窗
        // 曾让侧键漏到系统、PDF 翻页——用户实测 16:18 时段反复出现）。
        {
          const savedActive = WT._xbuttonBridge.active;
          const savedProc = WT._xbuttonBridge.process;
          const savedFp = WT._xbuttonBridge.fingerprint;
          const savedStop = WT._stopXButtonBridge;
          const savedStart = WT._startXButtonBridge;
          const savedWrite = WT._writeTextFile;
          let stopped = 0, started = 0, wroteParams = null;
          WT.syncXButtonBridge = savedSync; // 前面的到期测试留下的计数 stub 已完成使命
          WT._xbuttonBridge.active = true;
          WT._xbuttonBridge.process = { pid: 12345 };
          WT._xbuttonBridge.confirmed = false; // 未确认也必须热切换
          WT._xbuttonBridge.fingerprint = "stale-fingerprint"; // 强制离开 unchanged 分支
          if (!WT._xbuttonBridge.eventFile) {
            WT._xbuttonBridge.eventFile = "C:\\test\\bridge-events.json";
          }
          WT._stopXButtonBridge = () => { stopped++; };
          WT._startXButtonBridge = () => { started++; };
          WT._writeTextFile = (path, content) => {
            if (/bridge-params\.json$/.test(path)) wroteParams = content;
            return true;
          };
          WT._xbuttonBridge.recordUntil = Date.now() + 5000;
          WT.syncXButtonBridge();
          check("录制开启 → 进程存活即热切换（不杀进程）", stopped === 0 && started === 0);
          check("参数文件已写入（record=1, block=1）",
            !!wroteParams && /"record":1/.test(wroteParams) && /"block":1/.test(wroteParams),
            String(wroteParams));
          check("参数文件含绑定按钮编号（兼容关时只吞绑定那颗）",
            !!wroteParams && /"xbutton":\d/.test(wroteParams), String(wroteParams));
          WT._xbuttonBridge.recordUntil = 0;
          wroteParams = null;
          WT.syncXButtonBridge();
          check("录制结束 → 热切换回常规参数（record=0）",
            !!wroteParams && /"record":0/.test(wroteParams));
          WT._xbuttonBridge.active = savedActive;
          WT._xbuttonBridge.process = savedProc;
          WT._xbuttonBridge.fingerprint = savedFp;
          WT._stopXButtonBridge = savedStop;
          WT._startXButtonBridge = savedStart;
          WT._writeTextFile = savedWrite;
        }

        // 6) 识别成功应取消到期定时器（不能过一会儿又把绑定覆盖掉）
        WT._xbuttonBridge.recordUntil = Date.now() + 60000;
        WT._armRecordExpiry();
        check("识别期间存在到期定时器", !!WT._xbuttonBridge.recordTimer);
        WT._xbuttonBridge.lastEventTs = 0;
        WT._processXButtonEvent({ ts: Date.now(), x2: 1, src: "mouse" }, "file");
        check("识别成功后清掉到期定时器", !WT._xbuttonBridge.recordTimer);
        check("识别成功后绑定为 xbutton2", WT._data.addWordHotkeyMode === "xbutton2");

        // 7) 非识别期间，兼容模式关闭时消费键形态仍被拦截（用户开关有效）
        WT._xbuttonBridge.recordUntil = 0;
        WT._xbuttonBridge.lastEventTs = 0;
        WT._data.xbuttonCompat = false;
        let consumerFired = 0;
        WT._fireAddWordHotkey = () => { consumerFired++; };
        WT._getSelectionFirstPending = () => ({ reader: {}, text: "x", doc: null, append: null, time: Date.now() });
        WT._xbuttonBridge.active = true;
        WT._processXButtonEvent({ ts: Date.now(), x1: 1, src: "vk" }, "file");
        check("兼容模式关闭后消费键形态不再触发", consumerFired === 0);

        // 8) 设置页：兼容模式单开关 + 「识别与状态」展开项 + 状态行并入该块
        check("设置页只有兼容模式一个开关", /id: "wt-xbutton-compat"/.test(prefSrc)
          && !/id: "wt-xbutton-block"/.test(prefSrc) && !/id: "wt-xbutton-consumer"/.test(prefSrc));
        check("设置页含「状态与诊断」展开项标题", /id: "wt-xbutton-diag-head"/.test(prefSrc)
          && /id: "wt-xbutton-diag-body"/.test(prefSrc));
        check("展开项可折叠（点击标题切换）",
          /detectHead\.addEventListener\("click"[\s\S]{0,400}body\.style\.display/.test(prefSrc));
        const bodyAt = prefSrc.indexOf('id: "wt-xbutton-diag-body"');
        const statusAt = prefSrc.indexOf('id: "wt-xbutton-status-line"');
        check("状态行并入展开项（标题与状态在同一块）",
          bodyAt > 0 && statusAt > bodyAt && (statusAt - bodyAt) < 1200);
        check("主开关关闭时整块不展开（含展开项）",
          /wrap\.style\.display = \(data\.xbuttonEnabled === true\) \? "" : "none"/.test(prefSrc));
        check("状态行显示绑定倒计时", /剩余 " \+ secs \+ " 秒/.test(prefSrc));
        check("状态行第 1 行含 标准模式/兼容模式 标注",
          /已生效（" \+ modeLabel \+ "）/.test(prefSrc) && /"兼容模式" : "标准模式"/.test(prefSrc));
        check("状态行结构化两行（\\n 分行 + pre-line）",
          /lines\.push\("⚠️ 未触发："/.test(prefSrc) && /lines\.join\("\\n"\)/.test(prefSrc)
            && /white-space:pre-line/.test(prefSrc));
        check("状态行未触发原因用结构化 lastReason（旧 lastNote 兜底解析）",
          /st\.lastReason \|\|/.test(prefSrc) && /未触发:\\s\*/.test(prefSrc));
        check("侧键按下后的检测提示已取消（不再弹 toast）",
          (() => {
            const at = bridgeSrc.indexOf("_xbuttonNoteSkip(reason, event)");
            return at > 0 && bridgeSrc.indexOf("ProgressWindow", at) < 0
              || at > 0 && bridgeSrc.slice(at, bridgeSrc.indexOf("},", at)).indexOf("ProgressWindow") < 0;
          })());
        check("未触发只记录到状态行（lastBtn/lastReason 结构化）",
          /lastBtn: detail/.test(bridgeSrc) && /lastReason: String\(reason\)/.test(bridgeSrc));
        check("录制成功清除过期的未触发警示", /lastReason: null/.test(bridgeSrc));
        // 四选一闭合：切回键盘模式自动关闭侧键主开关并收回
        check("选择 Ctrl/Alt/Shift/自定义 时自动关闭侧键主开关",
          /\["ctrl", "alt", "shift", "custom"\]\.forEach\(\(mode\) => \{[\s\S]{0,600}data\.xbuttonEnabled = false/.test(prefSrc));
        check("录制自定义键也会关闭侧键主开关",
          /makeHotkeyRecorder\("wt-addword-hotkey"[\s\S]{0,600}xbuttonEnabled = false/.test(prefSrc));
        check("设置页对「鼠标钩子未装上」给出提示", /鼠标钩子未装上/.test(prefSrc));
        check("录制框有 60 秒窗口与 Esc 取消说明", /60 秒内有效，Esc 取消/.test(prefSrc));
        check("设置页不再有独立的兼容提示段落（已并入悬停提示与弹窗）",
          !/id: "wt-xbutton-compat-hint"/.test(prefSrc));
        check("展开项标题已更名为「状态与诊断」", /状态与诊断/.test(prefSrc));
        // 泛化绑定（三颗及以上侧键的鼠标）：录制收集窗 + 择优 + code 匹配
        check("录制窗口收集 code 候选并择优（vk 优先于 hid）",
          /recordCodes\[event\.code\] = true/.test(bridgeSrc)
            && /const vkCode = Object\.keys\(codes\)\.filter\(\(c\) => c\.indexOf\("vk:"\) === 0\)\[0\] \|\| ""/.test(bridgeSrc)
            && /const best = vkCode \|\| hidCode/.test(bridgeSrc));
        check("code 键绑定写回配置（lastRecordCode）", /this\._xbuttonBridge\.lastRecordCode = code \|\| ""/.test(bridgeSrc)
          && /data\.addWordHotkeyMode = dmode;/.test(bridgeSrc));
        check("运行期按 code 匹配泛化绑定", /matched = \(event\.code === mode\)/.test(bridgeSrc));
        check("显式绑定的 code 键不受兼容模式开关拦截", /isBoundCodeEvent/.test(bridgeSrc));
        check("钩子进程收到 -Record 与 -BindCode 参数",
          /'-Record','" \+ recordFlag \+ "'/.test(bridgeSrc) && /'-BindCode','" \+ bindCodeQ \+ "'/.test(bridgeSrc));
        check("指纹含 record 与 bind（录制窗口/绑定键变化需重建进程）",
          /;record=" \+ \(this\._xbuttonRecordActive\(\) \? 1 : 0\) \+ ";bind=" \+ bindCode/.test(bridgeSrc));
        check("schema 允许泛化键绑定值（vk:0xNN / hid:0xNNNN）",
          /vk:0x\[0-9A-F\]\{2\}\|hid:0x\[0-9A-F\]\{4\}/.test(schemaSrc));
        check("绑定值规范化为大写十六进制（与事件码形态一致）",
          /canonicalizeKeyMode/.test(schemaSrc));
      } finally {
        WT._refreshPrefsFromStorage = savedRefresh;
        WT.syncXButtonBridge = savedSync;
        WT._showXButtonToast = savedToast;
        WT._fireAddWordHotkey = savedFire;
        WT._getSelectionFirstPending = savedPending;
        WT._updateXButtonBridgeStatus = savedStatusWrite;
        try { if (WT._xbuttonBridge.recordTimer) clearTimeout(WT._xbuttonBridge.recordTimer); } catch (e) {}
        WT._xbuttonBridge.recordTimer = null;
        WT._xbuttonBridge.recordUntil = 0;
        WT._xbuttonBridge.lastRecordTs = 0;
        WT._xbuttonBridge.lastEventTs = 0;
        WT._xbuttonBridge.active = false;
      }
    } catch (e) {
      check("S14 执行无异常", false, e && (e.stack || e.message));
    }
  }

  console.log("\nRESULT pass=%d fail=%d", pass, fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(1); });
