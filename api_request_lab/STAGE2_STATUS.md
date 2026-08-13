# 阶段二接入状态盘点（API 文档 → 插件 Provider）

> 维护说明：本文档回答"文档里记录的 API，哪些已接入、哪些不可接入、哪些待补探测"。
> 原则：任何"已接入"必须同时满足"有探测记录 + addon.js 有执行适配器 + preferences.js 有可选项"。
> 禁止仅凭参考插件旧实现就认为某接口可用。

## 1. 已完成接入 ✅

| Provider ID | 分组 | 类型 | 探测证据 | 凭证/模型规则 |
|---|---|---|---|---|
| `google` | 国际 | 无Key网页 | google.json（真实译文） | noCredentials |
| `deepl` | 国际 | 官方API | deepl.json | API Key |
| `microsoft` | 国际 | 官方API | microsoft.json | API Key |
| `caiyun` | 国内 | 官方API | caiyun.json | API Key |
| `niutrans` | 国内 | 官方API | niutrans.json | API Key |
| `libretranslate` | 自建 | 自建API | libretranslate.json | Key可选 |
| `baidu` | 国内 | 官方API | baidu.json | appid#key |
| `baidu-field` | 国内 | 官方API | baidu-field.json | appid#key#domain |
| `bing` | 国际 | 自动取令牌 | bing.json | noCredentials（运行时自动取Token） |
| `youdaozhiyun` | 国内 | 官方API | youdaozhiyun.json | AppKey#AppSecret（SHA256 v3签名） |
| `tencent` | 国内 | 官方API（TC3签名） | tencent.json | SecretId#SecretKey#Region#ProjectId |
| `aliyun` | 国内 | 官方API（RPC HMAC-SHA1） | aliyun.json | AccessKeyId#AccessKeySecret |
| `claude` | AI/大模型 | 官方Messages API | claude.json | Key + model |
| `openai`/`deepseek`/`gemini`/`qwen-mt` | AI/大模型 | OpenAI兼容fallback | qwenmt/gemini | Key + model |

## 2. 实测不可用，禁止接入 ❌

| Provider | 结论证据 |
|---|---|
| `youdao`（有道网页） | `fanyi.youdao.com/translate` 已被新版 SPA 前端取代，真实请求返回 HTML 页面（2026-08-12 + 浏览器头 + `-L` 实测），无 `translateResult` 的 JSON。参考插件旧实现已失效。 |
| `huoshan`（火山网页） | `translate.volcengine.com/crx/translate/v1` 跟随重定向 + Origin/Referer 后仍 `400 Bad Request`（2026-08-12 实测），无法取得 JSON。 |

> 这两个在 preferences.js 中保持 `enabled: false`。不要改为 enabled，除非有人用真实浏览器会话复测并确认取得 JSON 译文。

## 3. 暂无探测记录，需补齐实验 🔧

这些在 `api_request_lab` 中没有 `docs/*.md` / `results/*.json`，必须先按协议探测确认，不得直接接入。

| Provider ID | 备注/已知信息 |
|---|---|
| `xfyun`（讯飞） | 需要 HMAC-SHA256 签名，且对单词→中文场景价值低；探测复杂，可暂缓。 |
| `azure-openai` | URL 含 `/openai/deployments/{dpl}/chat/completions?api-version=`，与 OpenAI 兼容路径 `base + /chat/completions 不同，需专用适配器；参考插件读完 endpoint/apiVersion/model 再发请求。 |
| `mtranserver` | 自建本地服务，默认 `http://localhost:8989/translate`，POST `{text,from,to}`，解析 `result`；需配置 endpoint 和 versionlabel 运行。 |

## 4. 操作约束

- 修改含中文 JS 用 `UTF8Encoding($false)` 读写；禁止 `git restore/checkout`（会丢未提交工作）。
- 接入新 Provider 必须：先补 `probe_<x>.py` + 记录 `results/<x>.json`，再注册适配器，再建偏好项。
- 用户在本地测试确认成功前一律按 Beta 版处理，不打正式版、不发 GitHub。