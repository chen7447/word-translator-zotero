# -*- coding: utf-8 -*-
import zipfile, io, sys
sys.stdout.reconfigure(encoding='utf-8')
z = zipfile.ZipFile('build/wordtranslator-4.2.6.xpi')
s = z.read('content/scripts/addon.js').decode('utf-8')
print('has dataset.wtMousedownBound:', 'dataset.wtMousedownBound' in s)
print('has wtHotkeyMousedownBound:', 'wtHotkeyMousedownBound' in s)
print('has _getHotkeyTargetWindow:', '_getHotkeyTargetWindow' in s)
print('has _bindHotkeyModifierListener:', '_bindHotkeyModifierListener' in s)
print('has _waitForHotkeyWindow:', '_waitForHotkeyWindow' in s)
print('has _hotkeyToolbarHandler:', '_hotkeyToolbarHandler' in s)
print('version:', __import__('json').load(io.BytesIO(z.read('manifest.json')))['version'])
