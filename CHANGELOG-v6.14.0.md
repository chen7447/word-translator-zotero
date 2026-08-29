# 单词翻译 v6.14.0 更新说明

> 本文档是下次提交 GitHub 时 README 的参考更新内容。
> 届时把下方「更新说明」整体并入 README 的「版本历史」，并同步 README 顶部版本号。

---

## 更新说明

### 新功能

1. **单词本导出** — 一键导出为 CSV / Markdown / Anki 三种格式，可选当前条目或全部条目。
2. **译文缓存** — 已翻译的词自动缓存（最多 2000 条），下次划词免调 API，秒出结果。
3. **上下文智能提示词** — 开启后把单词所在上下文一并交给 AI，翻译更贴合语境（默认关）。
4. **TTS 发音自定义** — 可自由设定发音模型与音色（不再写死）。
5. **离线例句自动补全** — 离线词典查到的词若缺例句，后台自动抓取补全。

### 问题修复

1. **划词后状态被清** — 修复连续划词第二次失效、「Alt+Tab 切回后修饰键残留」。
2. **流式翻译解析失败** — 修复 SSE 数据被截断时解析出错的问题。
3. **翻译失败后卡死** — 修复失败后重复划词被当「已有译文」跳过、永不重试。
4. **保存成功但面板不显示** — 修复单词本保存了数据、界面却迟迟不刷新。
5. **长译文文本框卡高度** — 修复译文过长出现滚动条时，文本框高度卡在中间。
6. **长译文冲出面板** — 修复译文过长撑破下拉面板、被右侧栏遮挡。
7. **删除条目残留垃圾文件** — 删除条目时自动清理对应单词数据文件。
8. **关闭插件丢词** — 修复防抖窗口内关闭、临时数据未落盘导致丢词。

### 性能与体验

1. **单词本局部刷新** — 搜索不丢焦点、翻页不闪屏、增删不整板重绘。
2. **关闭强落盘** — 退出时强制把待写数据全部写盘，不再丢词。

### 安全与兼容性说明（README 新增）

- 鼠标侧键桥接编译可能触发杀软误报，放行即可；系统级钩子在启用期间会接管侧键。
- Google / DeepL 免费为非官方接口，随时可能失效。
- API Key 以明文存于本地 `api-config.json`，请勿外传该文件。

---

## 技术明细（内部参考，不必进 README）

- **新增导出**：`_collectExportSections` / `_exportDictSummary`；CSV 带 BOM。
- **新增缓存**：`translation-cache.json`（LRU 2000）、`_getCachedTranslation` / `_setCachedTranslation`、`_flushTranslationCache`。
- **新增上下文**：`_getSelectionContext` / `_buildPromptParts`、`promptUseContext`、`{{context}}` 占位符。
- **TTS 配置化**：`ttsApiModel` / `ttsApiVoice`。
- **修复热键重置**：`_bindHotkeyResetListener` 恢复语义、标记后移。
- **SSE**：新增 `_parseSSEChunk` 跨包行缓冲。
- **渲染防护**：`_resolvePaneBody`；**局部渲染**：`_buildPaneChrome` / `_renderCardList`。
- **存储**：`_pendingSaves` / `flushAll` 真落盘 / `cancelPendingSave` / Notifier observer。
- **文本框**：`_fitTempEditArea` 幽灵元素离线测量。
- **离线例句**：`_fetchExamplesInBackground`。
- **重构**：`addon.js` 拆为 5 个模块；删除 8 个死方法；冒烟测试 101 项。