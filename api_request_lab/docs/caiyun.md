# 彩云小译探测结果（2026-08-11，代理测试）

## 实际探测

| 探测 | Endpoint | HTTP | 返回 | 判断 |
|---|---|---:|---|---|
| 正确路径 + 占位 token | `/v1/translator` | 401 | `Invalid token` | 到达彩云服务，token 无效 |
| 错误路径 | `/v1/translator-wrong` | 404 | `{error: "Not found", rc: 1}` | 路径错误可被识别 |
| 正确路径 + 缺少 `source` | `/v1/translator` | 401 | `Invalid token` | 鉴权先于字段校验 |

## 结论

彩云小译请求协议达到**较高置信度验证**：

- Endpoint：`http://api.interpreter.caiyunai.com/v1/translator`（HTTP）
- 方法：`POST`
- Content-Type：`application/json`
- 鉴权：请求头 `x-authorization: token <TOKEN>`
- 正确结构到达后返回官方 `Invalid token`
- 错误路径返回明确的 `404 Not found`

记录为：

```text
protocol_shape_reached_api_auth_failed
confidence: high
```

## 备注

彩云小译使用 `http` 而非 `https`。请求体字段为 `source`、`trans_type`、`request_id`、`detect`。参考插件默认 token 为 `3975l6lr5pcbvidl6jl2`（测试用）。