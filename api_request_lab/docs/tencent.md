# 腾讯云翻译探测结果（2026-08-11，代理测试）

## 实际探测

全部通过代理 `127.0.0.1:7897`：

| 探测 | Endpoint | HTTP | 返回 | 判断 |
|---|---|---:|---|---|
| 正确 RPC 结构 + 占位凭证 | `/` | 200 | `AuthFailure.SecretIdNotFound` | 到达腾讯云 API，鉴权失败 |
| 错误路径 `/wrong` | `/wrong` | 200 | `AuthFailure.SecretIdNotFound` | 腾讯云忽略路径后缀 |
| 缺少 `SourceText` | `/` | 200 | `AuthFailure.SecretIdNotFound` | 鉴权校验先于字段校验 |

## 结论

腾讯云翻译请求协议达到**较高置信度验证**：

- Endpoint：`https://tmt.tencentcloudapi.com`
- 方法：`POST`
- Content-Type：`application/x-www-form-urlencoded`
- 参数：`Action=TextTranslate`, `Version=2018-03-21`, `Region`, `ProjectId`, `Source`, `SourceText`, `Target`, `SecretId`, `Timestamp`, `Nonce`, `Signature`
- 正确结构到达后返回腾讯云官方 `AuthFailure.SecretIdNotFound` 错误结构

记录为：

```text
protocol_shape_reached_api_auth_failed
confidence: high
```

腾讯云对路径后缀不敏感（`/wrong` 仍返回同样错误），因此不能用路径做对照。

## 备注

参考插件使用 `POST` + form 编码 + HMAC-SHA1 签名 + `Signature` 参数。当前探测使用占位 SecretId/SecretKey，故无法确认真实签名与真实翻译结果。