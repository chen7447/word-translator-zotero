# 单词翻译 Word Translator for Zotero

当前版本：**6.15.1**

Zotero 插件：在 PDF 阅读器中划词翻译单词和短语，管理个人单词本，支持可配置的 AI 翻译 API。

仓库：https://github.com/chen7447/word-translator-zotero

---

## 功能特点

- PDF 阅读器划词后显示可自定义名称的菜单项（默认「添加单词并翻译」）。
- 调用大模型或机器翻译接口，将英文单词 / 短语 / 句子译为中文。
- 支持多家服务商：OpenAI 兼容、DeepSeek、Gemini、Claude、Qwen-MT，以及百度 / 腾讯 / 阿里 / 火山 / 彩云 / 小牛 / 有道 / 讯飞、DeepL、微软翻译；另有 Google 免费接口和 LibreTranslate / DeepLX 自建服务。
- 可配置多个 API，并在右侧单词本面板中切换。
- 支持系统+用户提示词，或一段式全局提示词；`{{word}}` 会替换为选中文本。
- 支持选中后自动翻译并加入单词本。
- 支持「先选区后按绑定键」：Ctrl / Alt / Shift / 自定义组合键，以及鼠标侧键 1 / 侧键 2。
- 支持「按住快捷键划词翻译」（预设组合键与自定义快捷键互斥）。
- 单词卡片支持 **朗读发音**：系统 TTS 引擎（免费离线）或 TTS API（OpenAI 兼容格式）。
- 单词模式最长 500 字符；句子模式最长 5000 字符。
- 单词本按 Zotero 条目分别保存，支持搜索、排序、分页、单条删除、重新翻译、全部清空、调节字体。
- 单词卡片支持双击高亮、右键换色；偏好页可设默认高亮色。
- 单词本标题显示对应的 `words/<itemID>.json`，悬停可看完整路径。
- 偏好页可检查插件更新。
- API 配置和单词本保存在本地 Zotero 配置目录中。

---

## 系统要求

- Zotero 7.9.9 或更高版本（适配 Zotero 7 / 8 / 9 / 10）
- 一个可用的翻译服务及对应凭证（免费接口除外）
- 鼠标侧键翻译目前仅 Windows 可用（系统层钩子）

---

## 安装

1. 从 [Release](https://github.com/chen7447/word-translator-zotero/releases) 或仓库 `build/` 下载最新 `.xpi`，例如：

   ```text
   wordtranslator-6.15.1.xpi
   ```

2. 打开 Zotero → `工具 → 插件`。
3. 将 `.xpi` 拖入插件管理器，或点右上角齿轮 →「从文件安装插件」。
4. 安装后建议重启 Zotero。

插件也可通过 Zotero 插件更新机制检查新版本（偏好页右上角「检查更新」）。

---

## 首次配置

安装后打开：

```text
编辑 → 设置 → 单词翻译 Word Translator
```

### 添加翻译 API

在「翻译 API」区域点击 `+ 添加服务商`。

| 配置项 | 说明 |
|---|---|
| 服务商 | 从分类列表中选择 |
| 名称 | 用于区分不同中转站；官方翻译服务会自动填名称 |
| API URL | 大模型 / 兼容接口 / 自建服务可改；官方翻译服务已固定 |
| API 密钥 | 对应服务商凭证；部分服务用 `#` 拼接多段 |
| 模型名称 | 大模型需要；多数机器翻译不需要 |

常见大模型示例：

```text
OpenAI 官方     https://api.openai.com/v1
DeepSeek 官方   https://api.deepseek.com
Gemini          https://generativelanguage.googleapis.com/v1beta/openai
Claude          https://api.anthropic.com/v1
Qwen-MT         https://dashscope.aliyuncs.com/compatible-mode/v1
```

部分机器翻译的密钥格式（填在「API 密钥」里，用 `#` 分隔）：

| 服务商 | 密钥格式 |
|---|---|
| 百度翻译 | `appid#key` |
| 百度垂直领域 | `appid#key#domain` |
| 腾讯云机器翻译 | `SecretId#SecretKey#Region#ProjectId` |
| 阿里云 / 火山引擎 | `AccessKeyId#AccessKeySecret` |
| 有道智云 | `AppKey#AppSecret` |
| 讯飞机器翻译 | `AppID#APIKey#APISecret` |

Google 翻译（非官方逆向）与 MyMemory（翻译记忆库）无需密钥；MyMemory 匿名日限额约 5000 字符，单词/短语质量好、整句较弱。LibreTranslate 和自建 DeepLX 的密钥可选。

填写后可用「测试」「获取模型」「保存」。配置多个 API 后，可在单词本右上方下拉框切换。

---

## 基本使用

1. 在 Zotero 中打开 PDF。
2. 选中英文单词或短语。
3. 在阅读器弹出工具栏中点击「添加单词并翻译」（名称可在设置里改）。
4. 右侧 Item Pane 的单词本会出现卡片：

   ```text
   单词 -- 翻译中…
   ```

5. 返回结果后更新为：

   ```text
   单词 -- 中文译文
   ```

卡片上可点 `↻` 重新翻译，点 `✕` 删除，点 `🔊` 朗读发音。

如果没看到单词本，在 Item Pane 中启用「单词本」面板。

---

## 自动翻译

在偏好面板开启：

```text
选中文本后自动翻译并加入单词本
```

开启后，选中 PDF 文本会自动翻译并加入当前条目单词本，不必再点菜单按钮。只想手动加入时请关闭。

---

## 快捷键

插件提供两套快捷键，外加鼠标侧键。不要给两套快捷键绑同一个按键，设置页检测到冲突会阻止保存。

### 功能一：先选区，再按绑定键

默认开启，默认绑定 **Ctrl**。

```text
先选中单词 → 按下绑定键 → 立即添加并翻译
```

可选：

- Ctrl / Alt / Shift
- 自定义组合键（双击输入框录制，如 `Ctrl+Enter`、`Alt+Z`）
- 鼠标侧键 1（后退键）
- 鼠标侧键 2（前进键）

### 功能二：按住快捷键划词翻译

```text
按住快捷键 → 划选文本 → 弹出工具栏时自动添加并翻译
```

预设组合：Ctrl / Alt / Ctrl+Alt。也可改用自定义快捷键。两者互斥，只能开一个。

同一次按住期间可以连续划多个词。

### 鼠标侧键（Windows）

浏览器层会把鼠标侧键当成前进 / 后退，JS 听不到。插件会启动系统层 `WH_MOUSE_LL` 钩子（`bridge-hook.exe`），在操作系统层捕获侧键并通知插件。

- 先选中文本，再按侧键，才会翻译。
- 钩子运行时，侧键的前进 / 后退导航会被拦住。
- 关闭 Zotero 后钩子进程会退出。

---

## 选区翻译模式

| 模式 | 限制 | 说明 |
|---|---|---|
| 单词模式（默认） | 最长 500 字符 | 适合单词、短语 |
| 句子模式 | 最长 5000 字符 | 适合较长选区；再长会直接忽略，避免整篇 PDF 被提交 |

---

## 自定义提示词

两种模式：

- **系统提示词 + 用户提示词**
- **全局提示词**（合成一段）

用户提示词 / 全局提示词里可用 `{{word}}`，会替换为选中文本。点「恢复默认」可还原。

机器翻译服务不走这套提示词，只把文本发给对应接口。

---

## 单词本

显示在右侧 Item Pane。每张卡片：

```text
英文单词 -- 中文译文
```

面板能力：

- 切换当前翻译 API
- 倒序 / 正序 / 字母序
- 搜索（策略在设置里选）
- 分页（每页 1–100 条，默认 10；可输入页码后点「跳」）
- 放大 / 缩小字体
- 单条删除、重新翻译、清空当前条目
- 标题显示 `单词本 <itemID>.json`，悬停看本地保存路径
- 双击 `[单词 -- 翻译]` 开/关高亮（拖选仍可复制）
- 右键菜单贴在该卡片上：`颜色 颜色 颜色 颜色 ↻ ✕`，点别处关闭
- 右键选色会改这条，并记为下次双击的默认色

搜索策略：

| 策略 | 行为 |
|---|---|
| 前缀匹配（默认） | 按单词开头匹配 |
| 所有匹配 | 单词或释义包含关键词 |
| 只搜单词 | 只匹配英文单词 |
| 精确匹配 | 单词完全一致 |

不同 PDF 条目的单词互不混淆。搜索和当前页是临时界面状态，不写进单词本文件。

---

## 字体大小

设置里「外观」可调：

- 默认高亮色：琥珀 / 苔绿 / 雾蓝 / 玫瑰（双击卡片用这个色；单词本右键选色也会改这里）
- 字体大小：`9–24 px`，默认 `13 px`。也可在单词本面板点放大 / 缩小

---

## 发音（TTS）

单词卡片上的 `🔊` 按钮用于朗读英文单词。在偏好页「发音」区段选择朗读引擎：

| 引擎 | 说明 |
|---|---|
| 系统 TTS 引擎语音（英）（默认） | 免费、离线，使用 Windows 系统语音。可点击「设置 TTS 引擎」直达 Windows 语音设置，或点「说明」查看微软支持的语言和语音列表 |
| TTS API | 使用 OpenAI 兼容的语音合成接口。填写 API 地址与 Key 后点「测试」朗读固定测试句，测试通过后务必点「保存」 |

TTS API 请求格式（OpenAI 兼容）：

```text
POST {API地址}/audio/speech
Authorization: Bearer {API Key}
{"model": "tts-1", "input": "…", "voice": "alloy", "response_format": "mp3"}
```

---

## 数据存储

插件在 Zotero profile 目录下创建：

```text
wordtranslator/
├── api-config.json
├── bridge-hook.cs
├── bridge-hook.exe          # Windows 侧键钩子，首次启用时编译
├── bridge-events.json       # 侧键事件（运行时）
├── dict-cache.json          # 词典查询缓存（音标/词性/释义/例句）
├── translation-cache.json   # 译文缓存（同一单词跨文献复用，↻ 重译会更新）
├── exports/                 # 「导出」功能在选择器不可用时的兜底输出目录
└── words/
    ├── <itemID>.json
    └── ...
```

- `api-config.json`：API、快捷键、提示词及其他设置
- `words/<itemID>.json`：对应条目的单词本
- `wordtranslator-debug.log`：调试日志（默认关闭，在设置里打开；超过 2MB 会轮转）

可在偏好面板「保存目录」查看并打开这些路径。

### 数据隐私

- API Key 只存在本地配置目录（`api-config.json` 为**明文保存**，请勿把该文件或其备份分享给他人）
- 选中文本只会发到当前配置的翻译服务
- 插件不会把 Key 或单词本上传到作者服务器
- 服务商可能按自己的隐私政策记录请求内容

不要把 API Key 提交到 GitHub 或其他公开位置。

---

## 安全与兼容性说明

### 鼠标侧键桥接（Windows）

- 启用「鼠标侧键」触发方式后，插件会把随包的 `bridge-hook.cs` 编译为 `bridge-hook.exe` 并在后台运行。**编译过程调用 PowerShell，可能触发杀毒软件提示**，属于误报，放行即可。
- 该钩子是**系统级**低级鼠标钩子：启用期间，鼠标侧键（XButton1/2）在**所有应用**中都会被本插件接管（用于触发划词翻译），浏览器的前进/后退等默认行为不再生效。不使用侧键功能时可在设置中关闭。

### 非官方接口

「免费翻译」分组中的 **Google 翻译** 为非官方逆向接口，随时可能因服务方调整而失效；被限流时插件会自动按候选 client 重试。仍失败时可在服务商中选择 **MyMemory**（或改用官方 API / 大模型服务），支持多 API 一键切换。

### 界面语言

插件界面当前**仅提供中文**。

---

## 常见问题

### 1. 点击「测试」失败

检查 API URL、Key、模型、网络，以及该服务是否真的可用。大模型 URL 一般填基础地址，例如 `https://api.openai.com/v1`，插件会再请求 `/chat/completions`。官方机器翻译的地址由插件固定，重点检查密钥格式。

### 2. 获取模型列表失败

只有大模型 / OpenAI 兼容接口才有「获取模型」。部分中转站不提供 `/models`，直接手填模型名即可。

### 3. 划词后没有菜单

确认插件已启用、菜单项开关已打开、是在 Zotero PDF 阅读器里操作、选区非空且未超当前模式长度。必要时重启 Zotero 再打开 PDF。

### 4. 快捷键没反应

确认对应功能已开启、两套快捷键没有绑成同一个、自定义键已录上、焦点在 PDF 阅读器内。侧键还需要桥接进程已启动（仅 Windows）。

### 5. 鼠标侧键没反应 / 浏览器仍在前进后退

侧键目前只支持 Windows。选「鼠标侧键 1/2」后，先划词再按侧键。若钩子没起来，侧键仍会被浏览器当成导航。可看 `wordtranslator-debug.log` 里的 `xbutton bridge` 记录。

### 6. 单词本没有立即显示

切到其他条目再切回来，或点刷新，或关掉再打开 Item Pane，或重启 Zotero。

### 7. 卡片显示「翻译失败」

检查当前 API、额度、模型和网络。详细错误在 profile 目录的 `wordtranslator-debug.log`（需先在设置里打开调试日志）。

---

## 开发说明

主要文件：

```text
manifest.json
bootstrap.js
prefs.js
content/
├── preferences.xhtml
├── preferences.js
├── scripts/
│   ├── addon.js
│   ├── storage.js
│   ├── config-schema.js
│   └── bridge-hook.cs
└── icons/
locale/
├── zh-CN/
└── en-US/
```

| 文件 | 作用 |
|---|---|
| `manifest.json` | 名称、版本、兼容范围、更新地址 |
| `bootstrap.js` | 启动 / 关闭、Chrome 资源注册 |
| `content/scripts/addon.js` | 划词、快捷键、翻译、单词本、侧键桥接 |
| `content/scripts/storage.js` | 本地文件存储 |
| `content/scripts/config-schema.js` | 配置默认值与规范化 |
| `content/scripts/bridge-hook.cs` | Windows 鼠标侧键钩子源码 |
| `content/preferences.js` | 偏好面板 |
| `locale/*/wordtranslator-mainWindow.ftl` | Item Pane 本地化 |

重新打包：

```powershell
python build/pack_xpi.py build/addon build/wordtranslator-6.15.1.xpi
```

压缩包根目录必须直接包含 `manifest.json` 和 `bootstrap.js`，不要再套一层文件夹。

---

## 版本迭代

- 界面或小幅优化：修订号，如 `6.10.0 → 6.10.1`
- 功能修复或行为调整：次版本，如 `6.9.6 → 6.10.0`
- 主要功能或架构调整：主版本，如 `6.10.1 → 7.0.0`

---

## 参考

- [Zotero](https://www.zotero.org/)
- [Zotero Reader API](https://github.com/zotero/zotero)
- [zotero-pdf-translate](https://github.com/windingwind/zotero-pdf-translate)（AGPL-3.0）— 划词弹窗方案受其启发，仅借鉴实现思路，未复制其代码，故本项目保持 MIT 许可。

---

## 许可证

[MIT](LICENSE)
