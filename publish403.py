# -*- coding: utf-8 -*-
import json, io, base64, os, sys, urllib.request, urllib.parse

TOKEN = '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'
REPO = 'chen7447/word-translator-zotero'
API = 'https://api.github.com'
VER = '5.0.0b1'
TAG = 'v5.0.0b1'

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

# update update.json first
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

rel_payload = {
    'tag_name': TAG,
    'name': 'Word Translator v5.0.0b1 (Beta)',
    'body': ('\u4fee\u590d\u5feb\u6377\u952e\u72b6\u6001\u672a\u7ed3\u675f\uff1a\u677e\u5f00\u5212\u8bcd\u5feb\u6377\u952e\u540e\u518d\u5212\u8bcd\u4e0d\u518d\u8bef\u89e6\u53d1\u7ffb\u8bd1\u3002\n'
             '\u62c6\u5206\u4e24\u5957\u5feb\u6377\u952e\u7f13\u5b58\uff0c\u5df2\u9009\u533a\u65f6\u6309\u5212\u8bcd\u5feb\u6377\u952e\u4f18\u5148\u89e6\u53d1\u201c\u5148\u9009\u533a\u540e\u6309\u7ed1\u5b9a\u952e\u201d\u3002\n'
             '\u504f\u597d\u9762\u677f\u65b0\u589e\u5feb\u6377\u952e\u51b2\u7a81\u68c0\u6d4b\uff0c\u9632\u6b62\u4e24\u4e2a\u529f\u80fd\u4f7f\u7528\u76f8\u540c\u6309\u952e\u3002'),
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

xpi_path = os.path.abspath('build/wordtranslator-5.0.0b1.xpi')
with open(xpi_path, 'rb') as f:
    data = f.read()
url = ('https://uploads.github.com/repos/' + REPO + '/releases/' + str(rel_id) +
       '/assets?name=' + urllib.parse.quote('wordtranslator-4.5.0.xpi'))
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

with io.open(uj_path, encoding='utf-8') as f:
    uj_content = f.read()
code3, sha3 = req('GET', API + '/repos/' + REPO + '/contents/update.json')
if code3 != 200:
    print('get update.json failed:', code3, sha3); sys.exit(1)
put_payload = {
    'message': 'chore: update update.json to v4.4.2',
    'content': base64.b64encode(uj_content.encode('utf-8')).decode('ascii'),
    'sha': sha3['sha'],
    'branch': 'main',
}
code4, res4 = req('PUT', API + '/repos/' + REPO + '/contents/update.json', put_payload)
print('update update.json:', code4)

def upload_file(relpath):
    full = os.path.join('build/addon', relpath)
    with io.open(full, 'rb') as f:
        content = base64.b64encode(f.read()).decode('ascii')
    api_path = 'src/wordtranslator/' + relpath.replace('\\', '/')
    c, r = req('GET', API + '/repos/' + REPO + '/contents/' + api_path)
    payload = {
        'message': 'chore: sync v4.4.2 source',
        'content': content,
        'branch': 'main',
    }
    if c == 200:
        payload['sha'] = r['sha']
    c2, r2 = req('PUT', API + '/repos/' + REPO + '/contents/' + api_path, payload)
    print('upload', api_path, c2)

for root, dirs, files in os.walk('build/addon'):
    for name in files:
        rel = os.path.relpath(os.path.join(root, name), 'build/addon')
        upload_file(rel)

print('ALL DONE')