# 百度翻译探测结果（2026-08-11）

## 实际探测

使用 `curl.exe -k` 发送了三组请求，全部获得官方域名的 HTTP 响应：

| 探测 | Endpoint | HTTP | 返回 | 判断 |
|---|---|---:|---|---|
| 正确结构 + 占位凭证 | `/api/trans/vip/translate` | 200 | `error_code=52003`, `UNAUTHORIZED USER` | 官方接口识别了请求，凭证无效 |
| 错误路径 + 占位凭证 | `/api/trans/vip/translate-wrong` | 200 | `error_code=517`, `Unknown Error Code`, `data=null` | 与正确路径返回不同，路径/请求被拒绝 |
| 正确路径 + 缺少 `q` | `/api/trans/vip/translate` | 200 | `error_code=52003`, `UNAUTHORIZED USER` | 百度先进行凭证校验，不能用该组判断字段校验 |

## 结论

百度普通翻译请求格式的核心结构已经得到**中等置信度验证**：

- Endpoint：确认
- HTTP 方法：确认是 `GET`
- 参数传递：确认是 Query String
- 正确 Endpoint 会返回百度业务错误码 `52003`
- 错误 Endpoint 会返回不同的 `517 Unknown Error Code`
- 缺少 `q` 时仍先返回凭证错误，因此不能据此证明必填字段校验

当前可记录为：

```text
endpoint_and_method_likely_correct_auth_failed
confidence: medium
```

不能记录为：

```text
完整翻译请求已成功验证
```

因为没有真实 AppID/Key，且百度在凭证校验前可能不会继续校验请求字段。

## 重要网络发现

Python `urllib` 访问百度 API 时遇到：

```text
SSL: UNEXPECTED_EOF_WHILE_READING
```

改用 Windows `curl.exe -k` 后成功获得官方返回。这说明当前环境的 Python TLS 链路存在问题，不能归因于百度接口格式错误。探测脚本已改为调用 `curl.exe`，并保留 HTTP 状态与 JSON 响应。

## 后续

下一步可以：

1. 执行百度垂直领域接口探测。
2. 记录其 `fieldtranslate` 路径和 `domain` 参数。
3. 再继续 DeepL 或 Gemini。
4. 暂不修改插件 Provider 代码。
