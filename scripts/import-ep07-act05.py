"""Compile EP07 ACT05 from the user-provided Sacred v1.1 and World v1.0 scripts."""
import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ep07_act04', ROOT / 'scripts/import-ep07-act04.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
base, core = previous.base, previous.core
SCENES, FLAGS = previous.SCENES, previous.FLAGS
declare = previous.previous.declare
ASSETS = []

core.ROLES.update({
    '第六團文書': ('SIXTH_ORDER_SCRIBE', '第六團文書'),
    '塔馬拉、芬利': ('TAMARA_FINLEY', '塔馬拉、芬利'),
    '芬利、塔馬拉': ('TAMARA_FINLEY', '芬利、塔馬拉'),
})
core.INLINE = re.compile(r'(' + '|'.join(sorted(core.ROLES, key=len, reverse=True)) + r')(（[^）]+）)?：「([^」]*)」')
SOURCES = {
    'SACRED': ('EP07_ACT05_Sacred_Full_Script_v1.1.md', '186bf5ee06f7e2a1e346c17440bceef173da131734c0edf142edbc981381ed46'),
    'WORLD': ('01_Full_Script_SC01-SC05.md', '70c781c0a036220e0b3229af365532d3ca14c974764f6b4bbb86c5b73148c25d'),
}
PAIR_DONE = declare('EP07_T2_F4_RESOLVED')
for event in ('T2_CLEAR', 'F4_CLEAR'):
    declare(event)


class Act(base.Reader):
    def __init__(self, route):
        self.route = route
        self.number, self.act, self.chapter, self.folder = 5, 'ACT05', 'EP07', 'act05'
        filename, digest = SOURCES[route]
        folder = f'sources/ep07/act05/{route.lower()}'
        self.source = f'{folder}/{filename}'
        raw = (ROOT / 'content' / self.source).read_bytes()
        assert core.sha(raw) == digest, 'Review offsets when the source script changes'
        self.rows = [''] + raw.decode('utf-8-sig').splitlines()
        self.titles = {int(m[1]): m[2] for row in self.rows
                       if (m := re.fullmatch(r'# SC(\d\d)[〈｜](.+?)〉?', row))}
        self.images = {}
        for image in core.read(ROOT / 'content' / folder / 'asset-audit.json')['images']:
            assert core.sha((ROOT / image['path']).read_bytes()) == image['sha256']
            self.images[image['key']] = image['id']
            ASSETS.append(dict(id=image['id'], type='cg', src=image['path'],
                               label=f'第七章 第五幕 {route} CG{image["key"]}',
                               status='APPROVED', source='使用者提供第五幕原圖。'))

    def start(self, section, suffix='', image=None):
        super().start(section, suffix, image)
        self.node['version'] = '1.1.0' if self.route == 'SACRED' else '1.0.0'

    def prose(self, line, when=None, text=None):
        text = (self.rows[line] if text is None else text).strip()
        if self.route == 'WORLD':
            text = text.replace('他在 ACT04 的危機後', '他在先前的危機後')
            if line == 257:
                self.emit(text, line, when, role='卡利斯')
                return
            cue = re.fullmatch(r'\[CG W05-(\d\d)\]', text)
            if cue:
                self.cue(cue[1], line, when)
                return
        text = text.replace('**', '')
        if text.startswith(('#', '---')):
            return
        text = text.replace('ACT01 那封', '先前那封').replace('ACT01 的王宮大堂', '先前整理的王宮大堂')
        text = text.replace('在本章內', '在這段期間').replace('ACT02，', '另外，')
        text = text.replace('然後是 ACT03。', '然後是虛空污染。').replace('ACT04，', '之後，')
        text = text.replace('下一章最不會自己消失的問題', '接下來最不會自己消失的問題')
        text = text.replace('如果下一章能少付一點錢就好了', '如果接下來能少付一點錢就好了')
        if text:
            core.Act.speech(self, text, line, when)

    def block(self, first, last, when=None):
        for line in range(first, last + 1):
            self.prose(line, when)

    def flavor(self, code, prompt, options, responses, line):
        section = self.section
        common = self.id(section, '_' + code + '_COMMON')
        choices = [self.option(key, label, self.id(section, '_' + code + '_' + key))
                   for key, label in zip('ABC', options)]
        self.question(prompt, line, choices, flavor=True)
        image = self.held
        for key, label, (first, last) in zip('ABC', options, responses):
            self.start(section, '_' + code + '_' + key, image)
            if label.startswith('「'):
                self.emit(label, line, role='奧莉維亞')
            else:
                self.prose(line, text=label)
            self.block(first, last)
            self.finish(next=common)
        self.start(section, '_' + code + '_COMMON', image)

    def sacred_flavor(self, line, code):
        heading = self.rows[line]
        prompt = heading.split('｜', 1)[1]
        options = [re.sub(r'^[ABC]\.\s*', '', self.rows[line + n]).strip() for n in (1, 2, 3)]
        starts = [n for n in range(line + 4, len(self.rows)) if self.rows[n].startswith('#### ')]
        starts = starts[:3]
        stop = next(n for n in range(starts[2] + 1, len(self.rows))
                    if self.rows[n].startswith(('### ', '---', '**系統', '**幕終')))
        ranges = [(start + 1, starts[i + 1] - 1 if i < 2 else stop - 1) for i, start in enumerate(starts)]
        options = [option.replace('如果下一章', '如果接下來') for option in options]
        self.flavor(code, prompt, options, ranges, line)

    def record(self, *events):
        self.node.setdefault('completionFlags', {}).update(
            {declare(f'EP07_{self.route[0]}5_{event}'): True for event in events}
        )

    def resolve_pair(self, success):
        pending = core.eq(PAIR_DONE, False)
        settlements = []
        if success:
            for event, character in [('T2_CLEAR', 'tamara'), ('F4_CLEAR', 'finley')]:
                settlements.append(dict(when=core.both(pending, core.eq(event, False)),
                                        effects=[dict(type='clear', key=character, delta=1)]))
        settlements.append(dict(when=pending, effects=[
            core.flag('T2_CLEAR', success), core.flag('F4_CLEAR', success), core.flag(PAIR_DONE, True),
        ]))
        self.node['settlements'] = settlements
        self.node['scoring'] = 'STORY_EFFECTS'

    def ending(self):
        self.finish(kind='end', completion=dict(
            title='第七章完 · 留下來的帳', scope='CHAPTER', nextChapterId='EP08',
            pendingLabel='第八章〈兩個繼承人〉· 敬請期待', policy='NO_SCORING',
        ))


def sacred():
    act = Act('SACRED')
    anchors = {57: '01', 81: '02', 89: '03', 105: '04', 107: '05',
               159: '06', 165: '07', 170: '08',
               225: '10', 231: '11', 243: '12', 247: '13', 269: '14',
               285: '15', 311: '16', 331: '17', 341: '18', 359: '19',
               432: '20', 446: '21', 438: '22',
               464: '23', 481: '24', 486: '24', 496: '25', 512: '26'}
    # Inject CG anchors in prose and in conditional response blocks without altering source text.
    raw_prose = act.prose

    def anchored_prose(line, when=None, text=None):
        if line in anchors and text is None:
            act.cue(anchors[line], line, when)
        raw_prose(line, when, text)

    act.prose = anchored_prose
    act.start(1)
    act.block(57, 109)
    act.sacred_flavor(111, 'N01')
    act.sacred_flavor(127, 'N02')
    act.emit(' ', 143, kind='caption')
    outcomes = ('FAILURE', 'PARTIAL', 'FULL', 'SEAL')
    summaries = [
        '教會送來的資料仍有缺漏，艾琳達與王室逐項核對了善後需求。',
        '教會的回報已經比較完整，幾處仍需再向地方核實。',
        '米耶爾已重新協調收容站與醫療隊的對接，相關回報一併送達。',
        '米耶爾已重新協調收容與醫療對接，芬利也依既有制度查驗正式交接紀錄。',
    ]
    for outcome, text in zip(outcomes, summaries):
        act.prose(143, core.eq('EP07_SACRED_NEGOTIATION_RESULT', outcome), text=text)
    act.finish(next=act.id(2))
    act.start(2)
    act.block(159, 167)
    act.block(170, 174, base.protected)
    act.block(177, 181, {'not': base.protected})
    act.sacred_flavor(183, 'N03')
    act.sacred_flavor(199, 'N04')
    act.cue('09', 215)
    act.emit(' ', 215, kind='caption')
    act.finish(next=act.id(3))
    act.start(3)
    act.block(225, 275)
    act.sacred_flavor(277, 'N05')
    act.sacred_flavor(294, 'N06')
    act.block(311, 315)
    act.record('SMUGGLING_CONFIRMED', 'VOID_CRYSTALS_IDENTIFIED')
    act.finish(next=act.id(4))
    act.start(4)
    act.block(331, 365)
    act.sacred_flavor(367, 'N07')
    act.sacred_flavor(383, 'N08')
    handling = declare('EP07_S5_CRYSTAL_HANDLING', 'UNSET')
    labels = ['先由王室自行封存', '交還皇家魔法學派', '交給艾莉西亞']
    act.question('如何處置虛空能量結晶？', 401, [
        act.option(key, label, act.id(4, '_DISPOSAL_' + key),
                   [core.flag(handling, value)])
        for key, label, value in zip('ABC', labels, ['ROYAL_CUSTODY', 'ACADEMY_RETURN', 'ALYSSIA_TRANSFER'])
    ])
    for key, first, last in [('A', 404, 410), ('B', 418, 424), ('C', 432, 450)]:
        act.start(4, '_DISPOSAL_' + key, '19')
        act.block(first, last)
        act.resolve_pair(key == 'C')
        act.finish(next=act.id(5))
    act.start(5)
    act.block(464, 476)
    success = core.eq(handling, 'ALYSSIA_TRANSFER')
    act.block(481, 483, success)
    act.block(486, 488, {'not': success})
    for line, outcome in zip(range(491, 495), outcomes):
        text = re.sub(r'^- \*\*[^*]+\*\*：', '', act.rows[line])
        act.prose(line, core.eq('EP07_SACRED_NEGOTIATION_RESULT', outcome), text)
    act.block(496, 512)
    act.sacred_flavor(514, 'N09')
    act.sacred_flavor(530, 'N10')
    act.ending()


def world_flavor(act, line, code):
    title = re.fullmatch(r'### \[CHOICE W05-[^\]]+\] (.+)（無影響）', act.rows[line])[1]
    option_lines = [n for n in range(line + 1, len(act.rows)) if re.match(r'^\*\*[ABC]｜', act.rows[n])][:3]
    stop = next(n for n in range(option_lines[2] + 1, len(act.rows)) if act.rows[n].startswith('**[合流'))
    labels = [re.fullmatch(r'\*\*[ABC]｜(.+)\*\*\s*', act.rows[n])[1] for n in option_lines]
    ranges = [(n + 1, option_lines[i + 1] - 1 if i < 2 else stop - 1) for i, n in enumerate(option_lines)]
    act.flavor(code, title, labels, ranges, line)
    return stop + 1


def world():
    act = Act('WORLD')
    act.start(1)
    act.block(23, 43)
    act.question('是否親自前往第六團？', 45, [
        act.option(key, label, act.id(1, '_' + key))
        for key, label in zip('ABC', ['親自前往卡巴岡德，當面確認後續事務。',
                                   '以王室名義寄送正式慰問書函。',
                                   '既然善後已有安排，就不額外干涉。'])
    ])
    done = declare('EP07_W5_A2_RESOLVED')
    for key, first, last in [('A', 53, 121), ('B', 127, 133), ('C', 139, 143)]:
        act.start(1, '_' + key, '02')
        act.block(first, last)
        pending = core.eq(done, False)
        settlements = []
        if key == 'A':
            settlements.append(dict(when=core.both(pending, core.eq('ALINDA_A2_CLEAR', False)),
                                    effects=[dict(type='clear', key='alinda', delta=1)]))
        settlements.append(dict(when=pending, effects=[core.flag('ALINDA_A2_CLEAR', key == 'A'), core.flag(done, True)]))
        act.node['settlements'] = settlements
        act.node['scoring'] = 'STORY_EFFECTS'
        act.finish(next=act.id(2))
    sections = [(2, 152, 223), (3, 233, 310), (4, 320, 486), (5, 495, 568)]
    for section, first, last in sections:
        act.start(section)
        line = first
        while line <= last:
            if act.rows[line].startswith('### [CHOICE'):
                code = re.search(r'W05-([^\]]+)', act.rows[line])[1]
                line = world_flavor(act, line, code)
                continue
            if section == 2 and line == 205:
                act.block(207, 209, core.eq('S3_CLEAR', True))
                act.block(213, 215, core.eq('S3_CLEAR', False))
                line = 218
                continue
            act.prose(line)
            line += 1
        if section == 3:
            act.record('CARGO_LOCATION_IDENTIFIED')
        if section == 4:
            act.resolve_pair(True)
            act.record('CRYSTALS_SUBLIMATED', 'AYLA_RECORDS_CROSSCHECKED')
        if section == 5:
            act.ending()
        else:
            act.finish(next=act.id(section + 1))


def main():
    sacred()
    world()
    used = {s.get('cg') for s in SCENES} | {p.get('cg') for s in SCENES for p in s['segments']}
    assert not {a['id'] for a in ASSETS} - used, sorted({a['id'] for a in ASSETS} - used)
    path = ROOT / 'content/episodes/ep07/chapter.json'
    pack = core.read(path)
    prior = [s for s in pack['scenes'] if s['act'] != 'ACT05']
    for scene in prior:
        if scene['act'] == 'ACT04' and scene.get('completion'):
            end = scene['completion']
            end.pop('pendingLabel', None)
            route = scene['availableWhen']['value']
            end.update(nextSceneId=f'EP07_ACT05_SC01_{route[0]}', nextChapterId='EP07',
                       continueLabel='進入第五幕', nextLabel='第五幕〈留下來的帳〉')
    pack.update(version='1.5.0', scenes=prior + SCENES)
    core.write(path, pack)
    path = ROOT / 'content/manifests/story.json'
    manifest = core.read(path)
    manifest['version'] = '0.19.0-ep07-complete'
    manifest['flags'].update(FLAGS)
    core.write(path, manifest)
    path = ROOT / 'content/manifests/assets.json'
    core.write(path, [a for a in core.read(path) if not a['id'].startswith('EP07-ACT05-')] + ASSETS)
    path = ROOT / 'content/characters/index.json'
    characters = core.read(path)
    for ident, label in core.ROLES.values():
        characters.setdefault(ident, label)
    core.write(path, characters)
    print(len(SCENES), 'nodes', sum(len(s['segments']) for s in SCENES), 'segments',
          sum(len(s['choices']) for s in SCENES), 'answers', len(ASSETS), 'CGs')


if __name__ == '__main__':
    main()

