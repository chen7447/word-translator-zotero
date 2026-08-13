# -*- coding: utf-8 -*-
path = r"F:\zotero插件\单词翻译\build\addon\content\scripts\addon.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

import re

# Patch 4: in _bindGlobalHotkeyListener, prepend a refresh call to each event handler so toggled
# prefs take effect immediately without restart.
old4 = (
    '      target.addEventListener("keydown", function (ev) {\n'
    '        try {\n'
    '          const d = self._data;\n'
    '          if (!d || !d.hotkeyEnabled) return;\n'
    '          let matched = false;\n'
    '          if (self._customHotkeyActive()) {\n'
    '            matched = self._matchCustomHotkeyKey(ev, d.customHotkey);\n'
    '          } else {\n'
    '            matched = self._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now() });\n'
    '          }\n'
    '          if (!matched) return;\n'
    '          self._hotkeyPressed = { mod: d.customHotkeyEnabled ? d.customHotkey : (d.hotkeyModifier || "ctrl"), time: Date.now() };\n'
    '          self._hotkeyJustReleased = null;\n'
    '          self._debugLog("hotkey pressed (global): mod=" + JSON.stringify(self._hotkeyPressed));\n'
    '        } catch (e) {}\n'
    '      }, true);\n'
)
new4 = (
    '      target.addEventListener("keydown", function (ev) {\n'
    '        try {\n'
    '          self._refreshPrefsFromStorage();\n'
    '          const d = self._data;\n'
    '          if (!d || !d.hotkeyEnabled) return;\n'
    '          let matched = false;\n'
    '          if (self._customHotkeyActive()) {\n'
    '            matched = self._matchCustomHotkeyKey(ev, d.customHotkey);\n'
    '          } else {\n'
    '            matched = self._hotkeyMatches({ ctrl: !!ev.ctrlKey, shift: !!ev.shiftKey, alt: !!ev.altKey, time: Date.now() });\n'
    '          }\n'
    '          if (!matched) return;\n'
    '          self._hotkeyPressed = { mod: d.customHotkeyEnabled ? d.customHotkey : (d.hotkeyModifier || "ctrl"), time: Date.now() };\n'
    '          self._hotkeyJustReleased = null;\n'
    '          self._debugLog("hotkey pressed (global): mod=" + JSON.stringify(self._hotkeyPressed));\n'
    '        } catch (e) {}\n'
    '      }, true);\n'
)
assert old4 in content, "old4 not found"
content = content.replace(old4, new4, 1)

# patch 4b: keyup handler
old4b = (
    '      target.addEventListener("keyup", function (ev) {\n'
    '        try {\n'
    '          const d = self._data;\n'
    '          if (!d || !d.hotkeyEnabled) return;\n'
    '          const pressed = self._hotkeyPressed;\n'
)
new4b = (
    '      target.addEventListener("keyup", function (ev) {\n'
    '        try {\n'
    '          self._refreshPrefsFromStorage();\n'
    '          const d = self._data;\n'
    '          if (!d || !d.hotkeyEnabled) return;\n'
    '          const pressed = self._hotkeyPressed;\n'
)
assert old4b in content, "old4b not found"
content = content.replace(old4b, new4b, 1)

# patch 4c: mousedown handler
old4c = (
    '      target.addEventListener("mousedown", function (ev) {\n'
    '        try {\n'
    '          const d = self._data;\n'
    '          if (!d) return;\n'
)
new4c = (
    '      target.addEventListener("mousedown", function (ev) {\n'
    '        try {\n'
    '          self._refreshPrefsFromStorage();\n'
    '          const d = self._data;\n'
    '          if (!d) return;\n'
)
assert old4c in content, "old4c not found"
content = content.replace(old4c, new4c, 1)

# patch 4d: addword keydown (the last event)
old4d = (
    '      target.addEventListener("keydown", function (ev) {\n'
    '        try {\n'
    '          const d = self._data;\n'
    '          if (!d || !self._addWordHotkeyActive()) return;\n'
    '          if (self._matchCustomHotkeyKey(ev, d.addWordHotkey)) {\n'
    '            self._fireAddWordHotkey();\n'
    '          }\n'
    '        } catch (e) {}\n'
    '      }, true);\n'
    '      this._debugLog("global hotkey listener bound");\n'
)
new4d = (
    '      target.addEventListener("keydown", function (ev) {\n'
    '        try {\n'
    '          self._refreshPrefsFromStorage();\n'
    '          const d = self._data;\n'
    '          if (!d || !self._addWordHotkeyActive()) return;\n'
    '          if (self._matchCustomHotkeyKey(ev, d.addWordHotkey)) {\n'
    '            self._fireAddWordHotkey();\n'
    '          }\n'
    '        } catch (e) {}\n'
    '      }, true);\n'
    '      this._debugLog("global hotkey listener bound");\n'
)
assert old4d in content, "old4d not found"
content = content.replace(old4d, new4d, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK patch4 (4a-4d)")
