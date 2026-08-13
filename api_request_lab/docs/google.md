# Google 翻译探测结果（2026-08-11，代理测试）

实际探测：正确路径返回 **HTTP 200 且包含实际翻译结果** `environment → 环境`。无需任何 API Key，Google 网页翻译接口可直接使用。

记录为 `protocol_verified_translation_returned`，置信度 `high`。

## 备注

- 使用简单 TK 哈希算法即可
- `https://translate.googleapis.com/translate_a/single` 支持 GET 请求
- 无需 API Key，无区域限制
- 可能有速率限制