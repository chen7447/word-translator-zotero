# DeepL 官方 API 探测结果（2026-08-11）

## 实际探测

四组请求均到达 DeepL 域名并获得 HTTP 响应：

| 探测 | HTTP | 返回 | 判断 |
|---|---:|---|---|
| 正确路径 + 正确 JSON 结构 + 占位 Key | 403 | `Forbidden ... /auth` | 鉴权/权限失败，协议结构具有较高可信度 |
| 错误路径 | 403 | 空响应体 | 当前网络/服务层先返回权限拒绝，不能用它证明路径错误 |
| 正确路径 + 缺少 `text` | 403 | `Forbidden ... /auth` | 鉴权校验先于请求体字段校验 |
| 正确路径 + `text/plain` | 403 | `Forbidden ... /auth` | 鉴权校验先于 Content-Type 校验 |

## 结论

DeepL 请求格式达到**高置信度的结构验证**，依据：

- 官方文档明确使用 `POST /v2/translate`。
- `Authorization: DeepL-Auth-Key <key>` 位置明确。
- JSON 请求体字段明确为 `text`、`source_lang`、`target_lang`。
- 正确路径的占位 Key 返回 DeepL 官方鉴权文档链接。
- 请求已到达 DeepL 服务，而不是本地 DNS/TLS 失败。

但错误路径、缺少字段和错误 Content-Type 都被 403 鉴权层拦截，所以不能用本轮结果区分它们。记录为：

```text
protocol_shape_likely_correct_auth_failed
confidence: high
```

尚未证明真实 Key、账户额度、语言方向和真实翻译结果。
