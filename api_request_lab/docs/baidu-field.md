# 百度垂直领域翻译探测结果（2026-08-11）

## 实际探测

| 探测 | Endpoint | HTTP | 返回 | 判断 |
|---|---|---:|---|---|
| 正确结构 + `domain=medicine` + 占位凭证 | `/api/trans/vip/fieldtranslate` | 200 | `error_code=52003`, `UNAUTHORIZED USER` | 官方接口识别了请求，凭证无效 |
| 错误路径 + 占位凭证 | `/api/trans/vip/fieldtranslate-wrong` | 200 | `error_code=517`, `Unknown Error Code`, `data=null` | 与正确路径返回不同 |
| 正确路径 + 缺少 `q` | `/api/trans/vip/fieldtranslate` | 200 | `error_code=52003`, `UNAUTHORIZED USER` | 仍先做凭证校验 |

## 结论

百度垂直领域接口请求协议达到**中等置信度验证**：

- Endpoint：`https://api.fanyi.baidu.com/api/trans/vip/fieldtranslate`
- 方法：`GET`
- 参数：Query String
- 必要领域参数：`domain`
- 签名：`MD5(appid + q + salt + domain + key)`
- 正确路径收到 `52003`。
- 错误路径收到 `517`。
- 缺少 `q` 仍收到 `52003`，说明凭证校验先于字段校验。

记录状态：

```text
protocol_partially_validated
confidence: medium
```

目前仍不能证明真实领域代码 `medicine` 一定可用，也不能证明真实账户具有领域翻译权限。
