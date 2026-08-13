# 必应网页翻译探测结果（2026-08-11，代理测试）

实际探测：正确路径返回 401 `401001: credentials missing`，到达必应翻译 API。错误路径同样返回 401（鉴权先于路径校验）。记录为 `protocol_shape_verified`，置信度 `high`。

## 备注

Bing 使用 `api-edge.cognitive.microsofttranslator.com`，需要先从 `edge.microsoft.com/translate/auth` 获取临时 Bearer token。插件需实现 token 刷新与缓存机制。