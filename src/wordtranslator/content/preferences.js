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
      try { profileDir = (Zotero && Zotero.ProfileDir) ? Zotero.ProfileDir : (Zotero && Zotero.profileDirectory ? Zotero.profileDirectory : null); } catch (e0) {}
      if (!profileDir) return;
      var line = "[" + new Date().toISOString() + "] [WordTranslator prefs] " + String(msg) + "\n";
      var wfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      try { wfile.initWithFile(profileDir); } catch (e1) { wfile.initWithPath(profileDir.path || String(profileDir)); }
      wfile.append("wordtranslator-debug.log");
      var wout = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      wout.init(wfile, 0x02 | 0x08 | 0x10, 0o666, 0);
      var wconv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter;1"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
      wconv.charset = "UTF-8";
      var winput = wconv.convertToInputStream(line);
      var wavail = winput.available();
      var wbytes = winput.readBytes(wavail);
      var wbin = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
      wbin.setOutputStream(wout);
      wbin.writeBytes(wbytes, wavail);
      wbin.close();
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

  const DEFAULT_PROMPT_SYSTEM =
    "你是一位专业的英文文献翻译助手。请将用户给出的英文单词或短语翻译为最准确、最专业的中文译法。如果该词属于特定学科（如生物、化学、医学、信息技术等），优先给出该学科最常用的译法；如该词有多个常用义项，给出当前语境下最相关的一个或两个。只输出翻译结果本身，不要输出任何解释、释义、例句或多余文字。";
  const DEFAULT_PROMPT_USER =
    "请将以下英文单词或短语翻译为专业中文：{{word}}";

  const DEFAULTS = {
    contextMenuLabel: "添加单词并翻译",
    enabled: true,
    autoTranslate: false,
    promptSystem: DEFAULT_PROMPT_SYSTEM,
    promptUser: DEFAULT_PROMPT_USER,
    apis: [],
    activeApiIndex: 0,
    fontSize: 13,
  };

  function normalize(raw) {
    const base = JSON.parse(JSON.stringify(DEFAULTS));
    if (!raw || typeof raw !== "object") return base;
    return {
      ...base,
      ...raw,
      apis: Array.isArray(raw.apis) ? raw.apis : [],
      activeApiIndex: typeof raw.activeApiIndex === "number" ? raw.activeApiIndex : 0,
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
  function save(showStatus) {
    try {
      Zotero.Prefs.set("extensions.zotero.wordtranslator.config", JSON.stringify(data), true);
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
    try { notifyConfigChanged(); } catch (e) { debugLog("notify ERROR: " + (e && e.message || e)); }
  }

  // ----- 渲染 API 列表 -----
  function renderApis() {
    const tbody = get("wt-apis-tbody");
    if (!tbody) return;
    tbody.replaceChildren();
    if (!data.apis.length) {
      const tr = el("tr", {}, [el("td", { colspan: "5", style: "color:#888;font-size:12px;padding:8px;" }, [txt("还没有配置 API，点击下方“+ 添加服务商”开始配置。")])]);
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
      const tdProvider = el("td", {}, [txt(providerLabel(api))]);
      const tdModel = el("td", {}, [txt(api.model || "")]);
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
      tr.append(tdDefault, tdName, tdProvider, tdModel, tdOp);
      tr.addEventListener("dblclick", () => openEditor(i));
      tbody.append(tr);
    });
  }

  function providerLabel(api) {
    if (api.provider === "deepseek") return "DeepSeek";
    if (api.provider === "openai") return "OpenAI";
    return "自定义";
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
    updateProviderPreset();
    get("wt-api-editor-title").textContent = (index >= 0 ? "编辑" : "添加") + "服务商";
    renderApis();
  }

  function closeEditor() {
    editingIndex = -1;
    const editor = get("wt-api-editor");
    if (editor) editor.hidden = true;
    renderApis();
  }

  function updateProviderPreset() {
    const prov = get("wt-api-provider").value;
    const preset = get("wt-api-baseurl");
    preset.readOnly = false;
    preset.style.background = "";
    if (prov === "openai") {
      if (!preset.value) preset.value = "https://api.openai.com/v1";
      preset.placeholder = "https://api.openai.com/v1";
    } else if (prov === "deepseek") {
      if (!preset.value) preset.value = "https://api.deepseek.com";
      preset.placeholder = "https://api.deepseek.com";
    } else {
      preset.placeholder = "例如 https://api.example.com/v1";
    }
  }

  function saveApi() {
    const name = (get("wt-api-name").value || "").trim();
    const provider = get("wt-api-provider").value;
    const baseUrl = (get("wt-api-baseurl").value || "").trim().replace(/\/+$/, "");
    const apiKey = (get("wt-api-key").value || "").trim();
    const model = (get("wt-api-model").value || "").trim();
    if (!name) { setStatus("请填写名称"); return; }
    if (!apiKey) { setStatus("请填写 API Key"); return; }
    if (!model) { setStatus("请选择或填写模型"); return; }
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
      dlg.style.cssText = "background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.25);width:480px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;padding:16px;";

      const title = document.createElementNS(HTML_NS, "div");
      title.style.cssText = "font-weight:600;font-size:14px;margin-bottom:8px;color:#222;";
      title.textContent = "Found " + ids.length + " models. Click to select. Use the search box to filter.";
      dlg.appendChild(title);

      const search = document.createElementNS(HTML_NS, "input");
      search.type = "text";
      search.placeholder = "Search model id...";
      search.style.cssText = "width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid #ccc;border-radius:6px;margin-bottom:8px;font-size:13px;";
      dlg.appendChild(search);

      const listBox = document.createElementNS(HTML_NS, "div");
      listBox.style.cssText = "flex:1;min-height:240px;max-height:50vh;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;background:#fafafa;";
      dlg.appendChild(listBox);

      function renderList(filter) {
        listBox.replaceChildren();
        const f = (filter || "").trim().toLowerCase();
        const matched = f ? ids.filter((x) => String(x).toLowerCase().includes(f)) : ids;
        if (matched.length === 0) {
          const empty = document.createElementNS(HTML_NS, "div");
          empty.style.cssText = "padding:20px;color:#999;text-align:center;font-size:13px;";
          empty.textContent = "No matches";
          listBox.appendChild(empty);
          return;
        }
        matched.forEach((mid) => {
          const row = document.createElementNS(HTML_NS, "div");
          row.style.cssText = "padding:6px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;word-break:break-all;";
          row.textContent = mid;
          row.addEventListener("mouseenter", () => { row.style.background = "#e3f2fd"; });
          row.addEventListener("mouseleave", () => { row.style.background = ""; });
          row.addEventListener("click", () => { cleanup(mid); });
          listBox.appendChild(row);
        });
        const note = document.createElementNS(HTML_NS, "div");
        note.style.cssText = "padding:6px 12px;color:#888;font-size:12px;text-align:right;";
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
      cancel.style.cssText = "padding:5px 16px;border:1px solid #ccc;background:#f5f5f5;border-radius:6px;cursor:pointer;";
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
    const name = (get("wt-api-name").value || "").trim();
    const provider = get("wt-api-provider").value;
    const baseUrl = (get("wt-api-baseurl").value || "").trim().replace(/\/+$/, "");
    const apiKey = (get("wt-api-key").value || "").trim();
    const model = (get("wt-api-model").value || "").trim();
    if (!apiKey || !model) { setStatus("请先填写 API Key 与模型"); return; }
    const api = { provider, baseUrl, apiKey, model, name };
    try {
      const ok = await Zotero.WordTranslator.testApi(api);
      setStatus(ok ? "测试成功 ✓" : "测试失败（请检查 Key / URL / 模型）");
    } catch (e) {
      setStatus("测试失败：" + (e && e.message || e));
    }
  }

  // ----- 构建面板 -----
  function buildPrefsPane() {
    const root = get("wordtranslator-pref-root");
    if (!root) return false;
    root.replaceChildren();

    const style = el("style", {}, [txt(`
      #wordtranslator-pref-root { font-family: system-ui, "Segoe UI", sans-serif; font-size: 13px; line-height: 1.5; color: #222; }
      #wordtranslator-pref-root h2 { font-size: 16px; margin: 0 0 16px; }
      #wordtranslator-pref-root h3 { font-size: 14px; margin: 18px 0 8px; }
      #wordtranslator-pref-root .wt-section { margin-bottom: 18px; }
      #wordtranslator-pref-root .wt-row { margin: 8px 0; display: flex; flex-direction: column; gap: 4px; }
      #wordtranslator-pref-root .wt-row-inline { margin: 8px 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      #wordtranslator-pref-root .wt-label { font-weight: 500; }
      #wordtranslator-pref-root .wt-input,
      #wordtranslator-pref-root .wt-textarea,
      #wordtranslator-pref-root .wt-select {
        padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; background: #fff; color: #222; font: inherit;
        box-sizing: border-box;
      }
      #wordtranslator-pref-root .wt-input { width: 360px; max-width: 100%; }
      #wordtranslator-pref-root .wt-textarea { width: 100%; resize: vertical; }
      #wordtranslator-pref-root .wt-select { width: 220px; max-width: 100%; }
      #wordtranslator-pref-root .wt-hint { color: #888; font-size: 12px; margin: 2px 0 0; }
      #wordtranslator-pref-root .wt-actions { display: flex; gap: 8px; margin: 10px 0; flex-wrap: wrap; }
      #wordtranslator-pref-root .wt-btn {
        padding: 6px 16px; border: 1px solid #aaa; border-radius: 6px; background: #f0f0f0; cursor: pointer; font-size: 13px;
      }
      #wordtranslator-pref-root .wt-btn:hover { background: #e4e4e4; }
      #wordtranslator-pref-root .wt-btn-primary {
        background: #2c7be5; color: #fff; border-color: #2c7be5;
      }
      #wordtranslator-pref-root .wt-btn-primary:hover { background: #1a68d1; }
      #wordtranslator-pref-root .wt-btn-mini { padding: 2px 10px; font-size: 12px; }
      #wordtranslator-pref-root .wt-btn-danger { border-color: #c66; color: #a33; }
      #wordtranslator-pref-root .wt-table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      #wordtranslator-pref-root .wt-table th, #wordtranslator-pref-root .wt-table td {
        border-bottom: 1px solid #e6e6e6; padding: 6px 8px; text-align: left; vertical-align: middle;
      }
      #wordtranslator-pref-root .wt-table th { background: #f6f8fa; font-weight: 600; font-size: 12px; }
      #wordtranslator-pref-root .wt-table tr.selected td { background: #eef4fb; }
      #wordtranslator-pref-root .wt-api-editor {
        border: 1px solid #d0d0d0; border-radius: 8px; padding: 14px 16px; margin-top: 12px;
        background: #fafbfc; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
      }
      #wordtranslator-pref-root .wt-status { color: #2c7be5; font-weight: 500; }
      #wordtranslator-pref-root .wt-divider { border: none; border-top: 1px solid #eee; margin: 18px 0 0; }
      #wordtranslator-pref-root .wt-fetch-btn { padding: 6px 12px; }
      #wordtranslator-pref-root .wt-test-btn { padding: 6px 12px; color: #2c7be5; border-color: #2c7be5; background: #fff; }
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
        el("label", { for: "wt-enabled" }, [txt("启用「添加单词并翻译」菜单项")]),
      ]),
      el("div", { class: "wt-row-inline" }, [
        (() => { const c = el("input", { type: "checkbox", id: "wt-auto-translate" }); return c; })(),
        el("label", { for: "wt-auto-translate" }, [txt("选中文本后自动翻译并加入单词本")]),
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
    ]);

    // —— 提示词 ——
    const sectionPrompt = el("section", { class: "wt-section" }, [
      el("h3", {}, [txt("提示词")]),
      el("p", { class: "wt-hint", style: "margin: -4px 0 8px;" }, [
        txt("提示词用于告诉翻译模型怎么翻译你划选的单词/短语。你可以自定义，也可以点「恢复默认」回到下面的默认提示词。"),
      ]),
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
      el("div", { class: "wt-actions" }, [
        (() => {
          const b = el("button", { type: "button", class: "wt-btn", id: "wt-reset-prompts" }, [txt("恢复默认")]);
          return b;
        })(),
      ]),
    ]);

    // —— API 配置 ——
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
            el("th", {}, [txt("模型")]),
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
          el("label", { class: "wt-label", for: "wt-api-name" }, [txt("名称（仅用于区分不同中转站）")]),
          (() => { const i = el("input", { type: "text", class: "wt-input", id: "wt-api-name", placeholder: "如：中转站 A / OpenAI 官方 / DeepSeek" }); return i; })(),
        ]),
        el("div", { class: "wt-row" }, [
          el("label", { class: "wt-label", for: "wt-api-provider" }, [txt("服务商")]),
          (() => {
            const s = el("select", { class: "wt-select", id: "wt-api-provider" });
            s.append(el("option", { value: "openai" }, [txt("OpenAI 兼容（中转站）")]));
            s.append(el("option", { value: "deepseek" }, [txt("DeepSeek 官方")]));
            s.append(el("option", { value: "custom" }, [txt("自定义")]));
            return s;
          })(),
        ]),
        el("div", { class: "wt-row" }, [
          el("label", { class: "wt-label", for: "wt-api-baseurl" }, [txt("API URL")]),
          (() => { const i = el("input", { type: "text", class: "wt-input", id: "wt-api-baseurl", placeholder: "https://api.openai.com/v1" }); return i; })(),
          el("p", { class: "wt-hint" }, [txt("选择 OpenAI / DeepSeek 时会自动填默认值；选「自定义」可填任意中转站完整基础 URL。")]),
        ]),
        el("div", { class: "wt-row" }, [
          el("label", { class: "wt-label", for: "wt-api-key" }, [txt("API 密钥")]),
          (() => { const i = el("input", { type: "password", class: "wt-input", id: "wt-api-key" }); return i; })(),
        ]),
        el("div", { class: "wt-row" }, [
          el("label", { class: "wt-label", for: "wt-api-model" }, [txt("模型名称")]),
          el("div", { class: "wt-row-inline", style: "width: 100%;" }, [
            (() => { const i = el("input", { type: "text", class: "wt-input", id: "wt-api-model", placeholder: "如 gpt-4o-mini", style: "flex: 1; min-width: 0;" }); return i; })(),
            (() => { const b = el("button", { type: "button", class: "wt-btn wt-fetch-btn", id: "wt-api-fetch-models", title: "从 API 获取可用模型" }, [txt("+ 获取模型")]); return b; })(),
            (() => { const b = el("button", { type: "button", class: "wt-btn wt-test-btn", id: "wt-api-test" }, [txt("测试")]); return b; })(),
          ]),
        ]),
        el("div", { class: "wt-actions" }, [
          (() => { const b = el("button", { type: "button", class: "wt-btn wt-btn-primary", id: "wt-api-save" }, [txt("保存")]); return b; })(),
          (() => { const b = el("button", { type: "button", class: "wt-btn", id: "wt-api-cancel" }, [txt("取消")]); return b; })(),
        ]),
      ]),
    ]);

    // —— 状态 ——
    const footer = el("div", {}, [
      el("hr", { class: "wt-divider" }),
      el("p", { id: "wt-status", class: "wt-status" }, [txt("就绪")]),
    ]);

    root.append(style, title, intro, sectionGeneral, sectionAppearance, sectionPrompt, sectionApis, footer);
    return true;
  }

  function bindEvents() {
    function bind(id, evt, fn) {
      const e = get(id);
      if (e) e.addEventListener(evt, fn);
    }
    bind("wt-api-add", "click", () => openEditor(-1));
    bind("wt-api-save", "click", saveApi);
    bind("wt-api-cancel", "click", closeEditor);
    bind("wt-api-test", "click", testApi);
    bind("wt-api-fetch-models", "click", fetchModels);
    bind("wt-api-provider", "change", updateProviderPreset);

    bind("wt-reset-prompts", "click", () => {
      data.promptSystem = DEFAULT_PROMPT_SYSTEM;
      data.promptUser = DEFAULT_PROMPT_USER;
      get("wt-prompt-system").value = DEFAULT_PROMPT_SYSTEM;
      get("wt-prompt-user").value = DEFAULT_PROMPT_USER;
      save(true);
    });

    const ctxLabel = get("wt-context-label");
    if (ctxLabel) ctxLabel.addEventListener("input", () => { data.contextMenuLabel = ctxLabel.value; save(false); });
    const en = get("wt-enabled");
    if (en) en.addEventListener("change", () => { data.enabled = en.checked; save(false); });
    const at = get("wt-auto-translate");
    if (at) at.addEventListener("change", () => { data.autoTranslate = at.checked; save(false); });
    const ps = get("wt-prompt-system");
    if (ps) ps.addEventListener("input", () => { data.promptSystem = ps.value; save(false); });
    const pu = get("wt-prompt-user");
    if (pu) pu.addEventListener("input", () => { data.promptUser = pu.value; save(false); });

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
  }

  function renderForm() {
    const contextLabel = get("wt-context-label");
    const enabled = get("wt-enabled");
    const autoTranslate = get("wt-auto-translate");
    const promptSystem = get("wt-prompt-system");
    const promptUser = get("wt-prompt-user");
    if (contextLabel) contextLabel.value = data.contextMenuLabel || "";
    if (enabled) enabled.checked = !!data.enabled;
    if (autoTranslate) autoTranslate.checked = !!data.autoTranslate;
    if (promptSystem) promptSystem.value = data.promptSystem || DEFAULT_PROMPT_SYSTEM;
    if (promptUser) promptUser.value = data.promptUser || DEFAULT_PROMPT_USER;
    const fontSize = get("wt-font-size");
    const fontSizeRange = get("wt-font-size-range");
    const fsVal = Number(data.fontSize) || 13;
    if (fontSize) fontSize.value = String(fsVal);
    if (fontSizeRange) fontSizeRange.value = String(fsVal);
  }

  function init() {
    try {
      const resStr = Zotero.Prefs.get("extensions.zotero.wordtranslator.config", true);
      const res = resStr ? JSON.parse(resStr) : null;
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
