# 微软翻译探测结果（2026-08-11，代理测试）

## 实际探测

| 探测 | HTTP | 返回 | 判断 |
|---|---:|---|---|
| 正确路径 + 占位 Key | 401 | `401001: credentials are missing or invalid` | 到达 Azure 翻译 API |
| 错误路径 | 401 | 同上 | 鉴权先于路径校验 |
| 正确路径 + 空 `Text` | 401 | 同上 | 鉴权先于字段校验 |

## 结论

Microsoft Azure Translator 请求协议达到**高置信度验证**：

- Endpoint：`https://api.cognitive.microsofttranslator.com/translate`
- 方法：`POST`
- 鉴权：请求头 `Ocp-Apim-Subscription-Key`
- 请求体：`[{"Text": "environment"}]`
- 查询参数：`api-version=3.0&to=zh`

## 备注

参考插件使用 `secret#region` 格式配置密钥，SecretId 长度 32 或 84。