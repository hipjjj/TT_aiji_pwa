"""Build offline lookup data from the pinned ECDICT CSV (stdlib only)."""
import csv
import hashlib
import json
from pathlib import Path
import re
import sys

REVISION = '39cfb9672c0906b63569e0453c2e6abfb9ab182a'
ROOT = Path(__file__).resolve().parents[1]

def bucket(word):
    value = 0
    for char in word:
        value = (value * 31 + ord(char)) & 0xffffffff
    return value % 64

def clean(value):
    return value.replace('\\n', '\n').replace('\\r', '').strip()

def build(source):
    entries, forms = {}, {}
    with open(source, newline='', encoding='utf-8') as stream:
        for row in csv.DictReader(stream):
            word = row['word'].lower()
            if not re.fullmatch(r"[a-z]+(?:['-][a-z]+)*", word) or not row['translation']:
                continue
            exchange = dict(item.split(':', 1) for item in row['exchange'].split('/') if ':' in item)
            value = [clean(row['translation'])[:300], clean(row['phonetic'])[:120], exchange.get('0', '')]
            if word not in entries or row['word'] == word:
                entries[word] = value
            for kind in ('p', 'd', 'i', '3', 'r', 't', 's'):
                form = exchange.get(kind, '')
                if re.fullmatch(r"[a-z]+(?:['-][a-z]+)*", form):
                    forms.setdefault(form, word)
    for form, lemma in forms.items():
        if form not in entries and lemma in entries:
            entries[form] = ['', '', lemma]
    chunks = [{} for _ in range(64)]
    for word, entry in sorted(entries.items()):
        chunks[bucket(word)][word] = entry
    target = ROOT / 'public/study-dictionary'
    target.mkdir(parents=True, exist_ok=True)
    sizes = []
    for index, chunk in enumerate(chunks):
        content = json.dumps(chunk, ensure_ascii=False, separators=(',', ':')).encode() + b'\n'
        (target / f'{index:02d}.json').write_bytes(content)
        sizes.append(len(content))
    manifest = dict(source='https://github.com/skywind3000/ECDICT', revision=REVISION,
                    sourceSha256=hashlib.sha256(Path(source).read_bytes()).hexdigest(),
                    entries=len(entries), chunks=64, bytes=sum(sizes), maxChunkBytes=max(sizes))
    (target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest, indent=2))

if __name__ == '__main__':
    build(sys.argv[1])
