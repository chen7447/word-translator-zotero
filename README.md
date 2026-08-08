# 单词翻译（Word Translator for Zotero）

一个面向专业英文文献阅读的 Zotero 7/8/9/10 插件。

## 功能
- 在 PDF 阅读器中划词，弹出菜单出现“添加单词并翻译”。
- 通过 OpenAI 兼容 / DeepSeek 等 API 调用大模型翻译专业英文单词/短语。
- 在当前 PDF 页“内容窗格”逐条生成 `[单词 -- 译文]` 单词卡片，支持单条删除、清空。
- 可配置多个 API，内容窗格顶部下拉框随时切换当前 API。
- 可自定义提示词（系统提示词 + 用户提示词，`{{word}}` 为选中文本占位符）。
- 支持快捷键划词翻译、“先选区后按绑定键”、自动翻译。
- 偏好面板支持：开关/选项名称/自动翻译、API 增删改、测试、获取模型列表、字体大小调节。

## 安装
将 `wordtranslator-5.1.11.xpi` 拖入 Zotero 的 Plugins Manager 即可（兼容 Zotero 7/8/9/10）。

## 使用
1. 打开 PDF，划选英文单词。
2. 点击弹出菜单中的“添加单词并翻译”。
3. 右侧内容窗格出现 `[单词 -- 译文]` 卡片。
4. 配置多个 API 后，可在内容窗格顶部下拉框直接切换。

## 版本迭代策略
- 美化或小优化 -> 小更新，版本号 +0.0.1（例：4.4.1 -> 4.4.2）
- 功能 bug 修复 -> 中更新，版本号 +0.1（例：4.4.1 -> 4.5.0）
- 添加新功能或大的改动 -> 大更新，版本号 +1.0（例：4.4.1 -> 5.0.0）

## 配置说明
- 配置存储在 Zotero profile 目录下的 `wordtranslator/api-config.json`；单词本按条目分文件存在 `wordtranslator/words/<itemID>.json`。
- 接口类型：OpenAI 兼容（含中转站）、DeepSeek、自定义。
- Base URL 示例：
  - OpenAI：`https://api.openai.com/v1`
  - DeepSeek：`https://api.deepseek.com`
  - 中转站：以服务商提供的为准
- 模型示例：`gpt-4o-mini`、`deepseek-chat`、`deepseek-reasoner`。

## 开发说明
- 代码结构（`build/addon` 为插件源码目录）：
  - `manifest.json`：插件清单（版本号、更新源、兼容范围）。
  - `bootstrap.js`：引导脚本（注册 chrome 资源、加载 storage/addon）。
  - `content/scripts/storage.js`：独立文件存储层（API 配置、单词本按条目分文件、原子写、防抖合并写）。
  - `content/scripts/addon.js`：核心逻辑（划词菜单注入、翻译、卡片、多 API、快捷键）。
  - `content/preferences.js` + `content/preferences.xhtml`：偏好面板。
  - `locale/zh-CN/addon.ftl`：界面文案。
- 重新打包：进入 `build` 目录执行 `package.ps1`，或将 `addon` 文件夹打包为 zip，扩展名改为 `.xpi`（压缩包根目录需直接包含 `manifest.json`）。
- 发布：见 `release_pkg/RELEASE_README.md`；一键发布可使用 `publish_release.py`。

## 参考
- https://github.com/windingwind/zotero-pdf-translate
- Zotero Reader API：`Zotero.Reader.registerEventListener("renderTextSelectionPopup", ...)`
