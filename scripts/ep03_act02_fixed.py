"""Apply the three user-supplied complete ACT02 art archives to the EP03 audit."""
from pathlib import Path
import hashlib
import json
import re
import struct
import zipfile
import zlib


def sha(b):
    return hashlib.sha256(b).hexdigest()


def apply_fixed(root, audit):
    archives = [Path('C:/Users/45P/Downloads') / f'LE_EP03_ACT02_CG_{part}_fixed.zip'
                for part in ['01-09', '10-18', '19-27']]
    if not any(p.exists() for p in archives):
        return audit
    if not all(p.exists() for p in archives):
        raise ValueError('All three fixed archives are required')
    expected = {f'EP03-ACT02-CG{sc:02}-{cg:02}'
                for sc, count in enumerate([5, 5, 6, 5, 6], 1)
                for cg in range(1, count + 1)}
    images, contents, sources = [], {}, []
    for archive in archives:
        sources.append({'archive': str(archive), 'act': 2, 'sha256': sha(archive.read_bytes()),
                        'bytes': archive.stat().st_size, 'truncated': False})
        with zipfile.ZipFile(archive) as z:
            pngs = [i for i in z.infolist() if i.filename.lower().endswith('.png')]
            if len(pngs) != 9:
                raise ValueError('Expected nine PNGs per archive')
            for info in pngs:
                m = re.fullmatch(r'EP03_ACT02_SC(\d{2})_CG(\d{2})_v1\.0\.png', info.filename)
                if not m:
                    raise ValueError('Unexpected filename ' + info.filename)
                ident = f'EP03-ACT02-CG{m[1]}-{m[2]}'
                if ident not in expected or ident in contents:
                    raise ValueError('Duplicate/unexpected CG ' + ident)
                b = z.read(info)  # ZIP CRC is verified by zipfile.
                if not b.startswith(b'\x89PNG\r\n\x1a\n'):
                    raise ValueError('Not PNG ' + ident)
                offset = 8
                while offset < len(b):
                    size = struct.unpack_from('>I', b, offset)[0]
                    end = offset + 12 + size
                    if end > len(b) or zlib.crc32(b[offset + 4:end - 4]) != struct.unpack_from('>I', b, end - 4)[0]:
                        raise ValueError('PNG chunk CRC/size mismatch ' + ident)
                    kind = b[offset + 4:offset + 8]
                    offset = end
                    if kind == b'IEND':
                        break
                if kind != b'IEND' or offset != len(b):
                    raise ValueError('Incomplete PNG ' + ident)
                width, height = struct.unpack_from('>II', b, 16)
                path = f'assets/cg/ep03/act02/fixed-v1.0/{ident}.png'
                contents[ident] = b
                images.append({'id': ident, 'act': 2, 'path': path, 'entry': info.filename,
                               'archive': archive.name, 'sha256': sha(b), 'bytes': len(b),
                               'width': width, 'height': height})
    if set(contents) != expected:
        raise ValueError('Incomplete ACT02 set')
    old = {i['id']: i for i in audit['images'] if i['act'] == 2}
    report_path = root / 'docs/ep03-act02-cg-fix-report.json'
    if not report_path.exists():
        chapter = json.loads((root / 'content/episodes/ep03/chapter.json').read_text(encoding='utf-8'))
        report = {'replacementSources': sources, 'restoredIds': sorted(expected - set(old)),
                  'changedExistingIds': [i['id'] for i in images if i['id'] in old and i['sha256'] != old[i['id']]['sha256']],
                  'sceneHashBefore': sha(json.dumps(chapter['scenes'], sort_keys=True, ensure_ascii=False).encode()),
                  'available': 27, 'missing': []}
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for image in images:
        dest = root / image['path']
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(contents[image['id']])
    # Remove only superseded individual files under the project's ACT02 folders.
    for image in old.values():
        if image['path'] in {i['path'] for i in images}:
            continue
        for prefix in [root, root / 'apps/web-vn/public']:
            dest = (prefix / image['path']).resolve()
            target = (prefix / 'assets/cg/ep03/act02').resolve()
            if not dest.is_relative_to(target):
                raise ValueError('Unsafe old path')
            if dest.is_file():
                dest.unlink()
    audit['images'] = sorted([i for i in audit['images'] if i['act'] != 2] + images, key=lambda i: i['id'])
    audit['missing'] = [i for i in audit['missing'] if i not in expected]
    audit['act02Replacement'] = {'sources': sources, 'available': 27, 'missing': [],
                                'version': 'fixed-v1.0', 'policy': 'Art only; screenplay and stable CG IDs unchanged.'}
    return audit


if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    path = root / 'content/sources/ep03/asset-audit.json'
    audit = json.loads(path.read_text(encoding='utf-8'))
    historical = path.with_name('asset-audit-incomplete-v1.json')
    if not historical.exists():
        historical.write_bytes(path.read_bytes())
    audit = apply_fixed(root, audit)
    path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'available': len(audit['images']), 'missing': audit['missing']}, indent=2))
