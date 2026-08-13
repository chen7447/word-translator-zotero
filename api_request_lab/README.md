# API Request Lab

这是 `单词翻译` Zotero 插件的**独立 API 协议实验库**。

> 本目录不参与插件源码构建，不会自动修改 `build/addon`，也不保存真实 API Key。

## 目标

在实现 Provider 之前，先通过官方文档和脱敏请求探测确认：

- 官方 Endpoint、HTTP 方法和 Content-Type
- 请求参数或 JSON 字段
- 鉴权位置和签名算法
- 错误返回结构
- 成功返回字段
- 请求协议的置信度

这里的结论是“请求协议验证通过”，不是“账户、余额、模型权限或真实翻译结果验证通过”。

## 目录

```text
api_request_lab/
├── README.md
├── providers.json          # 服务商、文档和实验状态
├── request_matrix.json     # 请求协议矩阵
├── scripts/                # 独立探测脚本，不依赖插件代码
├── docs/                   # 每个服务的人工可读协议记录
├── results/                # 脱敏实验结果
└── fixtures/               # 请求样例和对照样例
```

## 实验规则

每个服务至少设计四种探测：

1. 正确 Endpoint + 正确请求结构 + 占位凭证
2. 错误 Endpoint + 占位凭证
3. 正确 Endpoint + 缺少必填字段
4. 正确 Endpoint + 错误字段/错误 Content-Type

脚本必须记录：

- HTTP 状态码
- Content-Type
- 响应 JSON 或文本的脱敏摘要
- 分类结果
- 置信度
- 实验时间

## 安全规则

禁止写入：

- 真实 API Key、Secret、Cookie、Authorization
- 真实用户文本或私人数据
- 完整签名原文中包含的真实密钥

默认使用占位值，例如：

```text
TEST_APP_ID
TEST_API_KEY
TEST_SECRET_KEY
```

## 当前顺序

1. 百度翻译
2. 百度垂直领域翻译
3. DeepL
4. Gemini
5. 阿里云翻译
6. 腾讯云翻译

当前仅建立实验库，尚未修改插件 Provider 或偏好页逻辑。
