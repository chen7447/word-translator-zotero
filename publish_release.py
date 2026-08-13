# -*- coding: utf-8 -*-
"""Word Translator for Zotero 一键发布脚本（GitHub Releases + 同步 update.json/源码）"""
import json, io, base64, os, sys, urllib.request, urllib.parse

TOKEN = '在此填入你的 GitHub Personal Access Token'
REPO = 'chen7447/word-translator-zotero'
API = 'https://api.github.com'
VER = '4.5.0'
TAG = 'v4.5.0'
RELEASE_NAME = 'Word Translator v4.5.0'
RELEASE_BODY = '小更新：修复 manifest 描述乱码，统一版本号，更新发布文档。'

def req(method, url, data=None):
    r = urllib.request.Request(url, method=method)
    r.add_header('Authorization', 'token ' + TOKEN)
    r.add_header('User-Agent', 'codex')
    if data is not None:
        body = json.dumps(data).encode('utf-8')
        r.add_header('Content-Type', 'application/json')
        r.data = body
    try:
        with urllib.request.urlopen(r) as resp:
            b = resp.read()
            return (resp.status, json.loads(b.decode('utf-8')))
    except urllib.error.HTTPError as e:
        return (e.code, e.read().decode('utf-8', 'replace'))

def upload_file(relpath):
    full = os.path.join('build/addon', relpath)
    with io.open(full, 'rb') as f:
        content = base64.b64encode(f.read()).decode('ascii')
    api_path = 'src/wordtranslator/' + relpath.replace('\\', '/')
    c, r = req('GET', API + '/repos/' + REPO + '/contents/' + api_path)
    payload = {
        'message': 'chore: sync v%s source' % VER,
        'content': content,
        'branch': 'main',
    }
    if c == 200:
        payload['sha'] = r['sha']
    c2, r2 = req('PUT', API + '/repos/' + REPO + '/contents/' + api_path, payload)
    print('upload', api_path, c2)

# 1) 先更新 build/addon/update.json
uj_path = 'build/addon/update.json'
with io.open(uj_path, encoding='utf-8') as f:
    d = json.load(f)
d['addons']['wordtranslator@example.com']['updates'] = [{
    'version': VER,
    'update_link': 'https://github.com/chen7447/word-translator-zotero/releases/download/' + TAG + '/wordtranslator-' + VER + '.xpi'
}]
with io.open(uj_path, 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
    f.write('\n')

# 2) 创建 GitHub Release
rel_payload = {
    'tag_name': TAG,
    'name': RELEASE_NAME,
    'body': RELEASE_BODY,
    'draft': False,
    'prerelease': False,
}
code, rel = req('POST', API + '/repos/' + REPO + '/releases', rel_payload)
print('create release:', code)
if code in (200, 201):
    rel_id = rel['id']
elif code == 422:
    code2, rel2 = req('GET', API + '/repos/' + REPO + '/releases/tags/' + TAG)
    rel_id = rel2['id']
else:
    print('failed:', rel); sys.exit(1)
print('release id:', rel_id)

# 3) 上传 XPI 资产
xpi_path = os.path.abspath('build/wordtranslator-' + VER + '.xpi')
with open(xpi_path, 'rb') as f:
    data = f.read()
url = ('https://uploads.github.com/repos/' + REPO + '/releases/' + str(rel_id) +
       '/assets?name=' + urllib.parse.quote('wordtranslator-' + VER + '.xpi'))
r = urllib.request.Request(url, method='POST', data=data)
r.add_header('Authorization', 'token ' + TOKEN)
r.add_header('User-Agent', 'codex')
r.add_header('Content-Type', 'application/octet-stream')
try:
    with urllib.request.urlopen(r) as resp:
        b = resp.read()
        info = json.loads(b.decode('utf-8'))
        print('upload asset:', resp.status, info.get('name'), info.get('size'))
except urllib.error.HTTPError as e:
    print('upload asset failed:', e.code, e.read().decode('utf-8', 'replace'))

# 4) 更新仓库根 update.json
with io.open(uj_path, encoding='utf-8') as f:
    uj_content = f.read()
code3, sha3 = req('GET', API + '/repos/' + REPO + '/contents/update.json')
if code3 != 200:
    print('get update.json failed:', code3, sha3); sys.exit(1)
put_payload = {
    'message': 'chore: update update.json to v' + VER,
    'content': base64.b64encode(uj_content.encode('utf-8')).decode('ascii'),
    'sha': sha3['sha'],
    'branch': 'main',
}
code4, res4 = req('PUT', API + '/repos/' + REPO + '/contents/update.json', put_payload)
print('update update.json:', code4)

# 5) 同步 build/addon 源码到 src/wordtranslator
for root, dirs, files in os.walk('build/addon'):
    for name in files:
        rel = os.path.relpath(os.path.join(root, name), 'build/addon')
        upload_file(rel)

print('ALL DONE')
