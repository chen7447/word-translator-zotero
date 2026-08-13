# -*- coding: utf-8 -*-
path = r"F:\zotero插件\单词翻译\build\addon\content\preferences.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Patch 2: Add click/keyboard handler for wt-addword-link -> jump to wt-context-label
# Find a stable insertion point near the wt-context-label input binding.
old2 = (
    '    const ctxLabel = get("wt-context-label");\n'
    '    if (ctxLabel) ctxLabel.addEventListener("input", () => { data.contextMenuLabel = ctxLabel.value; save(false); });\n'
)
new2 = (
    '    const ctxLabel = get("wt-context-label");\n'
    '    if (ctxLabel) ctxLabel.addEventListener("input", () => { data.contextMenuLabel = ctxLabel.value; save(false); });\n'
    '    // Click on "「添加单词并翻译」" span inside the addword-hotkey label -> jump to context-menu-label.\n'
    '    const addWordLink = get("wt-addword-link");\n'
    '    if (addWordLink) {\n'
    '      const jumpToCtx = function (ev) {\n'
    '        try {\n'
    '          if (ev) { ev.preventDefault(); ev.stopPropagation(); }\n'
    '          const target = get("wt-context-label");\n'
    '          if (!target) return;\n'
    '          try { target.scrollIntoView({ block: "center" }); } catch (e2) {}\n'
    '          try { target.focus(); } catch (e2) {}\n'
    '          try { target.select && target.select(); } catch (e2) {}\n'
    '        } catch (e3) {}\n'
    '      };\n'
    '      addWordLink.addEventListener("click", jumpToCtx, true);\n'
    '      addWordLink.addEventListener("keydown", function (ev) {\n'
    '        try {\n'
    '          const k = (ev.key || "").toLowerCase();\n'
    '          if (k === "enter" || k === " ") { jumpToCtx(ev); }\n'
    '        } catch (e2) {}\n'
    '      }, true);\n'
    '      // Hover visual cue: emphasize underline on hover.\n'
    '      addWordLink.addEventListener("mouseenter", function () {\n'
    '        try { addWordLink.style.textDecoration = "underline double"; } catch (e2) {}\n'
    '      }, true);\n'
    '      addWordLink.addEventListener("mouseleave", function () {\n'
    '        try { addWordLink.style.textDecoration = "underline"; } catch (e2) {}\n'
    '      }, true);\n'
    '    }\n'
)
assert old2 in content, "old2 not found"
content = content.replace(old2, new2, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK patch2")
