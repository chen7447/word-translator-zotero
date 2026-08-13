# -*- coding: utf-8 -*-
import sys
path = r"F:\zotero插件\单词翻译\build\addon\content\preferences.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# patch 1: UI block - change to use clickable link
old1 = (
    '      el("div", { class: "wt-row-inline", style: "margin-top:6px;" }, [\n'
    '        (() => { const c = el("input", { type: "checkbox", id: "wt-addword-hotkey-enabled" }); return c; })(),\n'
    '        el("label", { for: "wt-addword-hotkey-enabled" }, [txt("添加快捷键：选中单词后按下绑定键执行「添加单词并翻译」")]),\n'
    '      ]),'
)
new1 = (
    '      el("div", { class: "wt-row-inline", style: "margin-top:6px;" }, [\n'
    '        (() => { const c = el("input", { type: "checkbox", id: "wt-addword-hotkey-enabled" }); return c; })(),\n'
    '        (() => {\n'
    '          const link = el("span", {\n'
    '            id: "wt-addword-link",\n'
    '            class: "wt-link",\n'
    '            title: "这个菜单项名称可以修改",\n'
    '            tabindex: "0",\n'
    '            role: "link",\n'
    '            style: "color:#0d6efd;text-decoration:underline;cursor:pointer;outline:none;",\n'
    '          }, [txt("「添加单词并翻译」")]);\n'
    '          const lbl = el("label", { for: "wt-addword-hotkey-enabled" }, [\n'
    '            txt("绑定"),\n'
    '            link,\n'
    '            txt("快捷键（选中单词后按下绑定键触发）"),\n'
    '          ]);\n'
    '          return lbl;\n'
    '        })(),\n'
    '      ]),'
)
assert old1 in content, "old1 not found"
content = content.replace(old1, new1, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK")
