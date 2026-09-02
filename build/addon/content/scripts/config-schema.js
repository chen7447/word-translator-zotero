"use strict";
// Word Translator 配置 schema（单源默认值 + 规范化函数）
// 在 bootstrap.js 通过 loadSubScript 注入，早于 addon.js 加载。
// 主进程通过 WordTranslatorConfig 全局访问；preferences.js 通过 Zotero.WordTranslatorConfig 访问。

var WordTranslatorConfig = {};

WordTranslatorConfig.DEFAULTS = {
  // 通用
  contextMenuLabel: "添加单词并翻译",
  enabled: true,
  autoTranslate: false,
  selectionMode: "word",
  fontSize: 13,
  pageSize: 10, // 单词本每页显示单词数
  sortMode: "reverse",
  searchStrategy: "prefix",
  defaultHighlight: "amber", // 双击高亮默认色：amber | sage | blue | rose
  debugLog: false, // 是否写 wordtranslator-debug.log（默认关，排障时在偏好页打开）
  // 快捷键-划词翻译
  hotkeyEnabled: false,
  hotkeyModifier: "ctrl",
  customHotkeyEnabled: false,
  customHotkey: "",
  // 快捷键翻译（先选区后按快捷键）
  addWordHotkeyEnabled: true,
  addWordHotkey: "",
  addWordHotkeyMode: "ctrl", // "ctrl" | "alt" | "shift" | "custom" | "xbutton1" | "xbutton2" | "xbutton-both"
  selectionFirstEnabled: true,
  // 鼠标侧键桥接
  xbuttonBridgeEnabled: true,
  // 翻译提示
  promptMode: "split",
  promptSystem:
    "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。",
  promptUser: "请将以下英文单词或短语翻译为专业中文：{{word}}",
  promptGlobal:
    "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。\n请将以下英文单词或短语翻译为专业中文：{{word}}",
  // Phase 8：划词携带选区上下文（{{context}} 占位符；默认关）
  promptUseContext: false,
  // TTS 发音
    ttsEngine: "system",  // "system" | "api" | "dict"(词典原生音频)
    ttsApiUrl: "",
    ttsApiKey: "",
    ttsApiModel: "tts-1",   // Phase 8：TTS API 模型可配置
    ttsApiVoice: "alloy",   // Phase 8：TTS API 音色可配置
  ttsEnabled: true,        // TTS 总开关（关时隐藏单词卡播放按钮）
  // 字典服务
  dictEnabled: true,       // 划词后后台补全 音标/词性/释义/例句/发音
  dictProvider: "auto",    // "auto" | "youdao" | "freedict" | "ecdict"(未接入)
  dictDisplayMode: "he",   // 单词卡字典显示模式："he"合 | "dan"单 | "dian"典
  // API
  apis: [],
  activeApiIndex: 0,
};

WordTranslatorConfig.normalize = function (raw) {
  var base = {};
  for (var k in WordTranslatorConfig.DEFAULTS) {
    if (WordTranslatorConfig.DEFAULTS.hasOwnProperty(k)) {
      base[k] = WordTranslatorConfig.DEFAULTS[k];
    }
  }
  // 首次安装（磁盘无配置，或从未保存过 apis 字段）注入免配置「免费直连」并设为默认（activeApiIndex=0）；
  // apis 已存在（含空数组——用户主动删光）则尊重现状，不再注入。
  var FREE_DEFAULT_API = { name: "免费直连（智能切换，无需注册）", provider: "free", baseUrl: "", apiKey: "", model: "" };
  if (!raw || typeof raw !== "object") {
    base.apis = [FREE_DEFAULT_API];
    return base;
  }
  return {
    ...base,
    ...raw,
    // deeplx（逆向 www2.deepl.com/jsonrpc）已下线：加载时丢弃旧条目，避免留下无法使用的服务商；
    // 无 apis 字段视为首次安装，注入免费直连默认项
    apis: Array.isArray(raw.apis)
      ? raw.apis.filter((a) => a && a.provider !== "deeplx")
      : [FREE_DEFAULT_API],
    activeApiIndex: typeof raw.activeApiIndex === "number" ? raw.activeApiIndex : 0,
    sortMode: typeof raw.sortMode === "string" ? raw.sortMode : "reverse",
    searchStrategy: typeof raw.searchStrategy === "string" ? raw.searchStrategy : "prefix",
    defaultHighlight: (raw.defaultHighlight === "amber" || raw.defaultHighlight === "sage" ||
      raw.defaultHighlight === "blue" || raw.defaultHighlight === "rose")
      ? raw.defaultHighlight : "amber",
    pageSize: Number.isFinite(Number(raw.pageSize)) && Number(raw.pageSize) >= 1 ? Math.floor(Number(raw.pageSize)) : 10,
    selectionMode: raw.selectionMode === "sentence" ? "sentence" : "word",
    // 旧数据没有新字段时保持默认值（...raw 会用 undefined 覆盖 base，需显式回填）
    addWordHotkeyEnabled: typeof raw.addWordHotkeyEnabled === "boolean" ? raw.addWordHotkeyEnabled : true,
    addWordHotkeyMode: (raw.addWordHotkeyMode === "ctrl" || raw.addWordHotkeyMode === "alt" ||
      raw.addWordHotkeyMode === "shift" || raw.addWordHotkeyMode === "custom" ||
      raw.addWordHotkeyMode === "xbutton1" || raw.addWordHotkeyMode === "xbutton2" ||
      raw.addWordHotkeyMode === "xbutton-both")
      ? raw.addWordHotkeyMode : "ctrl",
    selectionFirstEnabled: typeof raw.selectionFirstEnabled === "boolean" ? raw.selectionFirstEnabled : true,
    xbuttonBridgeEnabled: typeof raw.xbuttonBridgeEnabled === "boolean" ? raw.xbuttonBridgeEnabled : true,
    hotkeyModifier: (raw.hotkeyModifier === "shift" || raw.hotkeyModifier === "ctrl+shift" || raw.hotkeyModifier === "alt+shift")
      ? "ctrl" : (raw.hotkeyModifier || "ctrl"),
    ttsEngine: (raw.ttsEngine === "api" || raw.ttsEngine === "dict") ? raw.ttsEngine : "system",
    ttsApiUrl: typeof raw.ttsApiUrl === "string" ? raw.ttsApiUrl : "",
    ttsApiKey: typeof raw.ttsApiKey === "string" ? raw.ttsApiKey : "",
    ttsApiModel: (typeof raw.ttsApiModel === "string" && raw.ttsApiModel.trim()) ? raw.ttsApiModel.trim() : "tts-1",
    ttsApiVoice: (typeof raw.ttsApiVoice === "string" && raw.ttsApiVoice.trim()) ? raw.ttsApiVoice.trim() : "alloy",
    promptUseContext: typeof raw.promptUseContext === "boolean" ? raw.promptUseContext : false,
    ttsEnabled: typeof raw.ttsEnabled === "boolean" ? raw.ttsEnabled : true,
    dictEnabled: typeof raw.dictEnabled === "boolean" ? raw.dictEnabled : true,
    dictProvider: (raw.dictProvider === "youdao" || raw.dictProvider === "freedict" || raw.dictProvider === "ecdict")
      ? raw.dictProvider : "auto",
    dictDisplayMode: (raw.dictDisplayMode === "dan" || raw.dictDisplayMode === "dian") ? raw.dictDisplayMode : "he",
  };
};

// 桥接到主进程 Zotero 命名空间，供偏好面板沙箱访问
if (typeof Zotero !== "undefined") {
  try {
    Zotero.WordTranslatorConfig = WordTranslatorConfig;
  } catch (e) {}
}