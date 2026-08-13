"use strict";
// Word Translator 偏好面板脚本（在偏好窗口全局作用域执行）
// 由 preferences.xhtml 的 onload -> Zotero.WordTranslator.hooks.onPrefsLoad -> loadSubScript(this) 载入。

(function () {
  if (window.__wordtranslatorPrefsLoaded) return;
  window.__wordtranslatorPrefsLoaded = true;

  const HTML_NS = "http://www.w3.org/1999/xhtml";

  function debugWriteToFile(msg) {
    try {
      if (typeof Components === "undefined") return;
      var profileDir = null;
      try {
        profileDir = null;
        if (Zotero && Zotero.Profile && Zotero.Profile.dir) {
          profileDir = String(Zotero.Profile.dir);
        }
        if (!profileDir && Zotero && typeof Zotero.getProfileDirectory === "function") {
          profileDir = Zotero.getProfileDirectory();
        }
        if (!profileDir && Zotero && Zotero.ProfileDir) profileDir = Zotero.ProfileDir;
        if (!profileDir && Zotero && Zotero.profileDirectory) profileDir = Zotero.profileDirectory;
        if (!profileDir && typeof Services !== "undefined" && Services.dirsvc && typeof Components !== "undefined") {
          profileDir = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
        }
      } catch (e0) {}
      if (!profileDir) return;
      var line = "[" + new Date().toISOString() + "] [WordTranslator prefs] " + String(msg) + "\n";
      var wfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      try { wfile.initWithFile(profileDir); } catch (e1) { wfile.initWithPath(profileDir.path || String(profileDir)); }
      wfile.append("wordtranslator-debug.log");
      var wout = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      wout.init(wfile, 0x02 | 0x08 | 0x10, 0o666, 0);
      var wconv = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
      wconv.init(wout, "UTF-8", 4096, 0xFFFD);
      wconv.writeString(line);
      wconv.close();
      wout.close();
    } catch (e) {
      try { Zotero.debug("[WordTranslator prefs][logwrite-fail] " + msg + " :: " + (e && e.message || e)); } catch (e2) {}
    }
  }

  function debugLog(msg) {
    try { Zotero.debug("[WordTranslator prefs] " + msg); } catch (e) {}
    debugWriteToFile(msg);
  }

  let data = null;

  // “快捷键-划词翻译” 与 “自定义快捷键” 二选一互斥：
  //   - 任一为 on，另一个强制为 off；
  //   - 都可各自关闭，但永远不能同时为 on；
  //   - 至少一个为 on 时，显示对应的设置行；都为 off 时全部收起。
  function applyHotkeyUI() {
    try {
      const en = get("wt-hotkey-enabled");
      const useCustom = get("wt-hotkey-custom-enabled");
      const modWrap = get("wt-hotkey-mod-wrap");
      const customWrap = get("wt-hotkey-custom-wrap");
      // 数据层互斥（双保险：UI 与 change 处理器都会同步）
      if (en && useCustom) {
        if (en.checked && useCustom.checked) {
          // 不允许同时 on：以当前较新的为准。这里统一让后者胜出会出循环，
          // 因此仅在 UI 阶段不修复两者同时 on，让 change 处理器负责修正。
        }
      }
      // UI 展示
      const anyOn = (en && en.checked) || (useCustom && useCustom.checked);
      if (modWrap) modWrap.style.display = (en && en.checked) ? "" : "none";
      if (customWrap) customWrap.style.display = (useCustom && useCustom.checked) ? "" : "none";
      // 提示行提示状态
      const hint = get("wt-hotkey-hint");
      if (hint) hint.textContent = anyOn
        ? "已开启划词快捷键，划选文本即自动翻译并加入单词本。"
        : "划词快捷键已关闭。";
    } catch (e) {}
  }

  // 数据层互斥：开启 a 时关闭 b；关闭其中一个不影响另一个。
  function syncHotkeyMutex(origin) {
    try {
      const en = get("wt-hotkey-enabled");
      const useCustom = get("wt-hotkey-custom-enabled");
      if (!en || !useCustom) return;
      if (origin === "preset" && en.checked) {
        useCustom.checked = false;
        data.customHotkeyEnabled = false;
      } else if (origin === "custom" && useCustom.checked) {
        en.checked = false;
        data.hotkeyEnabled = false;
      }
    } catch (e) {}
  }
  // “绑定「添加单词并翻译」快捷键（先选区后按绑定键）”UI：
  //   - 总开关 wt-addword-hotkey-enabled（默认开启，即与划词翻译合并后的“先选区后按绑定键”）
  //   - 单选：Ctrl / Alt / Shift / 自定义绑定按键（wt-addword-mode-*）
  function applyAddWordHotkeyUI() {
    try {
      const en = get("wt-addword-hotkey-enabled");
      const wrap = get("wt-addword-hotkey-wrap");
      if (wrap) wrap.style.display = en && en.checked ? "" : "none";
      // 收起状态：仅收起界面，不改变已保存的数据（关闭时即关闭本功能）
      if (!(en && en.checked)) {
        const cw = get("wt-addword-custom-wrap");
        if (cw) cw.style.display = "none";
        const hint = get("wt-addword-mode-hint");
        if (hint) hint.textContent = "开启后：先选中单词，再按下绑定按键，立即执行「添加单词并翻译」。";
        return;
      }
      // 兼容旧数据：none / mouse3 / mouse4 / mouse5 自动迁移到 custom，避免全部未选
      let mode = data.addWordHotkeyMode || "custom";
      if (mode === "none" || mode === "mouse3" || mode === "mouse4" || mode === "mouse5") mode = "custom";
      data.addWordHotkeyMode = mode;
      const ids = ["ctrl", "alt", "shift", "custom"];
      for (const id of ids) {
        const r = get("wt-addword-mode-" + id);
        if (r) r.checked = (mode === id);
      }
      const cw = get("wt-addword-custom-wrap");
      if (cw) cw.style.display = (mode === "custom") ? "" : "none";
      const hint = get("wt-addword-mode-hint");
      if (hint) {
        if (mode === "ctrl") hint.textContent = "先选中单词，再按下 Ctrl 键，立即执行「添加单词并翻译」。";
        else if (mode === "alt") hint.textContent = "先选中单词，再按下 Alt 键，立即执行「添加单词并翻译」。";
        else if (mode === "shift") hint.textContent = "先选中单词，再按下 Shift 键，立即执行「添加单词并翻译」。";
        else hint.textContent = "请在下方输入框双击录制键盘组合键（如 Ctrl+Enter、Alt+Z）。";
      }
    } catch (e) {}
  }

  function applyPromptModeUI() {
    try {
      const mode = data.promptMode || "split";
      const radioSplit = get("wt-prompt-mode-split");
      const radioCombined = get("wt-prompt-mode-combined");
      if (radioSplit) radioSplit.checked = mode === "split";
      if (radioCombined) radioCombined.checked = mode === "combined";
      const wrapSplit = get("wt-prompt-split-wrap");
      const wrapCombined = get("wt-prompt-global-wrap");
      if (wrapSplit) wrapSplit.style.display = mode === "split" ? "" : "none";
      if (wrapCombined) wrapCombined.style.display = mode === "combined" ? "" : "none";
    } catch (e) {}
  }
  let editingIndex = -1;

  function el(tag, attrs, children) {
    const e = document.createElementNS(HTML_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") e.className = v;
        else if (k === "style") e.style.cssText = v;
        else if (k === "dataset") Object.assign(e.dataset, v);
        else e.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => e.append(c));
    return e;
  }
  function txt(s) { return document.createTextNode(String(s ?? "")); }
  function get(id) { return document.getElementById(id); }

  // 通用按键录制器：双击输入框进入录制，捕获键盘组合键或鼠标侧键，写入规范字符串
  function makeHotkeyRecorder(inputId, onRecord) {
    const inp = get(inputId);
    if (!inp) return;
    let recording = false;
    const cancel = () => { recording = false; inp.value = inp.dataset.prev || ""; inp.blur(); };
    const keyHandler = (ev) => {
      if (!recording) return;
      ev.preventDefault();
      ev.stopPropagation();
      const k = (ev.key || "").toLowerCase();
      if (k === "escape") { cancel(); return; }
      if (k === "control" || k === "shift" || k === "alt" || k === "meta") return;
      const parts = [];
      if (ev.ctrlKey) parts.push("Ctrl");
      if (ev.altKey) parts.push("Alt");
      if (ev.shiftKey) parts.push("Shift");
      const keyName = (k.length === 1 ? k : k === "enter" ? "Enter" : k === " " ? "Space" : k);
      if (k.length === 1) parts.push(k.toUpperCase());
      else parts.push(keyName);
      // 保留大小写：Ctrl/Alt/Shift 首字母大写，如 "Alt+C"、"Ctrl+Alt+C"
      const spec = parts.join("+");
      recording = false;
      inp.value = spec;
      inp.dataset.prev = spec;
      if (onRecord) onRecord(spec);
      document.removeEventListener("keydown", keyHandler, true);
      document.removeEventListener("mousedown", mouseHandler, true);
      inp.blur();
    };
    // 鼠标按键 → spec 映射
    // Firefox/Zotero 中侧键可能默认是浏览器前进/后退，需要在最早的事件阶段（pointerdown）
    // 就 preventDefault 抢占，否则浏览器可能已经消费了事件。
    const buttonToSpec = (b) => {
      if (b === 0) return "mouse1"; // 左键
      if (b === 1) return "mouse3"; // 中键（滚轮按下）
      if (b === 2) return "mouse2"; // 右键
      if (b === 3) return "mouse4"; // 侧键 1 / xbutton1 / 后退
      if (b === 4) return "mouse5"; // 侧键 2 / xbutton2 / 前进
      return null;
    };
    const clearRecorder = () => {
      recording = false;
      document.removeEventListener("keydown", keyHandler, true);
      document.removeEventListener("mousedown", mouseHandler, true);
      document.removeEventListener("mouseup", mouseHandler, true);
      document.removeEventListener("pointerdown", pointerHandler, true);
      document.removeEventListener("auxclick", auxHandler, true);
    };
    const commit = (ev, spec) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch (e2) {}
      recording = false;
      inp.value = spec;
      inp.dataset.prev = spec;
      if (onRecord) onRecord(spec);
      clearRecorder();
      try { inp.blur(); } catch (e2) {}
    };
    const tryHandleFromButton = (ev) => {
      if (!recording) return;
      const b = ev.button;
      const spec = buttonToSpec(b);
      if (spec) commit(ev, spec);
    };
    const mouseHandler = (ev) => { tryHandleFromButton(ev); };
    const pointerHandler = (ev) => {
      // pointerdown 是最先触发的事件，必须抢占浏览器前进/后退默认行为
      tryHandleFromButton(ev);
    };
    const auxHandler = (ev) => {
      // 侧键通常触发 auxclick（非主按钮点击）；即使 mousedown 被浏览器吃掉，这里也能兜住
      tryHandleFromButton(ev);
    };
    inp.addEventListener("dblclick", () => {
      recording = true;
      inp.value = "请按键…";
      document.addEventListener("keydown", keyHandler, true);
      // 同时监听 mousedown、mouseup、pointerdown、auxclick，覆盖浏览器差异
      document.addEventListener("mousedown", mouseHandler, true);
      document.addEventListener("mouseup", mouseHandler, true);
      document.addEventListener("pointerdown", pointerHandler, true);
      document.addEventListener("auxclick", auxHandler, true);
    });
    inp.addEventListener("blur", () => {
      if (recording) {
        clearRecorder();
        inp.value = inp.dataset.prev || "";
      }
    });
  }

  const DEFAULT_PROMPT_SYSTEM =
    "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。";
  const DEFAULT_PROMPT_USER =
    "请将以下英文单词或短语翻译为专业中文：{{word}}";
  const DEFAULT_PROMPT_GLOBAL =
    "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。\n请将以下英文单词或短语翻译为专业中文：{{word}}";

  // Provider 注册表：先统一偏好页的服务分类和命名，后续逐个接入协议。
  // 已实现的 provider 保持可选；尚未接入请求层的 provider 暂时禁用，避免保存后误走 OpenAI 逻辑。
  const PROVIDER_CATALOG = [
    {
      group: "AI / 大模型",
      options: [
        { value: "openai", label: "OpenAI 兼容", enabled: true, baseUrl: "https://api.openai.com/v1" },
        { value: "deepseek", label: "DeepSeek 官方", enabled: true, baseUrl: "https://api.deepseek.com" },
        { value: "gemini", label: "Gemini（OpenAI 兼容端点）", enabled: true, baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
        { value: "claude", label: "Claude", enabled: true, managedConfig: true, baseUrl: "https://api.anthropic.com/v1", requiresModel: true },
        { value: "qwen-mt", label: "Qwen-MT", enabled: true, baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
      ],
    },
    {
      group: "国内翻译平台",
      options: [
        { value: "baidu", label: "百度翻译", enabled: true, managedConfig: true, baseUrl: "https://api.fanyi.baidu.com/api/trans/vip/translate", requiresModel: false, credentialFormat: "appid#key" },
        { value: "baidu-field", label: "百度垂直领域", enabled: true, managedConfig: true, baseUrl: "https://api.fanyi.baidu.com/api/trans/vip/fieldtranslate", requiresModel: false, credentialFormat: "appid#key#domain" },
        { value: "tencent", label: "腾讯云机器翻译", enabled: true, managedConfig: true, baseUrl: "https://tmt.tencentcloudapi.com", requiresModel: false, credentialFormat: "SecretId#SecretKey#Region#ProjectId" },
        { value: "aliyun", label: "阿里云机器翻译", enabled: true, managedConfig: true, baseUrl: "https://mt.cn-hangzhou.aliyuncs.com/", requiresModel: false, credentialFormat: "AccessKeyId#AccessKeySecret" },
        { value: "volcengine", label: "火山引擎机器翻译", enabled: true, managedConfig: true, baseUrl: "https://translate.volcengineapi.com", requiresModel: false, credentialFormat: "AccessKeyId#AccessKeySecret" },
        { value: "caiyun", label: "彩云小译", enabled: true, managedConfig: true, baseUrl: "http://api.interpreter.caiyunai.com/v1/translator", requiresModel: false },
        { value: "niutrans", label: "小牛翻译", enabled: true, managedConfig: true, baseUrl: "https://api.niutrans.com/NiuTransServer/translation", requiresModel: false },
        { value: "youdaozhiyun", label: "有道智云", enabled: true, managedConfig: true, baseUrl: "https://openapi.youdao.com/api", requiresModel: false, credentialFormat: "AppKey#AppSecret" },
        { value: "xfyun", label: "讯飞机器翻译", enabled: true, managedConfig: true, requiresModel: false, credentialFormat: "AppID#APIKey#APISecret" },
      ],
    },
    {
      group: "国际翻译平台",
      options: [
        { value: "deepl", label: "DeepL", enabled: true, managedConfig: true, baseUrl: "https://api-free.deepl.com/v2", requiresModel: false },
        { value: "microsoft", label: "微软翻译", enabled: true, managedConfig: true, baseUrl: "https://api.cognitive.microsofttranslator.com/translate", requiresModel: false },
      ],
    },
    {
      group: "免费翻译",
      options: [
        { value: "google", label: "Google 翻译", enabled: true, managedConfig: true, baseUrl: "https://translate.googleapis.com/translate_a/single", noCredentials: true, requiresModel: false },
        { value: "deeplx", label: "DeepL 免费", enabled: true, managedConfig: true, baseUrl: "https://www2.deepl.com/jsonrpc", noCredentials: true, requiresModel: false },
      ],
    },
    {
      group: "自建服务",
      options: [
        { value: "custom", label: "自定义 OpenAI 兼容接口", enabled: true },
        { value: "libretranslate", label: "LibreTranslate", enabled: true, baseUrl: "", requiresModel: false, apiKeyOptional: true },
        { value: "mtranserver", label: "MTranServer（需适配器：自建 JSON）", enabled: false },
      ],
    },
  ];

  function getProviderMeta(provider) {
    for (const group of PROVIDER_CATALOG) {
      const found = group.options.find((item) => item.value === provider);
      if (found) return { ...found, group: group.group };
    }
    return { value: provider || "custom", label: "自定义 OpenAI 兼容接口", enabled: true, group: "自建服务" };
  }

  function renderProviderOptions(select, selectedValue) {
    if (!select) return;
    select.replaceChildren();
    const selected = selectedValue || "openai";
    for (const group of PROVIDER_CATALOG) {
      const optgroup = el("optgroup", { label: group.group });
      for (const item of group.options) {
        const option = el("option", { value: item.value }, [txt(item.label)]);
        option.disabled = !item.enabled;
        optgroup.append(option);
      }
      select.append(optgroup);
    }
    // 兼容旧配置或未来插件版本新增的 provider，避免编辑时丢失原值。
    if (selected && !PROVIDER_CATALOG.some((group) => group.options.some((item) => item.value === selected))) {
      select.append(el("option", { value: selected }, [txt(selected)]));
    }
    select.value = selected;
  }

  const DEFAULTS = {
    contextMenuLabel: "添加单词并翻译",
    enabled: true,
    autoTranslate: false,
    selectionMode: "word",
    hotkeyEnabled: false,
    hotkeyModifier: "ctrl",
    customHotkeyEnabled: false,
    customHotkey: "",
    addWordHotkeyEnabled: true,
    addWordHotkey: "",
    addWordHotkeyMode: "ctrl", // "ctrl" | "alt" | "shift" | "custom"
    promptMode: "split",
    promptSystem: DEFAULT_PROMPT_SYSTEM,
    promptUser: DEFAULT_PROMPT_USER,
    promptGlobal: DEFAULT_PROMPT_GLOBAL,
    apis: [],
    activeApiIndex: 0,
    fontSize: 13,
    pageSize: 10, // 单词本每页显示单词数（默认 10）
    searchStrategy: "prefix", // 搜索匹配策略（默认前缀匹配）
  };

  function normalize(raw) {
    const base = JSON.parse(JSON.stringify(DEFAULTS));
    if (!raw || typeof raw !== "object") return base;
    return {
      ...base,
      ...raw,
      apis: Array.isArray(raw.apis) ? raw.apis : [],
      activeApiIndex: typeof raw.activeApiIndex === "number" ? raw.activeApiIndex : 0,
      pageSize: Number.isFinite(Number(raw.pageSize)) && Number(raw.pageSize) >= 1 ? Math.floor(Number(raw.pageSize)) : 10,
      searchStrategy: typeof raw.searchStrategy === "string" ? raw.searchStrategy : "prefix",
      selectionMode: raw.selectionMode === "sentence" ? "sentence" : "word",
      // 旧数据没有新字段时保持默认值（...raw 会用 undefined 覆盖 base，需显式回填）
      addWordHotkeyEnabled: typeof raw.addWordHotkeyEnabled === "boolean" ? raw.addWordHotkeyEnabled : true,
      addWordHotkeyMode: (raw.addWordHotkeyMode === "ctrl" || raw.addWordHotkeyMode === "alt" ||
        raw.addWordHotkeyMode === "shift" || raw.addWordHotkeyMode === "custom")
        ? raw.addWordHotkeyMode : "ctrl",
    };
  }

  function setStatus(text) {
    const e = get("wt-status");
    if (e) e.textContent = text;
  }

  // ????????? Item Pane ???? API ??????????
  function notifyConfigChanged() {
    try {
      if (Zotero && Zotero.WordTranslator && typeof Zotero.WordTranslator._onConfigChange === "function") {
        Zotero.WordTranslator._onConfigChange();
      }
    } catch (e) {
      try { Zotero.debug("[WordTranslator prefs] notify ERROR: " + (e && e.message || e)); } catch (e2) {}
    }
  }

  // ----- 保存 -----
  // ----- 快捷键冲突检测 -----
  function getSelectionHotkeySpec() {
    if (data.customHotkeyEnabled) {
      return String(data.customHotkey || "").toLowerCase();
    }
    if (data.hotkeyEnabled) {
      return String(data.hotkeyModifier || "").toLowerCase();
    }
    return "";
  }

  function getAddWordHotkeySpec() {
    if (!data.addWordHotkeyEnabled) return "";
    const mode = data.addWordHotkeyMode || "custom";
    if (mode === "ctrl" || mode === "alt" || mode === "shift") {
      return mode;
    }
    return String(data.addWordHotkey || "").toLowerCase();
  }

  function hasHotkeyConflict() {
    const selectionSpec = getSelectionHotkeySpec();
    const addWordSpec = getAddWordHotkeySpec();
    if (!selectionSpec || !addWordSpec) return false;
    return selectionSpec === addWordSpec;
  }

  function save(showStatus) {
    if (hasHotkeyConflict()) {
      setStatus("快捷键冲突：划词翻译快捷键与先选区后按绑定键不能使用同一个按键");
      return;
    }
    try {
      let ok = false;
      try {
        if (Zotero && Zotero.WordTranslator && typeof Zotero.WordTranslator.writeApiConfigString === "function") {
          ok = Zotero.WordTranslator.writeApiConfigString(JSON.stringify(data));
        }
      } catch (e0) {}
      if (!ok) {
        Zotero.Prefs.set("extensions.zotero.wordtranslator.config", JSON.stringify(data), true);
      }
    } catch (e) { debugLog("save prefs ERROR: " + (e && e.message || e)); }
    if (showStatus) setStatus("已保存");
    try {
      const main = Zotero.getMainWindow();
      if (main && main.document) {
        const ev = new main.document.defaultView.Event("wordtranslator-config-updated", { bubbles: false });
        main.document.dispatchEvent(ev);
      }
    } catch (e) {}
    try { Zotero.WordTranslator && Zotero.WordTranslator.loadDataFromDisk(); } catch (e) {}
    try { if (Zotero.WordTranslator && typeof Zotero.WordTranslator._invalidatePrefsCache === "function") Zotero.WordTranslator._invalidatePrefsCache(); } catch (e) {}
    try { notifyConfigChanged(); } catch (e) { debugLog("notify ERROR: " + (e && e.message || e)); }
  }

  // ----- 渲染 API 列表 -----
  function renderApis() {
    const tbody = get("wt-apis-tbody");
    if (!tbody) return;
    tbody.replaceChildren();
    if (!data.apis.length) {
      const tr = el("tr", {}, [el("td", { colspan: "7", style: "color:#888;font-size:12px;padding:8px;" }, [txt("还没有配置翻译服务，点击下方“+ 添加服务商”开始配置。")])]);
      tbody.append(tr);
      return;
    }
    data.apis.forEach((api, i) => {
      const tr = el("tr", { class: i === editingIndex ? "selected" : "" });
      const tdDefault = el("td");
      const radio = el("input", { type: "radio", name: "pref-default-api" });
      radio.checked = i === data.activeApiIndex;
      radio.addEventListener("change", () => {
        data.activeApiIndex = i;
        save(true);
        renderApis();
      });
      tdDefault.append(radio);
      const tdName = el("td", {}, [txt(api.name || "(未命名)")]);
      const meta = getProviderMeta(api.provider);
      const tdProvider = el("td", {}, [txt(providerLabel(api))]);
      const tdGroup = el("td", {}, [txt(meta.group)]);
      const tdModel = el("td", {}, [txt(api.model || "")]);
      const tdStatus = el("td", { class: "wt-api-status" }, [txt(providerStatus(api))]);
      const tdOp = el("td");
      const editBtn = el("button", { type: "button", class: "pref-mini-btn" }, [txt("编辑")]);
      editBtn.addEventListener("click", () => openEditor(i));
      const delBtn = el("button", { type: "button", class: "pref-mini-btn pref-danger" }, [txt("删除")]);
      delBtn.addEventListener("click", () => {
        if (!confirm("确认删除 API “" + (api.name || "(未命名)") + "”？")) return;
        data.apis.splice(i, 1);
        if (data.activeApiIndex >= data.apis.length) data.activeApiIndex = Math.max(0, data.apis.length - 1);
        if (data.activeApiIndex === i) data.activeApiIndex = Math.min(i, data.apis.length - 1);
        if (editingIndex === i) closeEditor();
        save(true);
        renderApis();
      });
      tdOp.append(editBtn, txt(" "), delBtn);
      tr.append(tdDefault, tdName, tdProvider, tdGroup, tdModel, tdStatus, tdOp);
      tr.addEventListener("dblclick", () => openEditor(i));
      tbody.append(tr);
    });
  }

  function providerLabel(api) {
    return getProviderMeta(api.provider).label.replace(/（后续接入）$/, "");
  }

  function providerStatus(api) {
    const meta = getProviderMeta(api.provider);
    if (!meta.enabled) return "未接入";
    const noCred = meta.noCredentials === true;
    const apiKeyRequired = !noCred && meta.apiKeyOptional !== true;
    const requiresModel = meta.requiresModel !== false;
    if (apiKeyRequired && !(api.apiKey || "").trim()) return "待配置";
    if (requiresModel && !noCred && !(api.model || "").trim()) return "待配置";
    return "已配置";
  }

  function setRowVisible(id, visible) {
    const field = get(id);
    const row = field && field.closest && field.closest(".wt-row");
    // 不能依赖 hidden 属性：.wt-row 的 display:flex CSS 特异性更高会覆盖 UA 的 [hidden] 规则
    if (row) row.style.display = visible ? "" : "none";
  }

  // ----- 编辑面板 -----
  function openEditor(index) {
    editingIndex = index;
    const editor = get("wt-api-editor");
    if (!editor) return;
    editor.hidden = false;
    const api = index >= 0 ? data.apis[index] : {
      provider: "openai",
      name: "",
      baseUrl: "",
      apiKey: "",
      model: "",
    };
    get("wt-api-name").value = api.name || "";
    get("wt-api-provider").value = api.provider || "openai";
    get("wt-api-baseurl").value = api.baseUrl || "";
    get("wt-api-key").value = api.apiKey || "";
    get("wt-api-model").value = api.model || "";
    renderProviderOptions(get("wt-api-provider"), api.provider || "openai");
    updateProviderPreset(editingIndex < 0);
    get("wt-api-editor-title").textContent = (index >= 0 ? "编辑" : "添加") + "服务商";
    renderApis();
  }

  function closeEditor() {
    editingIndex = -1;
    const editor = get("wt-api-editor");
    if (editor) editor.hidden = true;
    renderApis();
  }

  function updateProviderPreset(forceBaseUrl) {
    const prov = get("wt-api-provider").value;
    const preset = get("wt-api-baseurl");
    const meta = getProviderMeta(prov);
    const managed = meta.managedConfig === true;
    const noCredentials = meta.noCredentials === true;
    const requiresModel = meta.requiresModel !== false;
    const nameField = get("wt-api-name");
    const keyField = get("wt-api-key");
    const modelField = get("wt-api-model");
    const fetchModelsButton = get("wt-api-fetch-models");
    if (managed || (forceBaseUrl && meta.baseUrl)) {
      // managed 服务商必须强制写入预设 URL；无 URL（如讯飞）则清空，避免残留上一服务商的地址
      preset.value = meta.baseUrl || "";
      if (managed && nameField) nameField.value = meta.label;
      if (managed && modelField) modelField.value = "";
    }
    preset.readOnly = managed;
    preset.placeholder = meta.baseUrl || "例如 https://api.example.com/v1";
    setRowVisible("wt-api-name", !managed);
    setRowVisible("wt-api-baseurl", !managed);
    setRowVisible("wt-api-key", !noCredentials);
    setRowVisible("wt-api-model", requiresModel);
    if (fetchModelsButton) fetchModelsButton.hidden = !requiresModel;
    if (keyField) keyField.placeholder = meta.credentialFormat || "";
    const hint = preset.parentElement && preset.parentElement.querySelector(".wt-hint");
    if (hint) hint.textContent = managed
      ? "官方翻译服务已固定 API 地址，填写所需凭证后即可保存。"
      : meta.enabled
        ? "可填写或修改基础 URL，用于官方大模型、兼容接口或自建服务。"
        : "该服务已加入目录，协议适配将在后续阶段接入，当前不可保存使用。";
  }

  function saveApi() {
    const provider = get("wt-api-provider").value;
    const meta = getProviderMeta(provider);
    if (!meta.enabled) { setStatus("该服务尚未接入，请先选择已启用的服务"); return; }
    const managed = meta.managedConfig === true;
    const name = managed ? meta.label : (get("wt-api-name").value || "").trim();
    const baseUrl = ((managed ? meta.baseUrl : (get("wt-api-baseurl").value || "")) || "").trim().replace(/\/+$/, "");
    const apiKey = (get("wt-api-key").value || "").trim();
    const model = meta.requiresModel === false ? "" : (get("wt-api-model").value || "").trim();
    if (!name) { setStatus("请填写名称"); return; }
    const noCred = meta.noCredentials === true;
    const apiKeyRequired = !noCred && meta.apiKeyOptional !== true;
    const requiresModel = meta.requiresModel !== false;
    if (apiKeyRequired && !apiKey) { setStatus("请填写 API Key"); return; }
    if (requiresModel && !noCred && !model) { setStatus("请选择或填写模型"); return; }
    const api = { name, provider, baseUrl, apiKey, model };
    if (editingIndex >= 0) {
      data.apis[editingIndex] = api;
    } else {
      data.apis.push(api);
    }
    if (data.apis.length === 1) data.activeApiIndex = 0;
    closeEditor();
    save(true);
  }

  /**
   * ?????????????????????? window.prompt??
   * @param {string[]} ids ?? ID ??
   * @returns {Promise<string|null>} ??????? ID????? null
   */
  function showModelPicker(ids) {
    return new Promise((resolve) => {
      const overlay = document.createElementNS(HTML_NS, "div");
      overlay.setAttribute("class", "wt-modal-overlay");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:9999;";

      const dlg = document.createElementNS(HTML_NS, "div");
      dlg.style.cssText = "background:Canvas;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.25);width:480px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;padding:16px;";

      const title = document.createElementNS(HTML_NS, "div");
      title.style.cssText = "font-weight:600;font-size:14px;margin-bottom:8px;color:CanvasText;";
      title.textContent = "Found " + ids.length + " models. Click to select. Use the search box to filter.";
      dlg.appendChild(title);

      const search = document.createElementNS(HTML_NS, "input");
      search.type = "text";
      search.placeholder = "Search model id...";
      search.style.cssText = "width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid ThreeDShadow;border-radius:6px;margin-bottom:8px;font-size:13px;background:Field;color:FieldText;";
      dlg.appendChild(search);

      const listBox = document.createElementNS(HTML_NS, "div");
      listBox.style.cssText = "flex:1;min-height:240px;max-height:50vh;overflow-y:auto;border:1px solid ThreeDShadow;border-radius:6px;background:ButtonFace;";
      dlg.appendChild(listBox);

      function renderList(filter) {
        listBox.replaceChildren();
        const f = (filter || "").trim().toLowerCase();
        const matched = f ? ids.filter((x) => String(x).toLowerCase().includes(f)) : ids;
        if (matched.length === 0) {
          const empty = document.createElementNS(HTML_NS, "div");
          empty.style.cssText = "padding:20px;color:GrayText;text-align:center;font-size:13px;";
          empty.textContent = "No matches";
          listBox.appendChild(empty);
          return;
        }
        matched.forEach((mid) => {
          const row = document.createElementNS(HTML_NS, "div");
          row.style.cssText = "padding:6px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid ThreeDShadow;word-break:break-all;color:CanvasText;";
          row.textContent = mid;
          row.addEventListener("mouseenter", () => { row.style.background = "color-mix(in srgb, Highlight 20%, Canvas)"; });
          row.addEventListener("mouseleave", () => { row.style.background = ""; });
          row.addEventListener("click", () => { cleanup(mid); });
          listBox.appendChild(row);
        });
        const note = document.createElementNS(HTML_NS, "div");
        note.style.cssText = "padding:6px 12px;color:GrayText;font-size:12px;text-align:right;";
        note.textContent = "Showing " + matched.length + " / " + ids.length;
        listBox.appendChild(note);
      }
      renderList("");

      let picked = null;
      function cleanup(val) {
        picked = val;
        try { overlay.remove(); } catch (e) {}
        resolve(picked);
      }
      search.addEventListener("input", () => renderList(search.value));
      search.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          const f = search.value.trim();
          if (f && ids.includes(f)) cleanup(f);
          else {
            const rows = listBox.querySelectorAll("div");
            for (const r of rows) {
              const t = r.textContent;
              if (t && ids.includes(t) && r.style.cursor === "pointer") { cleanup(t); return; }
            }
          }
        } else if (ev.key === "Escape") {
          cleanup(null);
        }
      });

      const btnBar = document.createElementNS(HTML_NS, "div");
      btnBar.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:10px;";
      const cancel = document.createElementNS(HTML_NS, "button");
      cancel.textContent = "Cancel";
      cancel.style.cssText = "padding:5px 16px;border:1px solid ThreeDShadow;background:ButtonFace;border-radius:6px;cursor:pointer;color:ButtonText;";
      cancel.addEventListener("click", () => cleanup(null));
      btnBar.appendChild(cancel);
      dlg.appendChild(btnBar);

      overlay.appendChild(dlg);
      document.getElementById("wordtranslator-pref-root").appendChild(overlay);
      overlay.addEventListener("click", (ev) => { if (ev.target === overlay) cleanup(null); });
      setTimeout(() => { try { search.focus(); } catch (e) {} }, 50);
    });
  }

  async function fetchModels() {
    const prov = get("wt-api-provider").value;
    const baseUrl = (get("wt-api-baseurl").value || "").trim().replace(/\/+$/, "");
    const apiKey = (get("wt-api-key").value || "").trim();
    if (!baseUrl) { setStatus("Please fill in API URL first"); return; }
    if (!apiKey) { setStatus("Please fill in API Key first"); return; }
    let url = baseUrl + "/models";
    setStatus("Fetching model list...");
    try {
      const resp = await Zotero.HTTP.request("GET", url, {
        headers: { Authorization: "Bearer " + apiKey },
        responseType: "json",
      });
      if (resp.status !== 200) {
        setStatus("Fetch failed (" + resp.status + ")");
        return;
      }
      const list = (resp.response && (resp.response.data || resp.response)) || [];
      const ids = Array.isArray(list) ? list.map((x) => x && (x.id || x)).filter(Boolean) : [];
      if (ids.length === 0) {
        setStatus("No models found in response");
        return;
      }
      const picked = await showModelPicker(ids);
      if (picked && picked.trim()) {
        get("wt-api-model").value = picked.trim();
        setStatus("Filled model: " + picked.trim());
      } else {
        setStatus("Cancelled");
      }
    } catch (e) {
      setStatus("Fetch failed: " + (e && e.message || e));
    }
  }

  

  async function testApi() {
    setStatus("正在测试…");
    const provider = get("wt-api-provider").value;
    const meta = getProviderMeta(provider);
    const managed = meta.managedConfig === true;
    const name = managed ? meta.label : (get("wt-api-name").value || "").trim();
    const baseUrl = ((managed ? meta.baseUrl : (get("wt-api-baseurl").value || "")) || "").trim().replace(/\/+$/, "");
    const apiKey = (get("wt-api-key").value || "").trim();
    const model = meta.requiresModel === false ? "" : (get("wt-api-model").value || "").trim();
    const requiresApiKey = meta.noCredentials !== true && meta.apiKeyOptional !== true;
    const requiresModel = meta.requiresModel !== false;
    if ((requiresApiKey && !apiKey) || (requiresModel && !model)) { setStatus("请先填写必填配置项"); return; }
    const api = { provider, baseUrl, apiKey, model, name };
    try {
      const ok = await Zotero.WordTranslator.testApi(api);
      setStatus(ok ? "测试成功 ✓" : "测试失败（请检查 Key / URL / 模型）");
    } catch (e) {
      setStatus("测试失败：" + (e && e.message || e));
    }
  }

  // ----- 构建面板 -----
  function getApiConfigFilePath() {
    try {
      if (Zotero && Zotero.WordTranslator) {
        if (Zotero.WordTranslator.apiConfigPath) return String(Zotero.WordTranslator.apiConfigPath);
        if (typeof Zotero.WordTranslator.getApiConfigPath === "function") {
          return Zotero.WordTranslator.getApiConfigPath();
        }
      }
    } catch (e0) {}
    return "";
  }

  function getWordsDirPath() {
    try {
      if (Zotero && Zotero.WordTranslator) {
        if (Zotero.WordTranslator.wordsDirPath) return String(Zotero.WordTranslator.wordsDirPath);
        if (typeof Zotero.WordTranslator.getWordsDirPath === "function") {
          return Zotero.WordTranslator.getWordsDirPath();
        }
      }
    } catch (e0) {}
    return "";
  }

  function openFolderOfPrefs() {
    try {
      if (Zotero && Zotero.WordTranslator && typeof Zotero.WordTranslator.openDataDir === "function") {
        Zotero.WordTranslator.openDataDir();
        return;
      }
      setStatus("无法打开数据目录");
    } catch (e) {
      debugLog("openFolderOfPrefs ERROR: " + (e && e.message || e));
    }
  }

  function buildPrefsPane() {
    const root = get("wordtranslator-pref-root");
    if (!root) return false;
    root.replaceChildren();

    const style = el("style", {}, [txt(`
      #wordtranslator-pref-root { font-family: system-ui, "Segoe UI", sans-serif; font-size: 13px; line-height: 1.5; color: CanvasText; color-scheme: light dark; }
      #wordtranslator-pref-root h2 { font-size: 16px; margin: 0 0 16px; }
      #wordtranslator-pref-root h3 { font-size: 14px; margin: 18px 0 8px; }
      #wordtranslator-pref-root .wt-section { margin-bottom: 18px; }
      #wordtranslator-pref-root .wt-row { margin: 8px 0; display: flex; flex-direction: column; gap: 4px; }
      #wordtranslator-pref-root .wt-row-inline { margin: 8px 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      #wordtranslator-pref-root .wt-label { font-weight: 500; }
      #wordtranslator-pref-root .wt-input,
      #wordtranslator-pref-root .wt-textarea,
      #wordtranslator-pref-root .wt-select {
        padding: 6px 10px; border: 1px solid ThreeDShadow; border-radius: 6px; background: Field; color: FieldText; font: inherit;
        box-sizing: border-box;
      }
      #wordtranslator-pref-root .wt-input { width: 360px; max-width: 100%; }
      #wordtranslator-pref-root .wt-textarea { width: 100%; resize: vertical; }
      #wordtranslator-pref-root .wt-select { width: 220px; max-width: 100%; }
      /* 服务商下拉：大类名(optgroup)最左不加粗突出，小类(option)首行缩进，形成层级 */
      #wordtranslator-pref-root .wt-select optgroup { font-weight: 700; }
      #wordtranslator-pref-root .wt-select optgroup option { font-weight: 400; padding-left: 14px; }
      #wordtranslator-pref-root .wt-hint { color: GrayText; font-size: 12px; margin: 2px 0 0; }
      #wordtranslator-pref-root .wt-actions { display: flex; gap: 8px; margin: 10px 0; flex-wrap: wrap; }
      #wordtranslator-pref-root .wt-btn {
        padding: 6px 16px; border: 1px solid ThreeDShadow; border-radius: 6px; background: ButtonFace; cursor: pointer; font-size: 13px;
        color: ButtonText;
      }
      #wordtranslator-pref-root .wt-btn:hover { background: color-mix(in srgb, ButtonFace 90%, ButtonText); }
      #wordtranslator-pref-root .wt-btn-primary {
        background: Highlight; color: HighlightText; border-color: Highlight;
      }
      #wordtranslator-pref-root .wt-btn-primary:hover { background: color-mix(in srgb, Highlight 80%, black); }
      #wordtranslator-pref-root .wt-btn-mini { padding: 2px 10px; font-size: 12px; }
      #wordtranslator-pref-root .wt-btn-danger { border-color: #c66; color: #e4717a; }
      #wordtranslator-pref-root .wt-table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      #wordtranslator-pref-root .wt-table th, #wordtranslator-pref-root .wt-table td {
        border-bottom: 1px solid ThreeDShadow; padding: 6px 8px; text-align: left; vertical-align: middle;
      }
      #wordtranslator-pref-root .wt-table th { background: color-mix(in srgb, Canvas 96%, CanvasText); font-weight: 600; font-size: 12px; }
      #wordtranslator-pref-root .wt-table tr.selected td { background: color-mix(in srgb, Highlight 20%, Canvas); }
      #wordtranslator-pref-root .wt-api-editor {
        border: 1px solid ThreeDShadow; border-radius: 8px; padding: 14px 16px; margin-top: 12px;
        background: color-mix(in srgb, Canvas 98%, CanvasText); box-shadow: 0 1px 4px rgba(0,0,0,0.04);
      }
      #wordtranslator-pref-root .wt-status { color: Highlight; font-weight: 500; }
      #wordtranslator-pref-root .wt-api-status { font-size: 12px; color: GrayText; white-space: nowrap; }
      #wordtranslator-pref-root .wt-provider-placeholder { display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap; padding:10px 12px; border:1px dashed ThreeDShadow; border-radius:8px; background:color-mix(in srgb, Canvas 98%, CanvasText); }
      #wordtranslator-pref-root .wt-provider-placeholder-title { font-weight:600; color:CanvasText; }
      #wordtranslator-pref-root .wt-provider-placeholder-items { color:GrayText; }
      #wordtranslator-pref-root .wt-divider { border: none; border-top: 1px solid ThreeDShadow; margin: 18px 0 0; }
      #wordtranslator-pref-root .wt-fetch-btn { padding: 6px 12px; }
      #wordtranslator-pref-root .wt-test-btn { padding: 6px 12px; color: Highlight; border-color: Highlight; background: Field; }
      #wordtranslator-pref-root input[type="checkbox"], #wordtranslator-pref-root input[type="radio"] { accent-color: Highlight; }
    `)]);

    const title = el("h2", {}, [txt("说明")]);

    const intro = el("p", { class: "wt-hint", style: "margin: -8px 0 16px;" }, [
      txt("划词后点击「添加单词并翻译」，翻译结果会追加到 PDF 右侧的单词本面板。"),
    ]);

    // —— 常规 ——
    const sectionGeneral = el("section", { class: "wt-section" }, [
      el("h3", {}, [txt("常规")]),
      el("div", { class: "wt-row" }, [
        el("label", { class: "wt-label", for: "wt-context-label" }, [txt("阅读器划词菜单项名称")]),
        (() => { const i = el("input", { type: "text", class: "wt-input", id: "wt-context-label" }); return i; })(),
        el("p", { class: "wt-hint" }, [txt("划选文字后，在阅读器弹出菜单中显示的入口名称。")]),
      ]),
      el("div", { class: "wt-row-inline" }, [
        (() => { const c = el("input", { type: "checkbox", id: "wt-enabled" }); return c; })(),
        (() => {
          const lbl = el("label", { for: "wt-enabled" }, [
            txt("启用「"),
            el("span", { id: "wt-enabled-label", class: "wt-link-text" }, [txt("添加单词并翻译")]),
            txt("」菜单项"),
          ]);
          return lbl;
        })(),
      ]),
      el("div", { class: "wt-row-inline" }, [
        (() => { const c = el("input", { type: "checkbox", id: "wt-auto-translate" }); return c; })(),
        el("label", { for: "wt-auto-translate" }, [txt("选中文本后自动翻译并加入单词本")]),
      ]),
      el("div", { class: "wt-row-inline", style: "margin-top:6px;" }, [
        (() => { const c = el("input", { type: "checkbox", id: "wt-addword-hotkey-enabled" }); return c; })(),
        (() => {
          const link = el("span", {
            id: "wt-addword-link",
            class: "wt-link",
            title: "这个菜单项名称可以修改",
            tabindex: "0",
            role: "link",
            style: "color:LinkText;text-decoration:underline;cursor:pointer;outline:none;",
          }, [txt("「添加单词并翻译」")]);
          const lbl = el("label", { for: "wt-addword-hotkey-enabled" }, [
            txt("绑定"),
            link,
            txt("快捷键（先选区后按绑定键触发）"),
          ]);
          return lbl;
        })(),
      ]),
      el("div", { class: "wt-row", id: "wt-addword-hotkey-wrap", style: "margin:4px 0 0 22px;" }, [
        // 触发方式单选：Ctrl / Alt / Shift / 自定义绑定按键（Mouse4/Mouse5 在 Zotero 中无法被监听，已移除）
        el("div", { class: "wt-row-inline", style: "gap:14px;flex-wrap:wrap;" }, [
          (() => {
            const l = el("label", { style: "display:inline-flex;align-items:center;gap:4px;" }, [
              (() => { const r = el("input", { type: "radio", name: "wt-addword-mode", id: "wt-addword-mode-ctrl", value: "ctrl" }); return r; })(),
              txt("Ctrl"),
            ]);
            return l;
          })(),
          (() => {
            const l = el("label", { style: "display:inline-flex;align-items:center;gap:4px;" }, [
              (() => { const r = el("input", { type: "radio", name: "wt-addword-mode", id: "wt-addword-mode-alt", value: "alt" }); return r; })(),
              txt("Alt"),
            ]);
            return l;
          })(),
          (() => {
            const l = el("label", { style: "display:inline-flex;align-items:center;gap:4px;" }, [
              (() => { const r = el("input", { type: "radio", name: "wt-addword-mode", id: "wt-addword-mode-shift", value: "shift" }); return r; })(),
              txt("Shift"),
            ]);
            return l;
          })(),
          (() => {
            const l = el("label", { style: "display:inline-flex;align-items:center;gap:4px;" }, [
              (() => { const r = el("input", { type: "radio", name: "wt-addword-mode", id: "wt-addword-mode-custom", value: "custom" }); return r; })(),
              txt("自定义绑定按键"),
            ]);
            return l;
          })(),
        ]),
        el("div", { class: "wt-row", id: "wt-addword-custom-wrap", style: "margin:6px 0 0 4px;display:none;" }, [
          el("label", { class: "wt-label", for: "wt-addword-hotkey" }, [txt("绑定按键")]),
          (() => {
            const inp = el("input", { type: "text", id: "wt-addword-hotkey", class: "wt-input", readonly: "readonly", placeholder: "双击此处设置（如 Ctrl+Enter、Alt+Z）" });
            return inp;
          })(),
        ]),
        el("p", { class: "wt-hint", id: "wt-addword-mode-hint", style: "width:100%;margin-top:4px;" }, [txt("先选中单词，再按下绑定按键，立即执行「添加单词并翻译」。")]),
      ]),
      // —— 快捷键-划词翻译（二选一，互斥）——
      el("div", { class: "wt-row-inline", style: "gap:16px;margin-top:6px;" }, [
        (() => {
          const l = el("label", { style: "display:inline-flex;align-items:center;gap:4px;" }, [
            (() => { const c = el("input", { type: "checkbox", id: "wt-hotkey-enabled" }); return c; })(),
            txt("快捷键-划词翻译"),
          ]);
          return l;
        })(),
        (() => {
          const l = el("label", { style: "display:inline-flex;align-items:center;gap:4px;" }, [
            (() => { const c = el("input", { type: "checkbox", id: "wt-hotkey-custom-enabled" }); return c; })(),
            txt("自定义快捷键"),
          ]);
          return l;
        })(),
      ]),
      el("p", { class: "wt-hint", id: "wt-hotkey-hint", style: "margin:-2px 0 6px;" }, [txt("划词快捷键已关闭。")]),
      el("div", { class: "wt-row", id: "wt-hotkey-mod-wrap", style: "margin:4px 0 0 22px;" }, [
        el("label", { class: "wt-label", for: "wt-hotkey-mod" }, [txt("快捷键组合")]),
        (() => {
          const sel = el("select", { class: "wt-select", id: "wt-hotkey-mod" });
          sel.append(el("option", { value: "ctrl" }, [txt("Ctrl")]));
          sel.append(el("option", { value: "alt" }, [txt("Alt")]));
          sel.append(el("option", { value: "ctrl+alt" }, [txt("Ctrl + Alt")]));
          return sel;
        })(),
        el("p", { class: "wt-hint", style: "width:100%;" }, [txt("按下组合键 + 划选文本，即自动翻译并加入单词本。组合键仅可选一种。")]),
      ]),
      el("div", { class: "wt-row", id: "wt-hotkey-custom-wrap", style: "margin:4px 0 0 22px;" }, [
        el("label", { class: "wt-label", for: "wt-hotkey-custom" }, [txt("自定义快捷键")]),
        (() => {
          const inp = el("input", { type: "text", id: "wt-hotkey-custom", class: "wt-input", readonly: "readonly", placeholder: "双击此处设置（如 Ctrl+D、Alt+1）" });
          return inp;
        })(),
        el("p", { class: "wt-hint", style: "width:100%;" }, [txt("双击输入框后按组合键进行录制。支持 Ctrl/Alt/Shift + 字母或数字。")]),
      ]),
      el("div", { class: "wt-row-inline", style: "align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;" }, [
        el("label", { class: "wt-label", for: "wt-selection-mode", style: "min-width:auto;" }, [txt("选区翻译模式")]),
        (() => {
          const sel = el("select", { class: "wt-select", id: "wt-selection-mode" });
          const word = el("option", { value: "word", title: "本插件默认模式，即对选中的单词数有要求。" }, [txt("单词模式")]);
          const sentence = el("option", { value: "sentence", title: "本插件扩展模式，即对选中的单词数无要求。" }, [txt("句子模式")]);
          sel.append(word, sentence);
          return sel;
        })(),
        el("p", { class: "wt-hint", id: "wt-selection-mode-hint", style: "width:100%;margin:0 0 0 0;" }, [txt("")]),
      ]),
    ]);

    // —— 外观 ——
    const sectionAppearance = el("section", { class: "wt-section", id: "wt-font-size-section" }, [
      el("h3", {}, [txt("外观")]),
      el("div", { class: "wt-row-inline", style: "align-items:center;gap:8px;flex-wrap:wrap;" }, [
        el("label", { class: "wt-label", for: "wt-font-size", style: "min-width:auto;" }, [txt("单词本字体大小")]),
        (() => { const r = el("input", { type: "range", id: "wt-font-size-range", min: "9", max: "24", step: "1" }); r.style.width = "180px"; return r; })(),
        (() => { const n = el("input", { type: "number", id: "wt-font-size", min: "9", max: "24", step: "1" }); n.style.width = "64px"; return n; })(),
        el("span", { style: "color:#888;font-size:12px;" }, [txt("px")]),
        (() => { const b = el("button", { type: "button", class: "wt-btn wt-btn-mini", id: "wt-reset-font-size" }, [txt("恢复默认")]); return b; })(),
      ]),
      el("p", { class: "wt-hint" }, [txt("范围 9–24，默认 13。也可在字本面板头部点击“放大/缩小”按钮调整。")]),
      el("div", { class: "wt-row-inline", style: "align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;" }, [
        el("label", { class: "wt-label", for: "wt-page-size", style: "min-width:auto;" }, [txt("每页显示单词数")]),
        (() => { const n = el("input", { type: "number", id: "wt-page-size", min: "1", max: "100", step: "1" }); n.style.width = "64px"; return n; })(),
        el("span", { style: "color:#888;font-size:12px;" }, [txt("个")]),
        (() => { const b = el("button", { type: "button", class: "wt-btn wt-btn-mini", id: "wt-reset-page-size" }, [txt("恢复默认")]); return b; })(),
      ]),
      el("p", { class: "wt-hint" }, [txt("范围 1–100，默认 10。单词本底部会出现上一页/下一页按钮。")]),
    ]);

    // —— 搜索-匹配层设置 ——
    const STRATEGY_LABELS = {
      prefix: "前缀匹配：按单词开头匹配",
      all: "所有匹配：匹配单词或释义",
      wordOnly: "只搜单词：仅匹配英文单词",
      exact: "精确匹配：完全匹配单词",
    };
    const sectionSearch = el("section", { class: "wt-section", id: "wt-search-strategy-section" }, [
      el("h3", {}, [txt("搜索-匹配层设置")]),
      el("p", { class: "wt-hint", style: "margin: -4px 0 8px;" }, [
        txt("选择搜索单词本时使用的匹配策略。更改后立即生效。"),
      ]),
      el("div", { class: "wt-row-inline", style: "align-items:center;gap:8px;flex-wrap:wrap;" }, [
        el("label", { class: "wt-label", for: "wt-search-strategy", style: "min-width:auto;" }, [txt("搜索策略")]),
        (() => {
          const sel = el("select", { id: "wt-search-strategy", style: "flex:1;min-width:200px;font-size:12px;padding:2px 6px;" });
          const keys = ["prefix", "all", "wordOnly", "exact"];
          keys.forEach((k) => {
            const opt = el("option", { value: k }, [txt(STRATEGY_LABELS[k] || k)]);
            sel.append(opt);
          });
          return sel;
        })(),
      ]),
    ]);

    // —— 提示词 ——
    const sectionPrompt = el("section", { class: "wt-section" }, [
      el("h3", {}, [txt("提示词")]),
      el("p", { class: "wt-hint", style: "margin: -4px 0 8px;" }, [
        txt("提示词用于告诉翻译模型怎么翻译你划选的单词/短语。可以选择「系统+用户」分开设置，或「全局提示词」一段式设置。"),
      ]),
      el("div", { class: "wt-row-inline", style: "gap:16px;" }, [
        (() => {
          const l1 = el("label", { style: "display:inline-flex;align-items:center;gap:4px;" }, [
            (() => { const r = el("input", { type: "radio", name: "wt-prompt-mode", id: "wt-prompt-mode-split", value: "split" }); return r; })(),
            txt("系统提示词 + 用户提示词"),
          ]);
          return l1;
        })(),
        (() => {
          const l2 = el("label", { style: "display:inline-flex;align-items:center;gap:4px;" }, [
            (() => { const r = el("input", { type: "radio", name: "wt-prompt-mode", id: "wt-prompt-mode-combined", value: "combined" }); return r; })(),
            txt("全局提示词"),
          ]);
          return l2;
        })(),
      ]),
      el("div", { id: "wt-prompt-split-wrap" }, [
        el("div", { class: "wt-row" }, [
          el("label", { class: "wt-label", for: "wt-prompt-system" }, [txt("系统提示词（System）")]),
          (() => { const t = el("textarea", { class: "wt-textarea", id: "wt-prompt-system", rows: "5" }); return t; })(),
          el("p", { class: "wt-hint" }, [txt("默认：定义翻译身份为「专业英文文献翻译助手」，要求只输出译法本身，不带解释。")]),
        ]),
        el("div", { class: "wt-row" }, [
          el("label", { class: "wt-label", for: "wt-prompt-user" }, [txt("用户提示词（User）")]),
          (() => { const t = el("textarea", { class: "wt-textarea", id: "wt-prompt-user", rows: "3" }); return t; })(),
          el("p", { class: "wt-hint" }, [txt("默认：请将 {{word}} 替换为你选中的英文单词或短语（如 Glycolytic/Gluconeogenesis Pathway）。")]),
        ]),
      ]),
      el("div", { class: "wt-row", id: "wt-prompt-global-wrap", style: "display:none;" }, [
        el("label", { class: "wt-label", for: "wt-prompt-global" }, [txt("全局提示词")]),
        (() => { const t = el("textarea", { class: "wt-textarea", id: "wt-prompt-global", rows: "7" }); return t; })(),
        el("p", { class: "wt-hint" }, [txt("默认：将系统提示词与用户提示词合并为一段，{{word}} 会替换为你选中的单词/短语。")]),
      ]),
      el("div", { class: "wt-actions" }, [
        (() => {
          const b = el("button", { type: "button", class: "wt-btn", id: "wt-reset-prompts" }, [txt("恢复默认")]);
          return b;
        })(),
      ]),
    ]);

    // ———— API 配置 ————
    const sectionApis = el("section", { class: "wt-section" }, [
      el("h3", {}, [txt("翻译 API")]),
      el("p", { class: "wt-hint", style: "margin: -4px 0 8px;" }, [
        txt("支持多个服务商（中转站）。点击行可编辑；点 + 添加服务商可新增。"),
      ]),
      el("table", { class: "wt-table" }, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", { style: "width: 60px;" }, [txt("默认")]),
            el("th", {}, [txt("名称")]),
            el("th", { style: "width: 110px;" }, [txt("服务商")]),
            el("th", { style: "width: 110px;" }, [txt("分类")]),
            el("th", {}, [txt("模型")]),
            el("th", { style: "width: 75px;" }, [txt("状态")]),
            el("th", { style: "width: 130px;" }, [txt("操作")]),
          ]),
        ]),
        el("tbody", { id: "wt-apis-tbody" }),
      ]),
      el("div", { class: "wt-actions" }, [
        (() => {
          const b = el("button", { type: "button", class: "wt-btn wt-btn-primary", id: "wt-api-add" }, [txt("+ 添加服务商")]);
          return b;
        })(),
      ]),

      // 编辑面板（名称 + 获取模型 + 测试）
      el("div", { id: "wt-api-editor", class: "wt-api-editor", hidden: "hidden" }, [
        el("h3", { id: "wt-api-editor-title", style: "margin-top: 0;" }, [txt("添加服务商")]),
        el("div", { class: "wt-row" }, [
          el("label", { class: "wt-label", for: "wt-api-provider" }, [txt("服务商")]),
          (() => {
            const s = el("select", { class: "wt-select", id: "wt-api-provider" });
            renderProviderOptions(s, "openai");
            return s;
          })(),
        ]),
        el("div", { class: "wt-row", id: "wt-api-name-row" }, [
          el("label", { class: "wt-label", for: "wt-api-name" }, [txt("名称（仅用于区分不同中转站）")]),
          (() => { const i = el("input", { type: "text", class: "wt-input", id: "wt-api-name", placeholder: "如：中转站 A / OpenAI 官方 / DeepSeek" }); return i; })(),
        ]),
        el("div", { class: "wt-row", id: "wt-api-baseurl-row" }, [
          el("label", { class: "wt-label", for: "wt-api-baseurl" }, [txt("API URL")]),
          (() => { const i = el("input", { type: "text", class: "wt-input", id: "wt-api-baseurl", placeholder: "https://api.openai.com/v1" }); return i; })(),
          el("p", { class: "wt-hint" }, [txt("选择 OpenAI / DeepSeek 时会自动填默认值；选「自定义」可填任意中转站完整基础 URL。")]),
        ]),
        el("div", { class: "wt-row", id: "wt-api-key-row" }, [
          el("label", { class: "wt-label", for: "wt-api-key" }, [txt("API 密钥")]),
          (() => { const i = el("input", { type: "password", class: "wt-input", id: "wt-api-key" }); return i; })(),
        ]),
        el("div", { class: "wt-row", id: "wt-api-model-row" }, [
          el("label", { class: "wt-label", for: "wt-api-model" }, [txt("模型名称")]),
          el("div", { class: "wt-row-inline", style: "width: 100%;" }, [
            (() => { const i = el("input", { type: "text", class: "wt-input", id: "wt-api-model", placeholder: "如 gpt-4o-mini", style: "flex: 1; min-width: 0;" }); return i; })(),
            (() => { const b = el("button", { type: "button", class: "wt-btn wt-fetch-btn", id: "wt-api-fetch-models", title: "从 API 获取可用模型" }, [txt("+ 获取模型")]); return b; })(),
          ]),
        ]),
        el("div", { class: "wt-actions" }, [
          (() => { const b = el("button", { type: "button", class: "wt-btn wt-test-btn", id: "wt-api-test" }, [txt("测试")]); return b; })(),
          (() => { const b = el("button", { type: "button", class: "wt-btn wt-btn-primary", id: "wt-api-save" }, [txt("保存")]); return b; })(),
          (() => { const b = el("button", { type: "button", class: "wt-btn", id: "wt-api-cancel" }, [txt("取消")]); return b; })(),
        ]),
      ]),
    ]);

    const sectionDictionary = el("section", { class: "wt-section", id: "wt-dictionary-services" }, [
    el("h3", {}, [txt("字典服务")]),
    el("p", { class: "wt-hint", style: "margin: -4px 0 8px;" }, [
      txt("字典服务用于补充音标、词性、释义、例句和发音；将在翻译服务框架稳定后逐步接入。"),
    ]),
    el("div", { class: "wt-provider-placeholder" }, [
      el("span", { class: "wt-provider-placeholder-title" }, [txt("计划支持")]),
      el("span", { class: "wt-provider-placeholder-items" }, [txt("有道词典 · 必应词典 · FreeDictionary API · 剑桥词典")]),
    ]),
  ]);

    // —— 状态 ——
        // —— 保存目录 ——
    const apiConfigPath = getApiConfigFilePath();
    const wordsDirPath = getWordsDirPath();
    const sectionSaveDir = el("section", { class: "wt-section", id: "wt-save-dir" }, [
      el("h3", {}, [txt("保存目录")]),
      el("div", { class: "wt-row" }, [
        el("label", { class: "wt-label" }, [txt("单词本保存在")]),
        el("div", { class: "wt-row-inline", style: "margin:4px 0;" }, [
          (() => { const inp = el("input", { type: "text", readonly: "readonly", class: "wt-input", id: "wt-prefs-path", style: "flex:1;min-width:0;color:GrayText;font-size:12px;background:ButtonFace;" }); inp.value = wordsDirPath; return inp; })(),
          (() => { const b = el("button", { type: "button", class: "wt-btn wt-btn-mini", id: "wt-open-prefs-dir" }, [txt("浏览")]); return b; })(),
        ]),
      ]),
      el("div", { class: "wt-row" }, [
        el("label", { class: "wt-label" }, [txt("接口配置保存在")]),
        el("div", { class: "wt-row-inline", style: "margin:4px 0;" }, [
          (() => { const inp = el("input", { type: "text", readonly: "readonly", class: "wt-input", id: "wt-prefs-path2", style: "flex:1;min-width:0;color:GrayText;font-size:12px;background:ButtonFace;" }); inp.value = apiConfigPath; return inp; })(),
          (() => { const b = el("button", { type: "button", class: "wt-btn wt-btn-mini", id: "wt-open-prefs-dir2" }, [txt("浏览")]); return b; })(),
        ]),
      ]),
      el("p", { class: "wt-hint" }, [txt("以上数据存在 Zotero 配置目录下的 wordtranslator 文件夹中（本地缓存，不会上传）。点击“浏览”可打开该文件夹。")]),
    ]);

    const aboutVer = typeof Zotero.WordTranslator !== "undefined" && Zotero.WordTranslator.addonVersion
      ? Zotero.WordTranslator.addonVersion
      : (typeof addonVersion !== "undefined" ? addonVersion : "4.0.1");
    const aboutBuild = typeof Zotero.WordTranslator !== "undefined" && Zotero.WordTranslator.buildTime
      ? Zotero.WordTranslator.buildTime
      : "";
    const sectionAbout = el("section", { class: "wt-section", id: "wt-about" }, [
      el("h3", {}, [txt("关于")]),
      el("div", { class: "wt-row-inline", style: "margin:4px 0;" }, [
        el("span", { class: "wt-label" }, [txt("Word Translator 版本 " + aboutVer)]),
        (aboutBuild ? el("span", { style: "color:GrayText;font-size:12px;" }, [txt("修改时间 " + aboutBuild)]) : null),
      ]),
      el("div", { class: "wt-row-inline", style: "margin:4px 0;" }, [
        (() => {
          const a = el("a", { id: "wt-github-link", href: "https://github.com/chen7447/word-translator-zotero", target: "_blank", rel: "noopener noreferrer", style: "color:LinkText;text-decoration:underline;cursor:pointer;" }, [txt("Github")]);
          return a;
        })(),
      ]),
    ]);

    const footer = el("div", {}, [
      el("hr", { class: "wt-divider" }),
    ]);
    const statusBar = el("p", { id: "wt-status", class: "wt-status", style: "margin: 8px 0 0;" }, [txt("就绪")]);

    root.append(style, title, intro, sectionGeneral, sectionAppearance, sectionSearch, sectionPrompt, sectionApis, sectionDictionary, statusBar, sectionSaveDir, sectionAbout, footer);
    return true;
  }

  function bindEvents() {
    function bind(id, evt, fn) {
      const e = get(id);
      if (e) e.addEventListener(evt, fn);
    }
    bind("wt-open-prefs-dir", "click", () => openFolderOfPrefs());
    bind("wt-open-prefs-dir2", "click", () => openFolderOfPrefs());
    const gh = get("wt-github-link");
    if (gh) {
      gh.addEventListener("click", (ev) => {
        try {
          ev.preventDefault();
          ev.stopPropagation();
          const url = gh.getAttribute("href") || gh.href;
          if (Zotero && Zotero.WordTranslator && typeof Zotero.WordTranslator.openExternalURL === "function") {
            Zotero.WordTranslator.openExternalURL(url);
          } else {
            setStatus("无法打开外部浏览器");
          }
        } catch (e) { debugLog("github click ERROR: " + (e && e.message || e)); }
      }, true);
    }
    bind("wt-api-add", "click", () => openEditor(-1));
    bind("wt-api-save", "click", saveApi);
    bind("wt-api-cancel", "click", closeEditor);
    bind("wt-api-test", "click", testApi);
    bind("wt-api-fetch-models", "click", fetchModels);
    bind("wt-api-provider", "change", () => updateProviderPreset(true));

    bind("wt-reset-prompts", "click", () => {
      if (data.promptMode === "combined") {
        data.promptGlobal = DEFAULT_PROMPT_GLOBAL;
        const pg = get("wt-prompt-global");
        if (pg) pg.value = DEFAULT_PROMPT_GLOBAL;
      } else {
        data.promptSystem = DEFAULT_PROMPT_SYSTEM;
        data.promptUser = DEFAULT_PROMPT_USER;
        const ps = get("wt-prompt-system");
        const pu = get("wt-prompt-user");
        if (ps) ps.value = DEFAULT_PROMPT_SYSTEM;
        if (pu) pu.value = DEFAULT_PROMPT_USER;
      }
      save(true);
    });

    const ctxLabel = get("wt-context-label");
    const syncContextLabelRefs = () => {
      try {
        const label = (data.contextMenuLabel || "").trim() || "添加单词并翻译";
        const enLbl = get("wt-enabled-label");
        if (enLbl) enLbl.textContent = label;
        const link = get("wt-addword-link");
        if (link) {
          // 使用 “「label」” 形式作为视觉提示
          while (link.firstChild) link.removeChild(link.firstChild);
          link.append(document.createTextNode("「" + label + "」"));
        }
      } catch (e) {}
    };
    if (ctxLabel) ctxLabel.addEventListener("input", () => {
      data.contextMenuLabel = ctxLabel.value;
      syncContextLabelRefs();
      save(false);
    });
    // Click on "「添加单词并翻译」" span inside the addword-hotkey label -> jump to context-menu-label.
    const addWordLink = get("wt-addword-link");
    if (addWordLink) {
      const jumpToCtx = function (ev) {
        try {
          if (ev) { ev.preventDefault(); ev.stopPropagation(); }
          const target = get("wt-context-label");
          if (!target) return;
          try { target.scrollIntoView({ block: "center" }); } catch (e2) {}
          try { target.focus(); } catch (e2) {}
          try { target.select && target.select(); } catch (e2) {}
        } catch (e3) {}
      };
      addWordLink.addEventListener("click", jumpToCtx, true);
      addWordLink.addEventListener("keydown", function (ev) {
        try {
          const k = (ev.key || "").toLowerCase();
          if (k === "enter" || k === " ") { jumpToCtx(ev); }
        } catch (e2) {}
      }, true);
      // Hover visual cue: emphasize underline on hover.
      addWordLink.addEventListener("mouseenter", function () {
        try { addWordLink.style.textDecoration = "underline double"; } catch (e2) {}
      }, true);
      addWordLink.addEventListener("mouseleave", function () {
        try { addWordLink.style.textDecoration = "underline"; } catch (e2) {}
      }, true);
    }
    const en = get("wt-enabled");
    if (en) en.addEventListener("change", () => { data.enabled = en.checked; save(false); });
    const at = get("wt-auto-translate");
    if (at) at.addEventListener("change", () => { data.autoTranslate = at.checked; save(false); });
    const hkEn = get("wt-hotkey-enabled");
    if (hkEn) hkEn.addEventListener("change", () => {
      // 互斥：开启“快捷键-划词翻译”必须先关闭“自定义快捷键”
      if (hkEn.checked) { syncHotkeyMutex("preset"); }
      data.hotkeyEnabled = hkEn.checked;
      save(false); applyHotkeyUI();
    });
    const hkMod = get("wt-hotkey-mod");
    if (hkMod) hkMod.addEventListener("change", () => { data.hotkeyModifier = hkMod.value; save(false); });
    const hkCustomEn = get("wt-hotkey-custom-enabled");
    if (hkCustomEn) hkCustomEn.addEventListener("change", () => {
      // 互斥：开启“自定义快捷键”必须先关闭“快捷键-划词翻译”
      if (hkCustomEn.checked) { syncHotkeyMutex("custom"); }
      data.customHotkeyEnabled = hkCustomEn.checked;
      save(false); applyHotkeyUI();
    });
    makeHotkeyRecorder("wt-hotkey-custom", (spec) => { data.customHotkey = spec; save(false); });
    const awEn = get("wt-addword-hotkey-enabled");
    if (awEn) awEn.addEventListener("change", () => {
      data.addWordHotkeyEnabled = awEn.checked;
      save(false); applyAddWordHotkeyUI();
    });
    ["ctrl", "alt", "shift", "custom"].forEach((mode) => {
      const r = get("wt-addword-mode-" + mode);
      if (r) r.addEventListener("change", () => {
        if (r.checked) {
          data.addWordHotkeyMode = mode;
          save(false); applyAddWordHotkeyUI();
        }
      });
    });
    makeHotkeyRecorder("wt-addword-hotkey", (spec) => {
      data.addWordHotkey = spec;
      // 录制即视为切到 custom 模式（如果尚未选中）
      if (data.addWordHotkeyMode !== "custom") {
        data.addWordHotkeyMode = "custom";
      }
      save(false); applyAddWordHotkeyUI();
    });

    const rSplit = get("wt-prompt-mode-split");
    if (rSplit) rSplit.addEventListener("change", () => { data.promptMode = "split"; save(false); applyPromptModeUI(); });
    const rCombined = get("wt-prompt-mode-combined");
    if (rCombined) rCombined.addEventListener("change", () => { data.promptMode = "combined"; save(false); applyPromptModeUI(); });
    const ps = get("wt-prompt-system");
    if (ps) ps.addEventListener("input", () => { data.promptSystem = ps.value; save(false); });
    const pu = get("wt-prompt-user");
    if (pu) pu.addEventListener("input", () => { data.promptUser = pu.value; save(false); });
    const pg = get("wt-prompt-global");
    if (pg) pg.addEventListener("input", () => { data.promptGlobal = pg.value; save(false); });

    bind("wt-reset-font-size", "click", () => {
      data.fontSize = 13;
      const num = get("wt-font-size"); if (num) num.value = "13";
      const rng = get("wt-font-size-range"); if (rng) rng.value = "13";
      save(true);
    });

    const fnum = get("wt-font-size");
    const frng = get("wt-font-size-range");
    if (fnum) fnum.addEventListener("input", () => {
      let v = parseInt(fnum.value, 10);
      if (!Number.isFinite(v)) v = 13;
      if (v < 9) v = 9; if (v > 24) v = 24;
      data.fontSize = v;
      if (frng) frng.value = String(v);
      save(false);
    });
    if (frng) frng.addEventListener("input", () => {
      let v = parseInt(frng.value, 10);
      if (!Number.isFinite(v)) v = 13;
      if (v < 9) v = 9; if (v > 24) v = 24;
      data.fontSize = v;
      if (fnum) fnum.value = String(v);
      save(false);
    });

    bind("wt-reset-page-size", "click", () => {
      data.pageSize = 10;
      const num = get("wt-page-size"); if (num) num.value = "10";
      save(true);
    });
    const pageSizeInput = get("wt-page-size");
    if (pageSizeInput) pageSizeInput.addEventListener("input", () => {
      let v = parseInt(pageSizeInput.value, 10);
      if (!Number.isFinite(v)) v = 10;
      if (v < 1) v = 1; if (v > 100) v = 100;
      data.pageSize = v;
      if (String(pageSizeInput.value) !== String(v)) pageSizeInput.value = String(v);
      save(false);
    });

    const searchStrategySelect = get("wt-search-strategy");
    if (searchStrategySelect) searchStrategySelect.addEventListener("change", () => {
      data.searchStrategy = searchStrategySelect.value;
      save(false);
    });
    const selectionModeSelect = get("wt-selection-mode");
    const applySelectionModeUI = () => {
      const mode = selectionModeSelect && selectionModeSelect.value === "sentence" ? "sentence" : "word";
      const hint = get("wt-selection-mode-hint");
      if (hint) hint.textContent = mode === "sentence"
        ? "本插件扩展模式，即对选中的单词数无要求。"
        : "本插件默认模式，即对选中的单词数有要求。";
    };
    if (selectionModeSelect) selectionModeSelect.addEventListener("change", () => {
      data.selectionMode = selectionModeSelect.value === "sentence" ? "sentence" : "word";
      applySelectionModeUI();
      save(false);
    });
  }

  function renderForm() {
    const contextLabel = get("wt-context-label");
    const enabled = get("wt-enabled");
    const autoTranslate = get("wt-auto-translate");
    const hotkeyEnabled = get("wt-hotkey-enabled");
    const hotkeyMod = get("wt-hotkey-mod");
    const hotkeyCustomEnabled = get("wt-hotkey-custom-enabled");
    const hotkeyCustom = get("wt-hotkey-custom");
    const addWordHotkeyEnabled = get("wt-addword-hotkey-enabled");
    const addWordHotkey = get("wt-addword-hotkey");
    const promptSystem = get("wt-prompt-system");
    const promptUser = get("wt-prompt-user");
    const promptGlobal = get("wt-prompt-global");
    if (contextLabel) contextLabel.value = data.contextMenuLabel || "";
    try { syncContextLabelRefs(); } catch (e) {}
    if (enabled) enabled.checked = !!data.enabled;
    if (autoTranslate) autoTranslate.checked = !!data.autoTranslate;
    if (hotkeyEnabled) hotkeyEnabled.checked = !!data.hotkeyEnabled;
    if (hotkeyMod) {
      let hv = data.hotkeyModifier || "ctrl";
      if (hv === "shift" || hv === "ctrl+shift" || hv === "alt+shift") hv = "ctrl";
      hotkeyMod.value = hv;
    }
    if (hotkeyCustomEnabled) hotkeyCustomEnabled.checked = !!data.customHotkeyEnabled;
    if (hotkeyCustom) { hotkeyCustom.value = data.customHotkey || ""; hotkeyCustom.dataset.prev = data.customHotkey || ""; }
    if (addWordHotkeyEnabled) addWordHotkeyEnabled.checked = !!data.addWordHotkeyEnabled;
    if (addWordHotkey) { addWordHotkey.value = data.addWordHotkey || ""; addWordHotkey.dataset.prev = data.addWordHotkey || ""; }
    // 兼容旧数据：none / mouse3 / mouse4 / mouse5 自动迁移到 custom，避免全部未选
    if (!data.addWordHotkeyMode || data.addWordHotkeyMode === "none" ||
        data.addWordHotkeyMode === "mouse3" || data.addWordHotkeyMode === "mouse4" || data.addWordHotkeyMode === "mouse5") {
      data.addWordHotkeyMode = "custom";
    }
    applyAddWordHotkeyUI();
    if (promptSystem) promptSystem.value = data.promptSystem || DEFAULT_PROMPT_SYSTEM;
    if (promptUser) promptUser.value = data.promptUser || DEFAULT_PROMPT_USER;
    if (promptGlobal) promptGlobal.value = data.promptGlobal || DEFAULT_PROMPT_GLOBAL;
    applyPromptModeUI();
    applyHotkeyUI();
    applyAddWordHotkeyUI();
    const fontSize = get("wt-font-size");
    const fontSizeRange = get("wt-font-size-range");
    const fsVal = Number(data.fontSize) || 13;
    if (fontSize) fontSize.value = String(fsVal);
    if (fontSizeRange) fontSizeRange.value = String(fsVal);
    const pageSize = get("wt-page-size");
    if (pageSize) pageSize.value = String(Number(data.pageSize) || 10);
    const searchStrategy = get("wt-search-strategy");
    if (searchStrategy) searchStrategy.value = String(data.searchStrategy || "prefix");
    const selectionMode = get("wt-selection-mode");
    if (selectionMode) selectionMode.value = data.selectionMode === "sentence" ? "sentence" : "word";
    const selectionModeHint = get("wt-selection-mode-hint");
    if (selectionModeHint) selectionModeHint.textContent = data.selectionMode === "sentence"
      ? "本插件扩展模式，即对选中的单词数无要求。"
      : "本插件默认模式，即对选中的单词数有要求。";
  }

  function init() {
    try {
      let res = null;
      try {
        if (Zotero && Zotero.WordTranslator && typeof Zotero.WordTranslator.readApiConfigString === "function") {
          const s = Zotero.WordTranslator.readApiConfigString();
          if (s) { try { res = JSON.parse(s); } catch (e0) {} }
        }
      } catch (e0) {}
      if (!res) {
        const resStr = Zotero.Prefs.get("extensions.zotero.wordtranslator.config", true);
        if (resStr) { try { res = JSON.parse(resStr); } catch (e1) {} }
      }
      data = normalize(res);
    } catch (e) {
      debugLog("load config ERROR: " + (e && e.stack || e.message || e));
      data = normalize(null);
    }

    // onload 在片段插入后触发，root 应已存在；仍加少量重试兜底
    let tries = 0;
    function showFatal(err) {
      debugLog("prefs FATAL: " + (err && err.stack || err && err.message || err));
      const root = get("wordtranslator-pref-root");
      if (root) {
        root.replaceChildren();
        const div = document.createElementNS(HTML_NS, "div");
        div.style.cssText = "color:#a33;font-size:13px;padding:16px;white-space:pre-wrap;";
        div.textContent = "单词翻译配置面板加载失败：\n" + (err && err.message || err) + "\n\n请把该内容连同 Error Console 的红字反馈给开发者。";
        root.append(div);
      }
    }
    function tryBuild() {
      const root = get("wordtranslator-pref-root");
      if (root) {
        try {
          const ok = buildPrefsPane();
          if (!ok) { retry(); return; }
          bindEvents();
          renderForm();
          renderApis();
          setStatus("就绪");
          debugLog("prefs pane built OK");
        } catch (e2) {
          debugLog("build ERROR: " + (e2 && e2.stack || e2.message || e2));
          showFatal(e2);
        }
        return;
      }
      retry();
    }
    function retry() {
      tries++;
      if (tries > 100) {
        debugLog("prefs build timed out");
        showFatal(new Error("等待 #wordtranslator-pref-root 超时（100×50ms）"));
        return;
      }
      setTimeout(tryBuild, 50);
    }
    tryBuild();
  }

  init();
})();