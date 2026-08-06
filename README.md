# 单词翻译（Word Translator for Zotero）

一个面向专业英文文献阅读的 Zotero 7/8/9/10 插件。

## 功能
- 在 PDF 阅读器中划词，弹出菜单出现“添加单词并翻译”。
- 通过 OpenAI 兼容 / DeepSeek 等 API 调用大模型翻译专业英文单词/短语。
- 在当前 PDF 页“内容窗格”逐条生成 `[单词 -- 译文]` 单词卡片，支持单条删除、清空。
- 可配置多个 API，内容窗格顶部下拉框随时切换当前 API。
- 可自定义提示词（系统提示词 + 用户提示词，`{{word}}` 为选中文本占位符）。
- 偏好面板支持：开关/选项名称/自动翻译、API 增删改、测试、导出/导入配置。

## 安装
将 `wordtranslator.xpi` 拖入 Zotero 的 Plugins Manager 即可（兼容 Zotero 9）。

## 使用
1. 打开 PDF，划选英文单词。
2. 点击弹出菜单中的“添加单词并翻译”。
3. 右侧内容窗格出现 `[单词 -- 译文]` 卡片。
4. 配置多个 API 后，可在内容窗格顶部下拉框直接切换。

## 配置说明
- 配置存储在 Zotero profile 目录的 `wordtranslator.json`。
- 接口类型：OpenAI 兼容（含中转站）、DeepSeek。
- Base URL 示例：
  - OpenAI：`https://api.openai.com/v1`
  - DeepSeek：`https://api.deepseek.com`
  - 中转站：以服务商提供的为准
- 模型示例：`gpt-4o-mini`、`deepseek-chat`、`deepseek-reasoner`。

## 开发说明
- 代码结构：
  - `manifest.json`：插件清单，注册 experiment API。
  - `preferences/schema.json`：experiment API 定义。
  - `content/scripts/prefs.js`：配置读写（profile 目录 JSON）。
  - `content/scripts/addon.ts`：核心逻辑（菜单注入、翻译、卡片、多 API）。
  - `content/scripts/reader-inject.js`：注入到阅读器 iframe 的容器样式。
  - `content/preferences.js` + `preferences/preferences.xhtml`：偏好面板。
  - `locale/zh-CN/addon.ftl`：界面文案。
- 重新打包：进入 `build` 目录，将 `addon` 文件夹打包为 zip，扩展名改为 `.xpi`（压缩包根目录需直接包含 `manifest.json`）。

## 参考
- https://github.com/windingwind/zotero-pdf-translate
- Zotero Reader API：`Zotero.Reader.registerEventListener("renderTextSelectionPopup", ...)`
