"use strict";

// Word Translator for Zotero - 独立文件存储层
// 数据存于 <profile>/wordtranslator/
//   api-config.json              API 服务商配置（单文件）
//   words/<itemID>.json          单词本，按条目分文件
//   words/index.json             条目索引（可选辅助）
// 特性：原子写（tmp + rename）、防抖合并写、旧 prefs.js 数据一次性迁移。

var WordTranslatorStorage = {
  _root: null,          // nsIFile: <profile>/wordtranslator
  _wordsDir: null,      // nsIFile: <profile>/wordtranslator/words
  _timers: {},          // 防抖定时器 map

  // ---------- 路径 ----------
  getProfileDir() {
    try {
      if (Zotero && Zotero.ProfileDir) return Zotero.ProfileDir;
    } catch (e) {}
    try {
      if (Zotero && Zotero.profileDirectory) return Zotero.profileDirectory;
    } catch (e) {}
    return null;
  },

  getProfileDirPath() {
    const dir = this.getProfileDir();
    if (!dir) return "";
    try {
      if (dir.path) return dir.path;
    } catch (e) {}
    try { return String(dir); } catch (e) {}
    return "";
  },

  _ensureDirs() {
    const profile = this.getProfileDir();
    if (!profile) throw new Error("no profile dir");
    const root = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
    try { root.initWithFile(profile); } catch (e) { root.initWithPath(profile.path || String(profile)); }
    root.append("wordtranslator");
    if (!root.exists() || !root.isDirectory()) {
      root.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
    }
    const words = root.clone();
    words.append("words");
    if (!words.exists() || !words.isDirectory()) {
      words.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
    }
    this._root = root;
    this._wordsDir = words;
    return words;
  },

  getDataDirPath() {
    try { this._ensureDirs(); } catch (e) {}
    if (this._root) { try { return this._root.path; } catch (e) {} }
    const profilePath = this.getProfileDirPath();
    if (!profilePath) return "";
    return profilePath.replace(/[\\/]+$/, "") + (profilePath.indexOf("\\") >= 0 ? "\\" : "/") + "wordtranslator";
  },

  getApiConfigPath() {
    const dir = this.getDataDirPath();
    if (!dir) return "";
    return dir + (dir.indexOf("\\") >= 0 ? "\\" : "/") + "api-config.json";
  },

  getWordsDirPath() {
    const dir = this.getDataDirPath();
    if (!dir) return "";
    return dir + (dir.indexOf("\\") >= 0 ? "\\" : "/") + "words";
  },

  getWordsFilePath(itemID) {
    const dir = this.getWordsDirPath();
    if (!dir) return "";
    return dir + (dir.indexOf("\\") >= 0 ? "\\" : "/") + String(itemID) + ".json";
  },

  // ---------- 原子写 ----------
  _writeFileAtomically(file, text) {
    const tmp = file.clone();
    tmp.leafName = file.leafName + ".tmp";
    const out = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
    out.init(tmp, 0x02 | 0x08 | 0x10, 0o666, 0);
    const conv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter;1"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    conv.charset = "UTF-8";
    const stream = conv.convertToInputStream(text);
    const available = stream.available();
    const bytes = stream.readBytes(available);
    const bstream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
    bstream.setOutputStream(out);
    bstream.writeBytes(bytes, available);
    bstream.close();
    out.close();
    if (file.exists()) {
      try { file.remove(false); } catch (e) {}
    }
    tmp.moveTo(null, file.leafName);
  },

  _readFile(file) {
    if (!file.exists()) return null;
    const fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
    fstream.init(file, 0x01, 0o444, 0);
    const cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
    cstream.init(fstream, "UTF-8", 0, 0);
    let text = "";
    try {
      const chunk = {};
      while (cstream.readString(0xffffffff, chunk)) {
        text += chunk.value;
        if (!chunk.value) break;
      }
    } finally {
      cstream.close();
      fstream.close();
    }
    return text;
  },

  // ---------- API 配置 ----------
  loadApiConfig() {
    try {
      this._ensureDirs();
      const file = this._root.clone();
      file.append("api-config.json");
      const text = this._readFile(file);
      if (!text) return null;
      return JSON.parse(text);
    } catch (e) {
      if (Zotero && Zotero.debug) {
        try { Zotero.debug("[WordTranslatorStorage] loadApiConfig ERROR: " + (e && (e.stack || e.message || String(e)))); } catch (e2) {}
      }
      return null;
    }
  },

  saveApiConfig(data) {
    try {
      this._ensureDirs();
      const file = this._root.clone();
      file.append("api-config.json");
      this._writeFileAtomically(file, JSON.stringify(data, null, 2));
      return true;
    } catch (e) {
      if (Zotero && Zotero.debug) {
        try { Zotero.debug("[WordTranslatorStorage] saveApiConfig ERROR: " + (e && (e.stack || e.message || String(e)))); } catch (e2) {}
      }
      return false;
    }
  },

  // ---------- 单词本（按条目分文件） ----------
  loadWordsMap() {
    const result = new Map();
    try {
      this._ensureDirs();
      const entries = this._wordsDir.directoryEntries;
      while (entries.hasMoreElements()) {
        const f = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
        if (!f.isFile()) continue;
        const name = f.leafName || "";
        if (!/^\d+\.json$/.test(name)) continue;
        const id = Number(name.replace(/\.json$/, ""));
        if (!Number.isFinite(id) || id <= 0) continue;
        const text = this._readFile(f);
        if (!text) continue;
        let list = null;
        try { list = JSON.parse(text); } catch (e) { continue; }
        if (!Array.isArray(list)) continue;
        const cleaned = [];
        for (const w of list) {
          if (!w || typeof w !== "object") continue;
          cleaned.push({
            word: String(w.word || ""),
            translation: String(w.translation || ""),
            pending: !!w.pending,
          });
        }
        if (cleaned.length > 0) result.set(id, cleaned);
      }
    } catch (e) {
      if (Zotero && Zotero.debug) {
        try { Zotero.debug("[WordTranslatorStorage] loadWordsMap ERROR: " + (e && (e.stack || e.message || String(e)))); } catch (e2) {}
      }
    }
    return result;
  },

  saveWordsForItem(itemID, list) {
    try {
      this._ensureDirs();
      const file = this._wordsDir.clone();
      file.append(String(itemID) + ".json");
      if (!list || list.length === 0) {
        if (file.exists()) { try { file.remove(false); } catch (e) {} }
        return true;
      }
      this._writeFileAtomically(file, JSON.stringify(list, null, 2));
      return true;
    } catch (e) {
      if (Zotero && Zotero.debug) {
        try { Zotero.debug("[WordTranslatorStorage] saveWordsForItem ERROR: " + (e && (e.stack || e.message || String(e)))); } catch (e2) {}
      }
      return false;
    }
  },

  // 防抖保存：多个连续调用合并为一次落盘
  saveWordsForItemDebounced(itemID, list, delayMs) {
    const key = String(itemID);
    const self = this;
    if (this._timers[key]) clearTimeout(this._timers[key]);
    this._timers[key] = setTimeout(function () {
      delete self._timers[key];
      self.saveWordsForItem(itemID, list);
    }, delayMs || 300);
  },

  flushAll() {
    for (const key of Object.keys(this._timers || {})) {
      clearTimeout(this._timers[key]);
      delete this._timers[key];
    }
  },
};

if (typeof Zotero !== "undefined") {
  try { Zotero.WordTranslatorStorage = WordTranslatorStorage; } catch (e) {}
}
