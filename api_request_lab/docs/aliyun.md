# 阿里云机器翻译探测结果（2026-08-11）

## 实际探测

| 探测 | Endpoint | HTTP | 返回 | 判断 |
|---|---|---:|---|---|
| 正确 RPC 结构 + 占位凭证 | `/` | 400 | `InvalidTimeStamp.Expired` | 到达阿里云，先校验时间戳 |
| 错误路径 `/wrong` | `/wrong` | 400 | `InvalidTimeStamp.Expired` | 阿里云忽略路径前缀，仍按 RPC 处理 |
| 缺少 `SourceText` | `/` | 400 | `InvalidTimeStamp.Expired` | 时间戳校验先于字段校验 |
| 错误 `Action=BadAction` | `/` | 404 | `InvalidAction.NotFound` | 明确识别 Action 名错误 |

## 结论

阿里云机器翻译请求协议达到**较高置信度验证**：

- Endpoint：`https://mt.cn-hangzhou.aliyuncs.com/`
- 方法：`POST`
- Content-Type：`application/x-www-form-urlencoded`
- RPC 参数体系确认（`Action`、`Version`、`Format`、`Signature` 等）
- 正确结构到达后返回阿里云业务错误码 `InvalidTimeStamp.Expired`
- 错误 `Action` 返回专门的 `InvalidAction.NotFound`，论证 RPC Action 校验有效

记录为：

```text
protocol_shape_partially_validated_auth_timestamp_blocked
confidence: high
```

时间戳使用固定占位值，故无法确认真实时间戳下的签名校验；也无法确认真实翻译结果。

## 备注

错误路径 `/wrong` 返回与正确路径相同的 `InvalidTimeStamp.Expired`，说明阿里云 RPC Host 对路径前缀不敏感，不能像百度那样用路径区分错误。用于区分协议的更强信号是 `InvalidAction.NotFound`。