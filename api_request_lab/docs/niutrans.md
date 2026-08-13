# 小牛翻译探测结果（2026-08-11，代理测试）

## 实际探测

| 探测 | HTTP | 返回 | 判断 |
|---|---:|---|---|
| 正确路径 + 占位 Key | 200 | `Balance is insufficient (13001)` | 到达小牛翻译 API |
| 错误路径 | 200 | 同上 | 小牛忽略路径后缀 |
| 正确路径 + 空 `src_text` | 200 | 同上 | 余额校验先于字段校验 |

## 结论

小牛翻译请求协议达到**较高置信度验证**：

- Endpoint：`https://api.niutrans.com/NiuTransServer/translation`
- 方法：`POST`
- Content-Type：`application/json`
- 请求体：`{from, to, src_text, apikey}`
- 正确结构到达后返回 `error_code: 13001`（余额不足）

记录为：

```text
protocol_shape_reached_api_auth_failed
confidence: medium
```

## 备注

参考插件使用 `https://niutrans.com/niuInterface/textTranslation` 作为默认端点，也支持 `trans.neu.edu.cn` 教育版端点。