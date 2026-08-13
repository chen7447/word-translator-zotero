# Qwen-MT 探测结果（2026-08-11，代理测试）

正确路径返回 401 `invalid_api_key`，到达 DashScope OpenAI 兼容层。确认 Qwen-MT 走 **OpenAI 兼容 Chat Completions** 格式，可直接复用现有插件架构。

## 备注

- Endpoint：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- 鉴权：`Authorization: Bearer <key>`
- 模型：`qwen-mt-plus`
- 响应路径：`choices[0].message.content`