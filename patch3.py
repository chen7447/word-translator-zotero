# -*- coding: utf-8 -*-
path = r"F:\zotero插件\单词翻译\build\addon\content\scripts\addon.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# The actual Chinese comment text was rendered as "" due to console encoding.
# Look for the literal source instead.
import re

# Find the "_customHotkeyActive() {" function and inject a helper immediately after the
# _addWordHotkeyActive function that follows.
helper = '''
  // Refresh self._data from storage without a full reload. Used so that toggling
  // "addWordHotkeyEnabled" / "customHotkeyEnabled" in the preferences takes effect
  // immediately, without requiring a Zotero restart. The cost is one extra JSON read
  // per hotkey event.
  _refreshPrefsFromStorage() {
    try {
      if (!Zotero || !Zotero.WordTranslatorStorage) return false;
      const raw = Zotero.WordTranslatorStorage.loadApiConfig();
      if (!raw || typeof raw !== "object") return false;
      this._data = this._normalize(raw);
      return true;
    } catch (e) {
      this._debugLog("_refreshPrefsFromStorage ERROR: " + (e && (e.message || String(e))));
      return false;
    }
  },
'''

pattern = r'(  _addWordHotkeyActive\(\) \{\n    return !\!\(this\._data && this\._data\.addWordHotkeyEnabled && this\._data\.addWordHotkey\);\n  \},\n)'
m = re.search(pattern, content)
assert m, "pattern not found"
content = content[:m.end()] + helper + content[m.end():]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK patch3")
