"use strict";

// Word Translator 字典服务模块（Zotero 7/8/9/10 主进程）
// 作用：为单词本卡片补充 音标 / 词性 / 释义 / 例句 / 原生发音音频。
// 定位：字典先行（结构化学词信息），翻译 provider 兜底（主译文行不走这里）。
// 依赖：storage.js（dict-cache.json 读写）、config-schema.js（dictEnabled/dictProvider）。
// 加载顺序：bootstrap.js 在 config-schema 之后、addon.js 之前 loadSubScript。

var WordTranslatorDict = {
  _cache: {},         // word -> { entry, ts }（内存缓存，渲染热路径只读它）
  _inflight: {},      // word -> Promise（并发去重）
  _exampleFetching: {}, // word -> true（Phase 8 例句后台补抓去重）
  _loaded: false,
  _persistTimer: null,
  _ecdDict: null,     // 内置离线词库（懒加载，dict-ecdict.json）
  _ecdDictPromise: null,

  // ---------- 工具 ----------
  _norm(word) {
    return String(word || "").trim().toLowerCase();
  },

  // provider 执行顺序：选中项优先。ecdict（内置离线词库）phase 2 已接入，
  // auto 下离线优先——网络请求自然失败即落到离线命中，无需离线检测。
  _chain(provider) {
    if (provider === "youdao") return ["youdao", "freedict"];
    if (provider === "freedict") return ["freedict", "youdao"];
    if (provider === "ecdict") return ["ecdict"]; // 纯离线模式
    return ["ecdict", "youdao", "freedict"]; // auto
  },

  // 极简词形回退：在线接口自带词形回查，离线词库不处理屈折。
  // ponytail: 不覆盖不规则动词（ran→run）等，真遇到再加映射表。
  _variants(word) {
    const out = [word];
    const s = String(word || "").toLowerCase();
    if (s.endsWith("ies") && s.length > 3) out.push(s.slice(0, -3) + "y");
    if (s.endsWith("es")) out.push(s.slice(0, -2));
    if (s.endsWith("s") && !s.endsWith("ss") && s.length > 1) out.push(s.slice(0, -1));
    if (s.endsWith("ing") && s.length > 4) { out.push(s.slice(0, -3)); out.push(s.slice(0, -3) + "e"); }
    if (s.endsWith("ed") && s.length > 3) { out.push(s.slice(0, -2)); out.push(s.slice(0, -2) + "e"); }
    if (s.endsWith("er") && s.length > 3) out.push(s.slice(0, -2));
    if (s.endsWith("est") && s.length > 4) out.push(s.slice(0, -3));
    return out.filter((v, i) => out.indexOf(v) === i);
  },

  // 惰性读配置（与 addon.js 同一数据源：api-config.json）
  _loadConfig() {
    try {
      const raw = Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.loadApiConfig();
      const enabled = raw && typeof raw.dictEnabled === "boolean" ? raw.dictEnabled : true;
      const provider = raw && ["youdao", "freedict", "ecdict"].includes(raw.dictProvider)
        ? raw.dictProvider : "auto";
      return { enabled, provider };
    } catch (e) {
      return { enabled: true, provider: "auto" };
    }
  },

  // ---------- 缓存 ----------
  // 启动时合并 storage 缓存进内存（只跑一次）
  loadCache() {
    try {
      if (this._loaded) return;
      this._loaded = true;
      const map = Zotero.WordTranslatorStorage && Zotero.WordTranslatorStorage.loadDictCache();
      for (const k of Object.keys(map || {})) {
        const it = map[k];
        if (it && it.entry) this._cache[k] = it;
      }
    } catch (e) {}
  },

  // 同步读内存缓存（渲染热路径专用，绝不触网）
  getCached(word) {
    const w = this._norm(word);
    if (!w) return null;
    const hit = this._cache[w];
    return hit && hit.entry ? hit.entry : null;
  },

  _schedulePersist() {
    const self = this;
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(function () {
      self._persistTimer = null;
      self.flush();
    }, 500);
  },

  // 立即落盘（shutdown/卸载用）：merge 内存缓存进 storage map 后原子写
  flush() {
    try {
      if (this._persistTimer) { clearTimeout(this._persistTimer); this._persistTimer = null; }
      const keys = Object.keys(this._cache);
      if (!keys.length) return;
      const map = Zotero.WordTranslatorStorage.loadDictCache();
      Object.assign(map, this._cache);
      Zotero.WordTranslatorStorage.saveDictCache(map);
    } catch (e) {}
  },

  // ---------- 查询 ----------
  // 永不 reject、永不抛错：所有 provider 失败时返回 null。
  async lookup(word) {
    const w = this._norm(word);
    if (!w) return null;
    const cached = this.getCached(w);
    if (cached) return cached;
    if (this._inflight[w]) return this._inflight[w]; // 并发去重
    const p = this._doLookup(w);
    this._inflight[w] = p;
    try { return await p; } finally { delete this._inflight[w]; }
  },

  async _doLookup(w) {
    const cfg = this._loadConfig();
    if (!cfg || cfg.enabled === false) return null;
    const chain = this._chain(cfg.provider);
    // 先试原词整条链（常见情形）；全部未命中再试屈折变体（离线词库不对外服务词形回查）
    for (const v of this._variants(w)) {
      for (const name of chain) {
        const fn = this._providers[name];
        if (typeof fn !== "function") continue;
        try {
          const entry = await fn(v);
          if (entry && Array.isArray(entry.meanings) && entry.meanings.length) {
            entry.word = w; // 统一按原词缓存
            this._cache[w] = { entry, ts: Date.now() };
            this._schedulePersist();
            // Phase 8：离线命中且无例句 → 后台异步补在线例句（纯离线模式跳过；不阻塞返回）
            if (name === "ecdict" && cfg.provider !== "ecdict" && (!entry.examples || !entry.examples.length)) {
              this._fetchExamplesInBackground(w);
            }
            return entry;
          }
        } catch (e) {} // 静默降级到下一个源
      }
    }
    return null;
  },

  // Phase 8：离线命中后异步补在线例句（youdao blng_sents_part）。
  // 不阻塞查询返回；成功则合并进缓存条目并再落盘、重渲染单词本；失败静默（断网保持现状）。
  async _fetchExamplesInBackground(word) {
    if (this._exampleFetching[word]) return;
    this._exampleFetching[word] = true;
    try {
      const resp = await Zotero.HTTP.request("GET",
        "https://dict.youdao.com/jsonapi?q=" + encodeURIComponent(word), {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            Referer: "https://dict.youdao.com/",
          },
          responseType: "json",
          timeout: 5000,
        });
      const d = resp && resp.status === 200 ? resp.response : null;
      const sents = d && d.blng_sents_part && d.blng_sents_part.sents;
      const examples = [];
      if (Array.isArray(sents)) {
        for (const s of sents) {
          if (!s || !s.sentence) continue;
          const tr = String(s.sentence_translation || "").trim();
          examples.push({ sentence: String(s.sentence), translation: tr || undefined });
          if (examples.length >= 2) break;
        }
      }
      const hit = this._cache[word];
      if (hit && hit.entry && examples.length) {
        hit.entry.examples = examples;
        hit.entry.ts = Date.now();
        this._schedulePersist();
        // 例句到达晚于首绘：若主模块在位则重渲染一次当前单词本
        try {
          if (Zotero.WordTranslator && typeof Zotero.WordTranslator._rerenderCurrentItemPane === "function") {
            Zotero.WordTranslator._rerenderCurrentItemPane("dict-examples");
          }
        } catch (e0) {}
      }
    } catch (e) {
      // 失败静默：断网/接口失效时保持现状（无例句）
    } finally {
      delete this._exampleFetching[word];
    }
  },

  // 懒加载内置离线词库（dict-ecdict.json，构建期生成、随 xpi 打包、零网络）
  _loadEcdict() {
    if (this._ecdDictPromise) return this._ecdDictPromise;
    const root = (typeof addonRoot !== "undefined" && addonRoot) ? addonRoot : "";
    const self = this;
    this._ecdDictPromise = (async () => {
      try {
        const resp = await fetch(root + "content/scripts/dict-ecdict.json");
        if (!resp || !resp.ok) return null;
        const obj = await resp.json();
        if (!obj || typeof obj !== "object") return null;
        self._ecdDict = obj;
        return obj;
      } catch (e) {
        self._ecdDictPromise = null; // 允许下次重试
        return null;
      }
    })();
    return this._ecdDictPromise;
  },

  // 偏好页"测试"按钮（经 addon.js 桥接为 Zotero.WordTranslator.testDict）
  async test() {
    try {
      const e = await this._doLookup("hello");
      return e ? { ok: true, message: "字典查询成功" }
               : { ok: false, message: "所有字典源均未命中或不可用" };
    } catch (err) {
      return { ok: false, message: String((err && err.message) || err) };
    }
  },

  // ---------- 数据源适配器 ----------
  // 统一输出：{ word, phonetic:{us,uk}, meanings:[{pos,def}], examples:[{sentence,translation?}], audio:{us,uk} }
  _providers: {
    // 有道网页接口（非官方，免 Key，可能失效；失败由调用方降级）
    youdao: async function (word) {
      const resp = await Zotero.HTTP.request("GET",
        "https://dict.youdao.com/jsonapi?q=" + encodeURIComponent(word), {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            Referer: "https://dict.youdao.com/",
          },
          responseType: "json",
          timeout: 5000,
        });
      if (resp.status !== 200 || !resp.response) return null;
      const d = resp.response;
      const ec = d && d.ec;
      const w = ec && ec.word && ec.word[0];
      if (!w) return null;
      const meanings = [];
      if (Array.isArray(w.trs)) {
        for (const t of w.trs) {
          if (!t) continue;
          const def = t.tr && t.tr[0] && t.tr[0].l && t.tr[0].l.i;
          if (!def) continue;
          meanings.push({ pos: String(t.pos || ""), def: String(def) });
          if (meanings.length >= 4) break;
        }
      }
      if (!meanings.length) return null;
      const examples = [];
      const sents = d.blng_sents_part && d.blng_sents_part.sents;
      if (Array.isArray(sents)) {
        for (const s of sents) {
          if (!s || !s.sentence) continue;
          const tr = String(s.sentence_translation || "").trim();
          examples.push({ sentence: String(s.sentence), translation: tr || undefined });
          if (examples.length >= 2) break;
        }
      }
      const baseWord = String(w.word || word);
      // youdao 原生音频：dictvoice type=1 美音 / type=2 英音（实测 HTTP 200，无需 Key）
      return {
        word: baseWord,
        phonetic: { us: String(w.usphone || "").trim(), uk: String(w.ukphone || "").trim() },
        meanings,
        examples,
        audio: {
          us: "https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(baseWord) + "&type=1",
          uk: "https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(baseWord) + "&type=2",
        },
      };
    },

    // Free Dictionary API（免费无 Key：英英释义 + US/UK 音标 + 原生音频 URL）
    freedict: async function (word) {
      const resp = await Zotero.HTTP.request("GET",
        "https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word), {
          responseType: "json",
          timeout: 5000,
        });
      if (resp.status !== 200 || !resp.response || !Array.isArray(resp.response) || !resp.response.length) return null;
      const first = resp.response[0];
      const phonetics = Array.isArray(first.phonetics) ? first.phonetics : [];
      const phonetic = { us: "", uk: "" };
      const audio = { us: "", uk: "" };
      for (const p of phonetics) {
        if (!p) continue;
        const url = String(p.audio || "");
        const isUk = /[_-]uk[_-]?/i.test(url);
        const isUs = /[_-]us[_-]?/i.test(url);
        if (url) {
          if (isUk) audio.uk = url;
          else if (isUs) audio.us = url;
          else if (!audio.us) audio.us = url;
        }
        const t = String(p.text || "").trim();
        if (!t) continue;
        if (isUk && !phonetic.uk) phonetic.uk = t;
        else if (isUs && !phonetic.us) phonetic.us = t;
        else if (!phonetic.us) phonetic.us = t; // 兜底取第一个音标
      }
      const meanings = [];
      const examples = [];
      if (Array.isArray(first.meanings)) {
        for (const m of first.meanings) {
          const defs = Array.isArray(m.definitions) ? m.definitions : [];
          for (const def of defs) {
            if (!def || !def.definition) continue;
            meanings.push({ pos: String(m.partOfSpeech || ""), def: String(def.definition) });
            const ex = String(def.example || "").trim();
            if (ex && examples.length < 2) examples.push({ sentence: ex, translation: undefined });
            if (meanings.length >= 4) break;
          }
          if (meanings.length >= 4) break;
        }
      }
      if (!meanings.length) return null;
      return { word: String(first.word || word), phonetic, meanings, examples, audio };
    },

    // 内置离线词库（ECDICT 子集：音标 + 词性 + 中文释义，例/音频无——归在线源补齐）
    ecdict: async function (word) {
      try {
        if (!WordTranslatorDict._ecdDict) {
          await WordTranslatorDict._loadEcdict();
          if (!WordTranslatorDict._ecdDict) return null;
        }
        const dict = WordTranslatorDict._ecdDict;
        const w = String(word || "").toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(dict, w)) return null;
        const e = dict[w];
        if (!e || !Array.isArray(e) || !e[2]) return null; // [音标, 词性, 中文释义]
        return {
          word,
          phonetic: { us: String(e[0] || ""), uk: "" },
          meanings: [{ pos: String(e[1] || ""), def: String(e[2]) }],
          examples: [],
          audio: {},
        };
      } catch (err) {
        return null;
      }
    },
  },
};

if (typeof Zotero !== "undefined") {
  try { Zotero.WordTranslatorDict = WordTranslatorDict; } catch (e) {}
}