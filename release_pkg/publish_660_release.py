# -*- coding: utf-8 -*-
"""Word Translator v6.6.0 发布脚本：同步源码 + 移动 tag + 重建 Release + 上传 XPI
参照历史 publish_release.py 流程，并修复 (1) 源码同步 (2) tag 指向旧 commit 的问题。"""
import json, base64, os, sys, urllib.request, urllib.parse

TOKEN = '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'
REPO = 'chen7447/word-translator-zotero'
API = 'https://api.github.com'
UPLOAD_API = 'https://uploads.github.com'
VER = '6.6.0'
TAG = 'v6.6.0'
BASE = r'F:\zotero插件\单词翻译'
import json, base64, os, sys, time, urllib.request, urllib.parse

def req(method, url, data=None, content_type='application/json', retries=4):
    last = None
    for attempt in range(retries):
        try:
            r = urllib.request.Request(url, method=method)
            r.add_header('Authorization', 'token ' + TOKEN)
            r.add_header('User-Agent', 'hermes-publish')
            if data is not None:
                if isinstance(data, dict):
                    r.data = json.dumps(data).encode('utf-8')
                    r.add_header('Content-Type', content_type)
                else:
                    r.data = data
                    r.add_header('Content-Type', content_type)
            with urllib.request.urlopen(r, timeout=60) as resp:
                b = resp.read()
                return resp.status, (json.loads(b.decode('utf-8')) if b else {})
        except urllib.error.HTTPError as e:
            b = e.read()
            try:
                return e.code, json.loads(b.decode('utf-8'))
            except Exception:
                return e.code, {'msg': b.decode('utf-8', 'replace')}
        except Exception as e:
            last = e
            time.sleep(3)
    raise last

# 1) 同步 build/addon 源码到 src/wordtranslator（跳过临时/备份文件）
SKIP = ('_chk', '_verify', '.bak-before')
addon = os.path.join(BASE, 'build', 'addon')
synced = []
for root, dirs, files in os.walk(addon):
    for name in files:
        if any(s in name for s in SKIP):
            print('SKIP', name)
            continue
        full = os.path.join(root, name)
        rel = os.path.relpath(full, addon).replace('\\', '/')
        api_path = 'src/wordtranslator/' + rel
        content = base64.b64encode(open(full, 'rb').read()).decode('ascii')
        c, r = req('GET', API + '/repos/' + REPO + '/contents/' + api_path)
        if c == 200 and isinstance(r, dict) and 'content' in r:
            remote_b64 = r['content'].replace('\n', '')
            if remote_b64 == content:
                print('SAME', api_path, '(skip)')
                continue
        payload = {'message': 'chore: sync v6.6.0 source', 'content': content, 'branch': 'main'}
        if c == 200 and isinstance(r, dict) and 'sha' in r:
            payload['sha'] = r['sha']
        c2, r2 = req('PUT', API + '/repos/' + REPO + '/contents/' + api_path, payload)
        print('PUT', api_path, c2)
        if c2 not in (200, 201):
            print('FAIL:', str(r2)[:300])
            sys.exit(1)
        synced.append(rel)

# 2) 更新仓库根 update.json（本地根 update.json 已是 6.6.0）
c, r = req('GET', API + '/repos/' + REPO + '/contents/update.json')
if c != 200:
    print('GET update.json failed', c, str(r)[:200]); sys.exit(1)
uj = open(os.path.join(BASE, 'update.json'), 'rb').read()
payload = {'message': 'chore: update update.json to v6.6.0',
           'content': base64.b64encode(uj).decode('ascii'), 'sha': r['sha'], 'branch': 'main'}
c2, r2 = req('PUT', API + '/repos/' + REPO + '/contents/update.json', payload)
print('PUT update.json', c2)
if c2 not in (200, 201):
    print('FAIL:', str(r2)[:300]); sys.exit(1)

# 3) 获取 main 最新 commit（PUT 已产生新 commit）
c, r = req('GET', API + '/repos/' + REPO + '/branches/main')
main_sha = r['commit']['sha']
print('main head:', main_sha)

# 4) 移动 tag v6.6.0 到 main head
c, r = req('PATCH', API + '/repos/' + REPO + '/git/refs/tags/' + TAG, {'sha': main_sha, 'force': True})
print('MOVE TAG', c, r.get('ref'), '->', r.get('object', {}).get('sha', ''))
if c not in (200, 201):
    print('FAIL:', str(r)[:300]); sys.exit(1)

# 5) 删除旧 release 并重建（Source code 归档按发布时 tag 生成，必须重建）
c, r = req('GET', API + '/repos/' + REPO + '/releases/tags/' + TAG)
if c == 200:
    old_id = r['id']; old_body = r.get('body', ''); old_name = r.get('name', 'Word Translator v6.6.0')
    c, rd = req('DELETE', API + '/repos/' + REPO + '/releases/' + str(old_id))
    print('DELETE release', old_id, c)
else:
    print('WARN no existing release', c)
    old_body = ''; old_name = 'Word Translator v6.6.0'
c, r = req('POST', API + '/repos/' + REPO + '/releases', {
    'tag_name': TAG, 'target_commitish': 'main', 'name': old_name,
    'body': old_body, 'draft': False, 'prerelease': False})
if c not in (200, 201):
    print('CREATE release FAIL:', c, str(r)[:300]); sys.exit(1)
rel_id = r['id']
print('CREATE release', rel_id, r.get('html_url'))

# 6) 上传 XPI 资产
xpi = os.path.join(BASE, 'build', 'wordtranslator-' + VER + '.xpi')
data = open(xpi, 'rb').read()
url = (UPLOAD_API + '/repos/' + REPO + '/releases/' + str(rel_id) +
       '/assets?name=' + urllib.parse.quote('wordtranslator-' + VER + '.xpi'))
c, r = req('POST', url, data, 'application/octet-stream')
print('UPLOAD', c, r.get('name'), r.get('size'), r.get('state'))
if c != 201:
    print('FAIL:', str(r)[:300]); sys.exit(1)

print('ALL DONE')