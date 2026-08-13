# Claude 探测结果（2026-08-11，代理测试）

正确路径返回 401 `authentication_error invalid x-api-key`，到达 Anthropic Messages API。错误路径返回 404 `not_found_error`。

## 备注

- Endpoint：`https://api.anthropic.com/v1/messages`
- 鉴权：`x-api-key` + `anthropic-version: 2023-06-01`
- 请求体：`{model, max_tokens, messages}`
- 响应路径：`content[0].text`

Claude 官方使用 Messages API（非 OpenAI 格式）。若走聚合站的 OpenAI 兼容接口，则复用现有插件架构。