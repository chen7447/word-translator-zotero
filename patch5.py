# -*- coding: utf-8 -*-
path = r"F:\zotero插件\单词翻译\build\addon\content\scripts\addon.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

import re

# 5a: first mousedown (custom + default modifiers)
old5a = (
    "      win.addEventListener(\"mousedown\", function (ev) {\n"
    "        try {\n"
    "          const d = self._data;\n"
    "          if (!d || !d.hotkeyEnabled) return;\n"
    "          let matched = false;\n"
    "          if (self._customHotkeyActive()) {\n"
    "            matched = self._matchCustomHotkeyMouse(ev, d.customHotkey) || self._matchCustomHotkeyKey(ev, d.customHotkey);\n"
    "          } else {\n"
    "            matched = self._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now() });\n"
    "          }\n"
    "          if (!matched) return;\n"
    "          self._hotkeyModifiers = { ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now(), mouseSide: !!(ev.button === 4 || ev.button === 5) };\n"
)
new5a = (
    "      win.addEventListener(\"mousedown\", function (ev) {\n"
    "        try {\n"
    "          self._refreshPrefsFromStorage();\n"
    "          const d = self._data;\n"
    "          if (!d || !d.hotkeyEnabled) return;\n"
    "          let matched = false;\n"
    "          if (self._customHotkeyActive()) {\n"
    "            matched = self._matchCustomHotkeyMouse(ev, d.customHotkey) || self._matchCustomHotkeyKey(ev, d.customHotkey);\n"
    "          } else {\n"
    "            matched = self._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now() });\n"
    "          }\n"
    "          if (!matched) return;\n"
    "          self._hotkeyModifiers = { ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now(), mouseSide: !!(ev.button === 4 || ev.button === 5) };\n"
)
assert old5a in content, "old5a not found"
content = content.replace(old5a, new5a, 1)

# 5b: keydown for default hotkey - use regex to avoid full Chinese string matching
pattern5b = re.compile(
    r"(      // )" + r"[\u4e00-\u9fff\uff08\uff09\u201c\u201d\uff1a\u3002\uff0c\u300c\u300d\uff01\uff1f\u3001 ]+"
    r"(\n      // )" + r"[\u4e00-\u9fff\uff08\uff09\u201c\u201d\uff1a\u3002\uff0c\u300c\u300d\uff01\uff1f\u3001 ()/A-Za-z]+"
    r"(\n      win\.addEventListener\(\"keydown\", function \(ev\) \{\n)"
    r"(        try \{\n)"
    r"(          const d = self\._data;\n)"
    r"(          if \(!d \|\| !d\.hotkeyEnabled\) return;\n)"
    r"(          let matched = false;\n)"
    r"(          if \(self\._customHotkeyActive\(\)\) \{\n)"
    r"(            matched = self\._matchCustomHotkeyKey\(ev, d\.customHotkey\);\n)"
)
m = pattern5b.search(content)
assert m, "5b pattern not found"
end = m.end()
content = (
    content[:end]
    + "          self._refreshPrefsFromStorage();\n"
    + content[end:]
)

# 5c: keyup - similar approach
pattern5c = re.compile(
    r"(      // )" + r"[\u4e00-\u9fff\uff08\uff09\u201c\u201d\uff1a\u3002\uff0c\u300c\u300d\uff01\uff1f\u3001 ]+"
    r"(\n      // )" + r"[\u4e00-\u9fff\uff08\uff09\u201c\u201d\uff1a\u3002\uff0c\u300c\u300d\uff01\uff1f\u3001 /()A-Za-z]+"
    r"(\n      win\.addEventListener\(\"keyup\", function \(ev\) \{\n)"
    r"(        try \{\n)"
    r"(          const d = self\._data;\n)"
    r"(          if \(!d \|\| !d\.hotkeyEnabled\) return;\n)"
    r"(          const pressed = self\._hotkeyPressed;\n)"
)
m = pattern5c.search(content)
assert m, "5c pattern not found"
end = m.end()
content = (
    content[:end]
    + "          self._refreshPrefsFromStorage();\n"
    + content[end:]
)

# 5d: addword (second keydown + mousedown listeners)
pattern5d = re.compile(
    r"(      // )" + r"[\u4e00-\u9fff\uff08\uff09\u201c\u201d\uff1a\u3002\uff0c\u300c\u300d\uff01\uff1f\u3001 ]+"
    r"(\n      win\.addEventListener\(\"keydown\", function \(ev\) \{\n)"
    r"(        try \{\n)"
    r"(          const d = self\._data;\n)"
    r"(          if \(!d \|\| !self\._addWordHotkeyActive\(\)\) return;\n)"
    r"(          if \(self\._matchCustomHotkeyKey\(ev, d\.addWordHotkey\)\) \{\n)"
    r"(            self\._fireAddWordHotkey\(\);\n)"
    r"(          \}\n)"
    r"(        \} catch \(e\) \{\}\n)"
    r"(      \}, true\);\n)"
    r"(      // )" + r"[\u4e00-\u9fff\uff08\uff09\u201c\u201d\uff1a\u3002\uff0c\u300c\u300d\uff01\uff1f\u3001 ]+"
    r"(\n      win\.addEventListener\(\"mousedown\", function \(ev\) \{\n)"
    r"(        try \{\n)"
    r"(          const d = self\._data;\n)"
    r"(          if \(!d \|\| !self\._addWordHotkeyActive\(\)\) return;\n)"
    r"(          if \(self\._matchCustomHotkeyMouse\(ev, d\.addWordHotkey\)\) \{\n)"
    r"(            self\._fireAddWordHotkey\(\);\n)"
    r"(          \}\n)"
    r"(        \} catch \(e\) \{\}\n)"
    r"(      \}, true\);\n)"
)
m = pattern5d.search(content)
assert m, "5d pattern not found"
# Inject refresh before each "const d = self._data;\n" inside this block.
start = m.start()
end = m.end()
block = m.group(0)
# Replace both occurrences of "const d = self._data;\n" within this block
new_block = block.replace(
    "const d = self._data;\n",
    "const d = self._data;\n",
)
# Insert refresh before each "const d = self._data;"
new_block_lines = []
i = 0
while True:
    j = new_block.find("const d = self._data;", i)
    if j == -1:
        new_block_lines.append(new_block[i:])
        break
    new_block_lines.append(new_block[i:j])
    new_block_lines.append("const d = self._data;\n")
    new_block_lines.append("          self._refreshPrefsFromStorage();\n")
    i = j + len("const d = self._data;\n")
# Wait - we want refresh BEFORE the check. Let's be more careful.
# Actually we want self._refreshPrefsFromStorage() right after `try {` lines (before the const d = self._data; line).
new_block = block
# Use regex on the block
new_block = re.sub(
    r"(        try \{\n)          const d = self\._data;",
    r"\1          self._refreshPrefsFromStorage();\n          const d = self._data;",
    new_block,
)
content = content[:start] + new_block + content[end:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK patch5")
