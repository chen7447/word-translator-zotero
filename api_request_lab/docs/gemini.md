# Gemini 官方 API 探测结果（2026-08-11，代理测试）

## 代理条件

本轮仅在 Gemini 探测命令中临时设置：

```text
HTTP_PROXY=http://127.0.0.1:7897
HTTPS_PROXY=http://127.0.0.1:7897
ALL_PROXY=http://127.0.0.1:7897
```

四组探测结束后，PowerShell 当前会话中的这三个环境变量已删除，不影响后续普通测试。

## 实际探测

| 探测 | HTTP | 返回 | 判断 |
|---|---:|---|---|
| 正确 Endpoint + 正确 JSON 结构 + 占位 Key | 400 | `API_KEY_INVALID` | 已到达 Google API，鉴权失败 |
| 错误 Endpoint | 404 | 空响应体 | 路径错误可被识别 |
| 正确 Endpoint + 缺少 `parts` | 400 | `API_KEY_INVALID` | 鉴权校验先于 Body 字段校验 |
| 正确 Endpoint + `text/plain` | 400 | `API_KEY_INVALID` | 鉴权校验先于 Content-Type 校验 |

## 结论

Gemini 请求结构达到**高置信度部分验证**：

- 官方域名可通过本机代理访问。
- Endpoint 模板确认：

```text
/v1beta/models/{model}:generateContent
```

- HTTP 方法确认：`POST`
- API Key 位置确认：Query String 的 `key`
- JSON 顶层结构确认：`contents`
- 请求嵌套结构使用：`contents[].parts[].text`
- 错误路径返回 `404`，说明路径探测有效。
- 正确路径返回 Google 官方 `API_KEY_INVALID` 结构，说明请求已进入 Google API 鉴权层。

记录为：

```text
protocol_shape_partially_validated_auth_failed
confidence: high
```

由于 API Key 无效，Google 在鉴权阶段提前返回，暂时不能判断：

- `parts` 缺失时的字段错误
- `Content-Type` 错误时的请求体错误
- 模型是否可用
- 实际翻译结果

