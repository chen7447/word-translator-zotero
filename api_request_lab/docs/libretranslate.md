# LibreTranslate 探测结果（2026-08-11，代理测试）

## 实际探测

| 探测 | HTTP | 返回 | 判断 |
|---|---:|---|---|
| 正确路径 + 无 API Key | 400 | `Visit https://portal.libretranslate.com to get an API key` | 官方实例要求 API Key |
| 错误路径 | 404 | HTML 404 | 路径可识别 |
| 正确路径 + 缺少 `q` | 400 | 同上 | 鉴权先于字段校验 |

## 结论

官方 LibreTranslate 实例需要 API Key。记录为：

```text
endpoint_reachable_requires_api_key
confidence: medium
```

## 提醒

插件中 LibreTranslate 通常用于自建服务，Endpoint 可由用户配置，不自带 Key 也可工作。