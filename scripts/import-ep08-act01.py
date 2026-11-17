"""Compile the supplied EP08 ACT01 scripts; flavor choices never mutate campaign state."""
import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ep07_act05', ROOT / 'scripts/import-ep07-act05.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
base, core = previous.base, previous.core
SCENES, ASSETS = core.scenes, []
SOURCES = {
    'SACRED': ('EP08_ACT01_Sacred_Full_Script_v1.1.md', '1.1.0'),
    'WORLD': ('01_Full_Script.md', '1.0.0'),
}
TITLES = {'SACRED': '歷史從不騙人', 'WORLD': '不變的事情'}


class Act(base.Reader):
    def __init__(self, route):
        self.route = route
        self.number, self.act, self.chapter, self.folder = 1, 'ACT01', 'EP08', 'act01'
        filename, self.version = SOURCES[route]
        folder = ROOT / f'content/sources/ep08/act01/{route.lower()}'
        self.source = f'sources/ep08/act01/{route.lower()}/{filename}'
        raw = (folder / filename).read_bytes()
        audit = core.read(folder / 'asset-audit.json')
        assert core.sha(raw) == audit['scriptSha256'], 'Review changed source before importing'
        self.rows = [''] + raw.decode('utf-8-sig').splitlines()
        self.titles = {int(m[1]): m[2] for row in self.rows
                       if (m := re.fullmatch(r'## SC(\d\d)｜(.+)', row))}
        assert len(self.titles) == 5
        self.images = {}
        for image in audit['images']:
            assert core.sha((ROOT / image['path']).read_bytes()) == image['sha256']
            self.images[image['key']] = image['id']
            ASSETS.append(dict(id=image['id'], type='cg', src=image['path'],
                               label=f'第八章 第一幕 {route} CG{image["key"]}',
                               status='APPROVED', source=audit['archive']))

    def start(self, section, suffix='', image=None):
        super().start(section, suffix, image)
        self.node.update(planNodeId='EP08_ACT01', version=self.version)

    def prose(self, line):
        raw = self.rows[line].strip()
        if not raw:
            return
        if cue := re.fullmatch(r'【CG\s*(?:W08A01-)?(\d\d)｜[^】]+】', raw):
            self.cue(cue[1], line)
            return
        if raw.startswith(('**', '#', '>', '---', '【')):
            self.note(line, raw)
            return
        text = re.sub(r'^-\s+', '', raw)
        text = text.replace('EP07 那些事情過後', '先前那些事情過後')
        # Slash annotations describe delivery, rather than another speaker.
        text = re.sub(r'^(奧莉維亞|芬利)／([^：]+)：', r'\1（\2）：', text)
        core.Act.speech(self, text, line)

    def flavor(self, line):
        heading = self.rows[line].strip()
        code = re.search(r'C\d\d', heading)[0]
        prompt = heading.split('｜', 1)[1].rstrip('】')
        stop = next(n for n in range(line + 1, len(self.rows))
                    if self.rows[n].startswith(('【合流', '【共同收束')))
        options = []
        for n in range(line + 1, stop):
            row = self.rows[n].strip()
            pattern = r'([ABC])\.(.+)' if self.route == 'SACRED' else r'- \*\*C\d\d-([ABC])\*\*(.+)'
            if m := re.fullmatch(pattern, row):
                options.append((m[1], m[2].strip(), n, []))
            elif row:
                assert options, row
                options[-1][3].append(n)
        assert [o[0] for o in options] == list('ABC'), (line, options)
        section = self.section
        common = self.id(section, f'_{code}_COMMON')
        self.question(prompt, line, [self.option(key, label, self.id(section, f'_{code}_{key}'))
                                     for key, label, _, _ in options], flavor=True)
        image = self.held
        for key, label, source_line, responses in options:
            self.start(section, f'_{code}_{key}', image)
            # Sacred options themselves are Olivia's line. World supplies a full
            # spoken response below each label; emitting both would duplicate it.
            if self.route == 'SACRED':
                self.emit(label, source_line, role='奧莉維亞')
            for n in responses:
                self.prose(n)
            self.finish(next=common)
        self.start(section, f'_{code}_COMMON', image)
        return stop + 1

    def compile(self):
        headings = [n for n, row in enumerate(self.rows) if re.match(r'^## SC\d\d｜', row)]
        for i, first in enumerate(headings, 1):
            self.start(i)
            last = headings[i] if i < 5 else next(
                n for n in range(first + 1, len(self.rows))
                if self.rows[n].startswith(('**【本幕結束】', '**ACT01 END')))
            line = first + 1
            while line < last:
                if self.rows[line].startswith(('【無影響選項', '【FLAVOR CHOICE')):
                    line = self.flavor(line)
                else:
                    self.prose(line)
                    line += 1
            if i < 5:
                self.finish(next=self.id(i + 1))
            else:
                self.finish(kind='end', completion=dict(
                    title='第一幕完 · ' + TITLES[self.route], scope='ACT', nextChapterId='EP08',
                    pendingLabel='第二幕〈國王議會之外〉· 敬請期待', policy='NO_SCORING'))


def main():
    existing_path = ROOT / 'content/episodes/ep08/chapter.json'
    had_act02 = existing_path.exists() and any(s['act'] == 'ACT02' for s in core.read(existing_path)['scenes'])
    had_act03 = existing_path.exists() and any(s['act'] == 'ACT03' for s in core.read(existing_path)['scenes'])
    had_act04 = existing_path.exists() and any(s['act'] == 'ACT04' for s in core.read(existing_path)['scenes'])
    for route in SOURCES:
        Act(route).compile()
    used = {s.get('cg') for s in SCENES} | {p.get('cg') for s in SCENES for p in s['segments']}
    assert not {a['id'] for a in ASSETS} - used
    path = ROOT / 'content/episodes/ep08/chapter.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    core.write(path, dict(schemaVersion=1, id='EP08', version='1.1.0', status='DRAFT',
                          source='使用者提供 Sacred v1.1、World v1.0 逐字稿與 43 張原圖。', scenes=SCENES))
    path = ROOT / 'content/episodes/ep07/chapter.json'
    pack = core.read(path)
    for scene in pack['scenes']:
        if scene['act'] == 'ACT05' and scene.get('completion'):
            route = scene['availableWhen']['value']
            end = scene['completion']
            end.pop('pendingLabel', None)
            end.update(nextSceneId=f'EP08_ACT01_SC01_{route[0]}', nextChapterId='EP08',
                       continueLabel='進入第八章', nextLabel='第八章〈兩個繼承人〉')
    core.write(path, pack)
    path = ROOT / 'content/manifests/story.json'
    manifest = core.read(path)
    manifest['version'] = '0.20.0-ep08-act01'
    chapter = next(c for c in manifest['chapters'] if c['id'] == 'EP08')
    chapter.update(status='DRAFT_AVAILABLE', file='episodes/ep08/chapter.json', entry='EP08_ACT01_SC01_S')
    core.write(path, manifest)
    path = ROOT / 'content/manifests/assets.json'
    core.write(path, [a for a in core.read(path) if not a['id'].startswith('EP08-ACT01-')] + ASSETS)
    print(len(SCENES), 'nodes', sum(len(s['segments']) for s in SCENES), 'segments',
          sum(len(s['choices']) for s in SCENES), 'answers', len(ASSETS), 'CGs')
    if had_act02:
        import subprocess
        import sys
        subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'scripts/import-ep08-act02.py')], check=True)
    if had_act03:
        import subprocess
        import sys
        subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'scripts/import-ep08-act03.py')], check=True)
    if had_act04:
        import subprocess
        import sys
        subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'scripts/import-ep08-act04.py')], check=True)


if __name__ == '__main__':
    main()
