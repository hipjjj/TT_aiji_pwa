"""Download pinned travel source snapshots without weakening checksums or TLS."""
import concurrent.futures
import hashlib
import json
import pathlib
import sys
import urllib.parse
import urllib.request

root = pathlib.Path(__file__).resolve().parent.parent
cache = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/tt-travel-source')
map_manifest = json.loads((root / 'scripts/travel-source/map-manifest.json').read_text())
scenic_manifest = json.loads((root / 'scripts/travel-source/scenic-manifest.json').read_text())
cache.mkdir(parents=True, exist_ok=True)

def fetch(item):
    path, url, expected = item
    target = cache / path
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == expected:
        return
    with urllib.request.urlopen(url, timeout=30) as response:
        content = response.read()
    if hashlib.sha256(content).hexdigest() != expected:
        raise ValueError('Source checksum mismatch: ' + path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)

jobs = [(item['path'], f"https://raw.githubusercontent.com/{map_manifest['repo']}/{map_manifest['commit']}/{urllib.parse.quote(item['path'])}", item['sha256']) for item in map_manifest['files']]
jobs.append(('scenic-5a.json', f"https://raw.githubusercontent.com/{scenic_manifest['repo']}/{scenic_manifest['commit']}/{scenic_manifest['file']}", scenic_manifest['sha256']))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(fetch, jobs))
print('Verified', len(jobs), 'source files in', cache)
