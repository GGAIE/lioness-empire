"""Import the two independently authored EP07 ACT04 timelines."""
import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ep07_previous', ROOT / 'scripts/import-ep07-act03.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
base, core = previous.base, previous.core
SCENES, FLAGS = previous.SCENES, previous.FLAGS
ASSETS = []

for name, ident in {
    '艾莉西亞': 'ALYSSIA', '卡利斯': 'KALLIS', '地方領主': 'VALLEY_LORD',
    '傳令兵': 'SIXTH_ORDER_MESSENGER', '聖光會代表': 'CHURCH_DELEGATE',
    '前線目擊者': 'VALLEY_WITNESS', '騎士': 'SIXTH_ORDER_KNIGHT',
    '登記員': 'RELIEF_REGISTRAR', '龍槍使代表': 'DRAGONLANCER_DELEGATE',
    '學院領隊': 'ACADEMY_FIELD_LEADER', '學院研究員': 'ACADEMY_RESEARCHER',
    '學院現場研究員': 'ACADEMY_FIELD_RESEARCHER', '研究員': 'ACADEMY_RESEARCHER',
    '學院測量員': 'ACADEMY_SURVEYOR', '代表': 'DRAGONLANCER_DELEGATE',
}.items():
    core.ROLES[name] = (ident, '龍槍使代表' if name == '代表' else name)
core.INLINE = re.compile(r'(' + '|'.join(sorted(core.ROLES, key=len, reverse=True)) + r')(（[^）]+）)?：「([^」]*)」')

SOURCES = {
    'SACRED': ('01_Full_Script.md', 'cfcbb006013eedaabe848d2c7c93f73b85b1dd93089feec5441230757cc1606a'),
    'WORLD': ('01_World_ACT04_Full_Script_SC01-09.md', 'a5669d4151cc74b3fa8d0398b6decbf6fe8db483995df94ebfc3112b6fa590d0'),
}


class Act(base.Reader):
    def __init__(self, route):
        self.route = route
        self.number, self.act, self.chapter, self.folder = 4, 'ACT04', 'EP07', 'act04'
        filename, digest = SOURCES[route]
        folder = f'sources/ep07/act04/{route.lower()}'
        self.source = f'{folder}/{filename}'
        raw = (ROOT / 'content' / self.source).read_bytes()
        assert core.sha(raw) == digest, 'Review source offsets before importing a revised draft'
        self.rows = [''] + raw.decode('utf-8-sig').splitlines()
        self.headings = [(n, int(m[1]), m[2]) for n, row in enumerate(self.rows)
                         if (m := re.fullmatch(r'## SC(\d\d)[｜〈](.+?)〉?', row))]
        self.titles = {section: title for _, section, title in self.headings}
        assert list(self.titles) == list(range(1, 10))
        audit = core.read(ROOT / 'content' / folder / 'asset-audit.json')
        self.images = {}
        for image in audit['images']:
            assert core.sha((ROOT / image['path']).read_bytes()) == image['sha256']
            self.images[image['key']] = image['id']
            ASSETS.append(dict(id=image['id'], type='cg', src=image['path'],
                               label=f'第七章 第四幕 {route} CG{image["key"]}',
                               status='APPROVED', source=audit['archive']))

    def start(self, section, suffix='', image=None):
        super().start(section, suffix, image)
        self.node['version'] = '1.0.0' if self.route == 'SACRED' else '0.4.0'

    def prose(self, line, when=None, text=None):
        text = (self.rows[line] if text is None else text).strip()
        if self.route == 'WORLD':
            text = {
                141: '奧莉維亞將地圖攤開，視線沿著巨龍活動區域，移向附近的道路、聚落與撤離線。',
                433: '山谷陷入沉默，死龍的骨翼橫在一段道路旁，臨時標記分隔可通行與仍需檢測的區域。',
                560: '一個沒有姓名的證物袋放在燈下。蠟封完整，裡面的儀式碎片暫時還無法辨認。',
            }.get(line, text)
        elif line == 146:
            text = text.replace('短暫插敘。', '').replace('畫面切回帳棚。', '')
        cue = re.match(r'^(?:\[CG(\d\d)(?:｜[^\]]+)?\]|【W04-CG(\d\d)｜[^】]+】)\s*(.*)$', text)
        if cue:
            self.cue(cue[1] or cue[2], line, when)
            text = cue[3]
        if text.startswith(('**時間', '**【', '##', '---', '>')):
            return
        if self.route == 'SACRED':
            text = re.sub(r'\*\*([^*]+)\*\*「', r'\1：「', text)
            text = text.replace('此處掛接艾拉線政治成本，數值與點數不足規則待定。', '')
        text = text.strip('* ')
        if text:
            core.Act.speech(self, text, line, when)

    def block(self, first, last, when=None):
        for line in range(first, last + 1):
            self.prose(line, when)

    def record(self, *events):
        self.node.setdefault('completionFlags', {}).update(
            {previous.declare(f'EP07_{self.route[0]}4_{event}'): True for event in events}
        )

    def choices_from_world(self, line, match):
        code, mode, prompt = match.groups()
        flavor = mode == '無影響'
        stem = '_' + code
        section = self.section
        common = self.id(section, stem + '_COMMON')
        options = []
        responses = {}
        for offset, key in enumerate('ABC', 1):
            row = self.rows[line + offset]
            label, result = re.fullmatch(r'- [ABC](.*?)→\s*(.*)', row).groups()
            label = re.sub(r'^【([^】]+)】', r'\1 · ', label).strip()
            effects = []
            if flavor:
                responses[key] = (line + offset, result)
            else:
                field, value = re.search(r'`([A-Z_]+)=([A-Z_]+)`', result).groups()
                flag = previous.declare('EP07_W4_' + field, 'UNSET')
                effects = [core.flag(flag, value)]
            options.append(self.option(key, label, self.id(section, stem + '_' + key), effects))
        merge = next(n for n in range(line + 4, len(self.rows)) if self.rows[n] == '**【合流】**')
        results = [n for n in range(line + 4, merge) if self.rows[n].startswith('**【分支短結果')]
        assert len(results) == (0 if flavor else 3)
        self.question(prompt, line, options, flavor=flavor)
        image = self.held
        for index, key in enumerate('ABC'):
            self.start(section, stem + '_' + key, image)
            if flavor:
                source_line, response = responses[key]
                self.emit(options[index]['text'], source_line, role='奧莉維亞')
                self.prose(source_line, text=response)
            else:
                last = results[index + 1] if index < 2 else merge
                self.block(results[index] + 1, last - 1)
            self.finish(next=common)
        self.start(section, stem + '_COMMON', image)
        return merge + 1


def world():
    act = Act('WORLD')
    milestones = {
        2: ('REVIVAL_ATTEMPT_CONFIRMED', 'RITUAL_OPERATOR_SWALLOWED'),
        3: ('ACADEMY_INITIAL_RESPONSE_FAILED',),
        4: ('KALLIS_ASSISTED',),
        5: ('DRAGONLANCERS_PARTICIPATED',),
        6: ('OTARIA_UNDEAD_ACTIVITY_STOPPED',),
        9: ('DRAGON_REVIVAL_INVESTIGATION_OPEN',),
    }
    for heading, section, _ in act.headings:
        act.start(section)
        line = heading + 1
        while not re.match(r'\*\*【(?:SC\d\d END|WORLD ACT04 END)', act.rows[line]):
            match = re.fullmatch(r'\*\*【W04-([NM]\d\d)｜(無影響|重大決策)：(.+)】\*\*', act.rows[line])
            if match:
                line = act.choices_from_world(line, match)
            else:
                act.prose(line)
                line += 1
        if section in milestones:
            act.record(*milestones[section])
        if section == 9:
            act.ending('第四幕完 · 死龍與聖戰', pending='第五幕 · 敬請期待')
        else:
            act.finish(next=act.id(section + 1))


def sacred():
    act = Act('SACRED')
    outcomes = ('FAILURE', 'PARTIAL', 'FULL', 'SEAL')
    result = 'EP07_SACRED_NEGOTIATION_RESULT'
    act.start(1)
    act.block(9, 15)
    for line, outcome in zip(range(19, 23), outcomes):
        when = core.eq(result, outcome)
        act.cue('03' if outcome == 'SEAL' else '02', line, when)
        text = re.sub(r'^- \*\*\+\d+\*\*\s*(?:\[CG03\]\s*)?', '', act.rows[line])
        act.prose(line, when, text)
    act.block(24, 34)
    act.finish(next=act.id(2))
    act.start(2)
    act.block(38, 48)
    for line, tags in [(52, outcomes[:1]), (53, outcomes[1:2]), (54, outcomes[2:])]:
        gates = [core.eq(result, tag) for tag in tags]
        text = re.sub(r'^- \*\*[^*]+\*\*\s*', '', act.rows[line])
        act.prose(line, gates[0] if len(gates) == 1 else dict(any=gates), text)
    act.block(56, 64)
    act.finish(next=act.id(3))
    act.start(3)
    act.block(68, 80)
    act.finish(next=act.id(3, '_CHOICE'), conditionalNext=dict(when=base.seal, next=act.id(3, '_HELD_SEAL')))
    act.start(3, '_HELD_SEAL', '12')
    act.block(84, 86)
    act.record('FORMAL_REQUEST_SENT')
    act.prose(100)
    act.finish(next=act.id(4))
    act.start(3, '_CHOICE', '11')
    act.question('如何把求援送到艾莉西亞手中？', 88, [
        act.option('A', '補授永久皇家秘書印', act.id(3, '_GRANT'), [core.flag('FINLEY_SECRETARY_SEAL', True)]),
        act.option('B', '請艾拉動用人脈', act.id(3, '_ELLA')),
    ])
    for suffix, cg, first, last, event in [
        ('_GRANT', '13', 91, 93, 'FORMAL_REQUEST_SENT'),
        ('_ELLA', '14', 95, 98, 'ELLA_REQUEST_SENT'),
    ]:
        act.start(3, suffix, cg)
        act.block(first, last)
        act.record(event)
        act.prose(100)
        act.finish(next=act.id(4))
    for section, first, last in [(4, 104, 120), (5, 124, 156), (6, 160, 180), (7, 184, 202)]:
        act.start(section)
        for line in range(first, last + 1):
            if line == 148:
                act.cue('20', line)
            act.prose(line)
        if section == 6:
            act.record('EVACUATION_COMPLETE')
        if section == 7:
            act.record('OTARIA_UNDEAD_ACTIVITY_STOPPED')
        act.finish(next=act.id(section + 1))
    act.start(8)
    act.block(206, 212)
    act.question('先處理哪一項？', 214, [
        act.option('A', '先安排居民通行', act.id(8, '_A')),
        act.option('B', '先指定證物看守', act.id(8, '_B')),
    ], flavor=True)
    for key, order in [('A', [('35', 217, 218), ('36', 220, 221)]),
                       ('B', [('36', 220, 221), ('35', 217, 218)])]:
        act.start(8, '_' + key)
        for cg, first, last in order:
            act.cue(cg, first)
            act.block(first, last)
        act.block(223, 223)
        act.finish(next=act.id(9))
    act.start(9)
    act.block(227, 247)
    act.record('EVACUATION_RECORDS_READY', 'RITUAL_WITNESS_STATEMENT_RETAINED')
    act.ending('第四幕完 · 龍槍使聖戰', pending='第五幕 · 敬請期待')


def main():
    had_act05 = any(s['act'] == 'ACT05' for s in core.read(ROOT / 'content/episodes/ep07/chapter.json')['scenes'])
    sacred()
    world()
    used = {s.get('cg') for s in SCENES} | {p.get('cg') for s in SCENES for p in s['segments']}
    assert not {asset['id'] for asset in ASSETS} - used
    path = ROOT / 'content/episodes/ep07/chapter.json'
    pack = core.read(path)
    prior = [s for s in pack['scenes'] if s['act'] != 'ACT04']
    for scene in prior:
        if scene['act'] == 'ACT03' and scene.get('completion'):
            end = scene['completion']
            end.pop('pendingLabel', None)
            route = scene['availableWhen']['value']
            title = '龍槍使聖戰' if route == 'SACRED' else '死龍與聖戰'
            end.update(nextSceneId=f'EP07_ACT04_SC01_{route[0]}', nextChapterId='EP07',
                       continueLabel='進入第四幕', nextLabel=f'第四幕〈{title}〉')
    pack.update(version='1.4.0', scenes=prior + SCENES)
    core.write(path, pack)
    path = ROOT / 'content/manifests/story.json'
    manifest = core.read(path)
    manifest['version'] = '0.18.0-ep07-act04'
    manifest['flags'].update(FLAGS)
    core.write(path, manifest)
    path = ROOT / 'content/manifests/assets.json'
    core.write(path, [a for a in core.read(path) if not a['id'].startswith('EP07-ACT04-')] + ASSETS)
    path = ROOT / 'content/characters/index.json'
    characters = core.read(path)
    for ident, label in core.ROLES.values():
        characters.setdefault(ident, label)
    core.write(path, characters)
    print(len(SCENES), 'nodes', sum(len(s['segments']) for s in SCENES), 'segments',
          sum(len(s['choices']) for s in SCENES), 'answers', len(ASSETS), 'CGs')
    if had_act05:
        import subprocess, sys
        subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'scripts/import-ep07-act05.py')], check=True)


if __name__ == '__main__':
    main()
