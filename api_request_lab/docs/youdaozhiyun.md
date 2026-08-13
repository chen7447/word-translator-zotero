# 有道智云翻译探测结果（2026-08-11，代理测试）

实际探测：正确路径返回 HTTP 200，`errorCode: 108`（appid 或 key 无效）。错误路径返回 404。缺少 `q` 返回 `errorCode: 113`。记录为 `protocol_shape_reached_api`，置信度 `high`。

## 备注

- 使用 SHA256 签名
- `appid + truncate(q) + salt + curtime + key`
- 支持可选 `vocabId` 和 `domain`