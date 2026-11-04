"""Produce an upload archive with index.html at its root, not inside a parent folder."""
from pathlib import Path
import zipfile
root = Path(__file__).resolve().parent.parent
folder = root / 'github-pages'
if not (root / 'index.html').is_file() or not (root / '_config.yml').is_file() or not (folder / 'index.html').is_file():
    raise SystemExit('Build the Pages package first')
archive = root / '母獅帝國_GitHubPages_上傳包.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as out:
    for name in ['index.html', '_config.yml']:
        out.write(root / name, name)
    for path in sorted(folder.rglob('*')):
        if path.is_file():
            out.write(path, path.relative_to(root).as_posix())
print(str(archive))
