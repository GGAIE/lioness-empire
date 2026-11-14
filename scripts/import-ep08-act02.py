"""Import the two distinct EP08 ACT02 worldlines and their supplied political choices."""
import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ep08_act01', ROOT / 'scripts/import-ep08-act01.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
base, core = previous.base, previous.core
SCENES, ASSETS, FLAGS = core.scenes, [], {}
TITLES = {'SACRED': '五十張椅子', 'WORLD': '懸空的席位'}
for name, ident in {
    '文官長': 'PARLIAMENT_CHIEF_CLERK', '書記官': 'PARLIAMENT_CLERK',
    '聖光會代表': 'HOLYLIGHT_PARLIAMENT_DELEGATE', '司儀': 'PARLIAMENT_MASTER_OF_CEREMONIES',
    '商會代表': 'PARLIAMENT_GUILD_DELEGATE', '學院代表': 'PARLIAMENT_ACADEMY_DELEGATE',
    '領主代表': 'PARLIAMENT_LORD_DELEGATE', '赫碧': 'HEBE',
}.items():
    core.ROLES.setdefault(name, (ident, name))
core.INLINE = re.compile(r'(' + '|'.join(sorted(core.ROLES, key=len, reverse=True)) + r')(（[^）]+）)?：「([^」]*)」')


def declare(key):
    FLAGS[key] = dict(initial=False, description='第八章第二幕：神聖線議會改革的事實與已選決策。')
    return key


M01 = [declare('EP08_SACRED_M01_' + x) for x in ['SELF_NOMINATION', 'ROYAL_REVIEW', 'CHURCH_COORDINATION']]
M02 = [declare('EP08_SACRED_M02_' + x) for x in ['URGENT_WITH_CURRENT', 'MIN_REP_FIRST', 'CHURCH_TRANSITION']]
MORE = declare('EP08_SACRED_CHURCH_ASKS_MORE')
DOUBLE = declare('EP08_SACRED_CHURCH_DOUBLE_DEMAND')


class Act(base.Reader):
    def __init__(self, route):
        self.route = route
        self.number, self.act, self.chapter, self.folder = 2, 'ACT02', 'EP08', 'act02'
        folder = ROOT / f'content/sources/ep08/act02/{route.lower()}'
        audit = core.read(folder / 'asset-audit.json')
        self.source = f'sources/ep08/act02/{route.lower()}/{audit["script"]}'
        raw = (ROOT / 'content' / self.source).read_bytes()
        assert core.sha(raw) == audit['scriptSha256'], 'Review changed source before importing'
        self.rows = [''] + raw.decode('utf-8-sig').splitlines()
        self.titles = {int(m[1]): m[2] for row in self.rows
                       if (m := re.fullmatch(r'## SC(\d\d)(?:｜|〈)(.+?)〉?', row))}
        assert len(self.titles) == 5
        self.images = {}
        for image in audit['images']:
            assert core.sha((ROOT / image['path']).read_bytes()) == image['sha256']
            self.images[image['key']] = image['id']
            ASSETS.append(dict(id=image['id'], type='cg', src=image['path'],
                               label=f'第八章 第二幕 {route} CG{image["key"]}',
                               status='APPROVED', source=audit['archive']))

    def start(self, section, suffix='', image=None):
        super().start(section, suffix, image)
        self.node.update(planNodeId='EP08_ACT02', version='1.0.0')

    def prose(self, line):
        raw = self.rows[line].strip()
        if not raw:
            return
        if cue := re.fullmatch(r'【CG\s*(?:W08A02-)?(\d\d[AB]?)｜[^】]+】', raw):
            self.cue(cue[1], line)
            return
        if raw.startswith(('**', '#', '>', '---', '【', '轉 SC', '——轉 SC')):
            self.note(line, raw)
            return
        if self.route == 'WORLD' and line == 380:
            self.note(line, raw)
            return
        text = re.sub(r'^-\s+', '', raw).replace('**', '')
        text = re.sub(r'^([\u4e00-\u9fff]+)／([^：]+)：', r'\1（\2）：', text)
        text = text.replace('ACT01 那場東北塔夜談', '先前那場東北塔夜談').replace('鏡頭緩緩抬高。', '')
        text = text.replace('圖上沒有可讀文字，只有', '圖上只有')
        if self.route == 'WORLD' and line == 184:
            text = '議場中，既有議員與新任代表各自落座。學院席位仍只是議會的一部分，並未成為多數。'
        if self.route == 'SACRED' and line == 218:
            text = '眼前的麻煩或許會少一些；長期看來，代價卻明顯更重。'
        if self.route == 'SACRED' and line == 397:
            text = '奧莉維亞接受了這份過渡方案。眼前的秩序確實會比較省事；可聖光會也等於再一次把手伸進新議會的運作骨架裡。'
        core.Act.speech(self, text, line)

    def flavor(self, line):
        code = re.search(r'[CF]\d\d', self.rows[line])[0]
        prompt = self.rows[line].split('｜', 1)[1].rstrip('】')
        stop = next(n for n in range(line + 1, len(self.rows))
                    if self.rows[n].startswith('【合流') or '共通匯合】' in self.rows[n])
        options = []
        for n in range(line + 1, stop):
            row = self.rows[n].strip()
            pattern = r'([ABC])\.(.+)' if self.route == 'SACRED' else r'- F\d\d-([ABC])(.+)'
            if m := re.fullmatch(pattern, row):
                options.append((m[1], m[2].strip(), n, []))
            elif row:
                assert options, row
                options[-1][3].append(n)
        assert [o[0] for o in options] == list('ABC')
        section = self.section
        common = self.id(section, f'_{code}_COMMON')
        self.question(prompt, line, [self.option(key, label, self.id(section, f'_{code}_{key}'))
                                     for key, label, _, _ in options], flavor=True)
        image = self.held
        for key, label, source_line, responses in options:
            self.start(section, f'_{code}_{key}', image)
            if self.route == 'SACRED':
                self.emit(label, source_line, role='奧莉維亞')
            for n in responses:
                self.prose(n)
            self.finish(next=common)
        self.start(section, f'_{code}_COMMON', image)
        return stop + 1

    def major(self, line):
        code = re.search(r'[MP]\d\d', self.rows[line])[0]
        prompt = self.rows[line].split('｜', 1)[1].rstrip('】')
        if self.route == 'SACRED':
            starts = [n for n in range(line + 1, len(self.rows)) if re.match(rf'### {code}-[ABC]｜', self.rows[n])]
            stop = next(n for n in range(starts[-1] + 1, len(self.rows)) if self.rows[n].startswith(f'【合流｜{code}'))
            labels = [re.search(r'\*\*(.+)\*\*', self.rows[n])[1] for n in range(line + 1, starts[0])
                      if re.match(r'> [123]\. ', self.rows[n])]
            deltas = [10, -20, -35] if code == 'M01' else [5, -15, -30]
            keys = M01 if code == 'M01' else M02
            effects = [[core.points(delta), core.flag(key, True)] for delta, key in zip(deltas, keys)]
            effects[2].append(core.flag(MORE, True))
        else:
            starts = [n for n in range(line + 1, len(self.rows)) if re.match(r'### P01-[AB] Result', self.rows[n])]
            stop = next(n for n in range(starts[-1] + 1, len(self.rows)) if self.rows[n].startswith('### P01 共同匯合'))
            labels = [re.fullmatch(r'\*\*P01-[AB]｜(.+)\*\*\s*', self.rows[n])[1]
                      for n in range(line + 1, starts[0]) if self.rows[n].startswith('**P01-')]
            effects = [[core.points(20), dict(type='unrest', delta=10, clamp=True)],
                       [core.points(-15), dict(type='unrest', delta=-5, clamp=True)]]
        assert len(starts) == len(labels) == len(effects)
        section = self.section
        common = self.id(section, f'_{code}_COMMON')
        self.question(prompt, line, [self.option(key, label, self.id(section, f'_{code}_{key}'), effect)
                                     for key, label, effect in zip('ABC', labels, effects)])
        image = self.held
        for i, first in enumerate(starts):
            key = 'ABC'[i]
            self.start(section, f'_{code}_{key}', image)
            for n in range(first + 1, starts[i + 1] if i + 1 < len(starts) else stop):
                self.prose(n)
            if self.route == 'SACRED' and code == 'M02' and key == 'C':
                self.node['completionEffects'] = dict(when=core.eq(M01[2], True), effects=[core.flag(DOUBLE, True)])
                self.node['scoring'] = 'STORY_EFFECTS'
            self.finish(next=common)
        self.start(section, f'_{code}_COMMON', image)
        return stop + 1

    def compile(self):
        headings = [n for n, row in enumerate(self.rows) if re.match(r'^## SC\d\d[｜〈]', row)]
        for i, first in enumerate(headings, 1):
            self.start(i)
            last = headings[i] if i < 5 else next(n for n in range(first + 1, len(self.rows))
                       if self.rows[n].startswith(('**【本幕結束】', '**ACT02 END')))
            line = first + 1
            while line < last:
                row = self.rows[line]
                if row.startswith(('【無影響選項', '【FLAVOR CHOICE')):
                    line = self.flavor(line)
                elif row.startswith(('### 主要選擇', '【政治主要選擇')):
                    line = self.major(line)
                else:
                    self.prose(line)
                    line += 1
            if self.route == 'SACRED':
                facts = {1: ['NEW_HALL_OPENED', 'PARLIAMENT_EXPANDED_50', 'HOLYLIGHT_ONE_SEAT', 'REPRESENTATION_SOURCES_DECLARED'],
                         2: ['NOMINATIONS_INCOMPLETE'], 5: ['THEOCRACY_CASE_ACCEPTED']}.get(i, [])
                if facts:
                    self.node['completionFlags'] = {declare('EP08_SACRED_' + name): True for name in facts}
            if i < 5:
                self.finish(next=self.id(i + 1))
            else:
                self.finish(kind='end', completion=dict(title='第二幕完 · ' + TITLES[self.route], scope='ACT',
                    nextChapterId='EP08', pendingLabel='第三幕〈熔岩之下的契約〉· 敬請期待', policy='NO_SCORING'))


def main():
    for route in TITLES:
        Act(route).compile()
    used = {s.get('cg') for s in SCENES} | {p.get('cg') for s in SCENES for p in s['segments']}
    assert not {a['id'] for a in ASSETS} - used
    path = ROOT / 'content/episodes/ep08/chapter.json'
    pack = core.read(path)
    prior = [s for s in pack['scenes'] if s['act'] != 'ACT02']
    for s in prior:
        if s['act'] == 'ACT01' and s.get('completion'):
            route = s['availableWhen']['value']
            end = s['completion']
            end.pop('pendingLabel', None)
            end.update(nextSceneId=f'EP08_ACT02_SC01_{route[0]}', nextChapterId='EP08',
                       continueLabel='進入第二幕', nextLabel='第二幕〈' + TITLES[route] + '〉')
    pack.update(version='1.2.0', source='使用者提供第八章第一、二幕兩條世界線逐字稿及原圖。', scenes=prior + SCENES)
    core.write(path, pack)
    path = ROOT / 'content/manifests/story.json'
    manifest = core.read(path)
    manifest['version'] = '0.21.0-ep08-act02'
    manifest['flags'].update(FLAGS)
    core.write(path, manifest)
    path = ROOT / 'content/manifests/assets.json'
    core.write(path, [a for a in core.read(path) if not a['id'].startswith('EP08-ACT02-')] + ASSETS)
    path = ROOT / 'content/characters/index.json'
    characters = core.read(path)
    for ident, name in core.ROLES.values():
        characters.setdefault(ident, name)
    core.write(path, characters)
    print(len(SCENES), 'nodes', sum(len(s['segments']) for s in SCENES), 'segments',
          sum(len(s['choices']) for s in SCENES), 'answers', len(ASSETS), 'CGs')


if __name__ == '__main__':
    main()
