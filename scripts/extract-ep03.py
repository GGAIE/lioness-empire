"""Import the supplied local EP03 archives without altering originals.

Truncated ZIPs are read only up to complete local entries, checking size/CRC.
No partial image is accepted. Paths inside archives never become output paths.
"""
from pathlib import Path
import hashlib
import json
import re
import struct
import zipfile
import zlib

ROOT = Path(__file__).resolve().parent.parent
INPUT = Path('C:/Users/45P/Downloads/ep03')
OUT = ROOT / 'content/sources/ep03'
OUT.mkdir(parents=True, exist_ok=True)


def digest(b):
    return hashlib.sha256(b).hexdigest()


def entries(p):
    try:
        with zipfile.ZipFile(p) as z:
            return [(n, z.read(n)) for n in z.namelist() if not n.endswith('/')], False
    except zipfile.BadZipFile:
        b = p.read_bytes()
        off, found = 0, []
        while b[off:off + 4] == b'PK\x03\x04':
            _, _, flags, method, _, _, crc, size, usize, nl, el = struct.unpack_from('<IHHHHHIIIHH', b, off)
            if flags & 9 or method not in (0, 8):
                raise ValueError('Unsupported local header')
            start = off + 30 + nl + el
            end = start + size
            if end > len(b):
                break
            name = b[off + 30:off + 30 + nl].decode('utf-8')
            data = b[start:end] if method == 0 else zlib.decompress(b[start:end], -15)
            if len(data) != usize or zlib.crc32(data) != crc:
                raise ValueError('CRC/size mismatch: ' + name)
            found.append((name, data))
            off = end
        if not found:
            raise ValueError('No complete entries: ' + str(p))
        return found, True


backup = ROOT.parent / 'EP03更新前內容備份.zip'
if not backup.exists():
    with zipfile.ZipFile(backup, 'w', zipfile.ZIP_DEFLATED) as z:
        for folder in ['content', 'scripts', 'packages/narrative-core']:
            for f in (ROOT / folder).rglob('*'):
                if f.is_file() and f.suffix in ['.json', '.ts', '.md']:
                    z.write(f, f.relative_to(ROOT))

sources, images = [], []
for p in sorted(INPUT.glob('*.zip')):
    act = int(re.search(r'ACT0([1-5])', p.name)[1])
    items, recovered = entries(p)
    sources.append({'archive': str(p), 'sha256': digest(p.read_bytes()),
                    'bytes': p.stat().st_size, 'act': act, 'truncated': recovered})
    folder = OUT / f'act{act:02}'
    folder.mkdir(exist_ok=True)
    if p.name.startswith('%'):
        for i, (name, b) in enumerate(items):
            if Path(name).suffix in ['.md', '.json', '.txt']:
                # Preserve the earlier index names, including ACT04's directory entry.
                index = i + (1 if act == 4 else 0)
                dest = folder / f'{index:02}{Path(name).suffix}'
                dest.write_bytes(b)
        continue
    for name, b in items:
        if not name.endswith('.png'):
            if Path(name).suffix in ['.md', '.json', '.txt', '.csv']:
                safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', Path(name).name)
                (folder / ('art-' + safe)).write_bytes(b)
            continue
        if act == 4:
            cg = int(re.search(r'CG(\d+)', name)[1])
            ident = f'EP03-ACT04-CG{cg:02}'
        elif 'ALT_CH' in name:
            ident = 'EP03-ACT05-' + re.search(r'ALT_CH\d{2}_[ABC]', name)[0]
        else:
            sc, cg = re.search(r'SC(\d{2})_(?:IMG|CG)?(\d{2})', name).groups()
            ident = f'EP03-ACT{act:02}-CG{sc}-{cg}'
        if not b.startswith(b'\x89PNG\r\n\x1a\n') or b[-12:] != bytes.fromhex('0000000049454e44ae426082'):
            raise ValueError('Incomplete PNG ' + name)
        width, height = struct.unpack_from('>II', b, 16)
        path = f'assets/cg/ep03/act{act:02}/{ident}.png'
        dest = ROOT / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b)
        images.append({'id': ident, 'act': act, 'path': path, 'entry': name,
                       'sha256': digest(b), 'bytes': len(b), 'width': width, 'height': height})

expected = []
for act, counts in [(1, [6, 6, 4, 6, 5]), (2, [5, 5, 6, 5, 6]), (3, [5, 5, 5, 6, 5]), (5, [5, 5, 5, 6, 5])]:
    for sc, count in enumerate(counts, 1):
        expected += [f'EP03-ACT{act:02}-CG{sc:02}-{cg:02}' for cg in range(1, count + 1)]
expected += [f'EP03-ACT04-CG{cg:02}' for cg in range(1, 21)]
expected += [f'EP03-ACT05-ALT_CH{ch:02}_{a}' for ch in [2, 3, 4] for a in 'ABC']
ids = [i['id'] for i in images]
if len(ids) != len(set(ids)) or set(ids) - set(expected):
    raise ValueError('Duplicate or unexpected CG')
audit = {'sources': sources, 'images': sorted(images, key=lambda i: i['id']),
         'missing': sorted(set(expected) - set(ids)), 'expected': len(expected)}
from ep03_act02_fixed import apply_fixed
audit = apply_fixed(ROOT, audit)
(OUT / 'asset-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'available': len(audit['images']), 'expected': len(expected), 'missing': audit['missing']}, indent=2))
