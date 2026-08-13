# 火山网页翻译探测结果（2026-08-11，代理测试）

## 实际探测

| 探测 | Endpoint | HTTP | 返回 | 判断 |
|---|---|---:|---|---|
| 正确路径 | `/crx/translate/v1` | 307 | 空响应体 | 需要跟随重定向 |
| 错误路径 | `/crx/translate/v1-wrong` | 404 | `404 page not found` | 路径错误可被识别 |
| 正确路径 + 缺少 `text` | `/crx/translate/v1` | 307 | 空响应体 | 重定向先于字段校验 |

## 结论

火山网页翻译正确路径返回 **307 重定向**。当前探测脚本未配置 `-L` 跟随重定向，因此未取得最终响应。

记录为：

```text
endpoint_recognized_redirect_required
confidence: medium
```

错误路径返回明确的 `404 page not found`，说明 Endpoint 前缀正确。

## 备注

- 参考插件使用 `POST https://translate.volcengine.com/crx/translate/v1`
- 请求体：`{source_language, target_language, text}`
- 这是一条**免费、无需鉴权**的网页型接口，可能对地区/来源有限制
- 后续可用 `curl -L` 跟随 307 重定向重新探测

## 待办

- 使用 `-L` 跟随重定向
- 确认重定向后的目标接口与返回结构
- 确认是否需要额外请求头（如 Origin、Referer）