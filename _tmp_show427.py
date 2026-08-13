# -*- coding: utf-8 -*-
import zipfile, io, sys
sys.stdout.reconfigure(encoding='utf-8')
z = zipfile.ZipFile(r'C:\Users\chen7447\AppData\Roaming\Zotero\Zotero\Profiles\wopdpkqi.default\extensions\wordtranslator@example.com.xpi')
s = z.read('content/scripts/addon.js').decode('utf-8')
lines = s.split('\n')
for i in range(418, 436):
    print('%4d %s' % (i+1, lines[i]))
