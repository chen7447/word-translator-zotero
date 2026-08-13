# 有道翻译探测结果（2026-08-11，代理测试）

## 实际探测

| 探测 | HTTP | 返回 | 判断 |
|---|---:|---|---|
| 正确路径 | 302 | 空响应体 | 需要跟随重定向 |
| 错误路径 | 302 | 空响应体 | 有道统一 302 处理 |
| 正确路径 + 缺少 `i` | 302 | 空响应体 | 302 先于字段校验 |

## 结论

有道翻译返回 302 重定向。需用 `-L` 跟随后查看最终响应。

记录为：

```text
endpoint_redirect_needed
confidence: low
```

## 备注

参考插件使用 `GET http://fanyi.youdao.com/translate?doctype=json&type=EN2ZH_CN&i=environment`，无需 Key。可能对地区/来源有限制。