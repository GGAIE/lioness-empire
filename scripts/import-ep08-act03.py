"""EP08 ACT03: source-pinned worldlines, delayed Sacred settlement and World notice recall."""
import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ep08_act02', ROOT / 'scripts/import-ep08-act02.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
base, core = previous.base, previous.core
SCENES, ASSETS, FLAGS = core.scenes, [], {}
TITLES = {'SACRED': '無人承接的契約', 'WORLD': '山火記得的名字'}
for name, ident in {'奧瑞亞': 'AUREA', '長者': 'VOLCANIC_TRIBE_ELDER', '部族長者': 'VOLCANIC_TRIBE_ELDER',
                    '使者': 'ROYAL_DISPATCH_MESSENGER', '圓眼鏡教授': 'MAGIC_HISTORY_PROFESSOR_GLASSES',
                    '白鬍子教授': 'MAGIC_HISTORY_PROFESSOR_BEARD', '女教授': 'MAGIC_HISTORY_PROFESSOR_WOMAN'}.items():
    core.ROLES.setdefault(name, (ident, name))
core.INLINE = re.compile(r'(' + '|'.join(sorted(core.ROLES, key=len, reverse=True)) + r')(（[^）]+）)?：「([^」]*)」')


def declare(key, value=False):
    FLAGS[key] = dict(initial=value, description='第八章第三幕：路線獨立的決策、事件與一次性結算。')
    return key


SM = {code: declare('EP08_S3_' + code, 'UNSET') for code in ['M01', 'M02', 'M03']}
SRESULT = declare('EP08_SACRED_RESULT', 'UNSET')
SDONE = declare('EP08_S3_SETTLED')
SGRANT = declare('EP08_SACRED_ALINDA_EVENT_CLEAR_GRANTED')
OVERREACH = declare('EP08_SACRED_CHURCH_OVERREACH_EARLY')
BOUNDARY = declare('EP08_SACRED_FORMAL_LOCAL_BOUNDARY')
NOTICE = declare('EP08_WORLD_NOTICE_EIRINDA')
SURVEY = declare('EP08_WORLD_EIRINDA_SURVEY_RESULT', 'UNSET')
WP = {'P01': declare('EP08_WORLD_ACT03_LOCAL_SUPPORT', 'UNSET'),
      'P02': declare('EP08_WORLD_ACT03_HISTORY_RELEASE', 'UNSET')}
WVALUES = {'P01': ['PRIORITY_COOPERATION', 'DAILY_RECOVERY'], 'P02': ['PUBLIC_REPORT', 'LOCAL_FIRST']}
RESOLVER = core.read(ROOT / 'content/sources/ep08/act03/sacred/04_Production/Choice_Resolver_v1.1.json')['outcomes']
assert len(RESOLVER) == 27 and len({(r['M01'], r['M02'], r['M03']) for r in RESOLVER}) == 27
OUTCOMES = ['BIG_SUCCESS', 'SMALL_SUCCESS', 'SMALL_FAILURE', 'BIG_FAILURE']


def any_of(conditions):
    return dict(any=conditions)


def result_condition(result, last=None):
    rows = [r for r in RESOLVER if r['result'] == result and (last is None or r['M03'] == last)]
    return any_of([core.both(*[core.eq(SM[c], r[c]) for c in (['M01', 'M02'] if last else ['M01', 'M02', 'M03'])]) for r in rows])


class Act(base.Reader):
    def __init__(self, route):
        self.route = route
        self.number, self.act, self.chapter, self.folder = 3, 'ACT03', 'EP08', 'act03'
        folder = ROOT / f'content/sources/ep08/act03/{route.lower()}'
        audit = core.read(folder / 'asset-audit.json')
        self.source = f'sources/ep08/act03/{route.lower()}/{audit["script"]}'
        raw = (ROOT / 'content' / self.source).read_bytes()
        assert core.sha(raw) == audit['scriptSha256']
        self.rows = [''] + raw.decode('utf-8-sig').splitlines()
        self.titles = {int(m[1]): m[2] for row in self.rows if (m := re.fullmatch(r'## SC(\d\d)｜(.+)', row))}
        assert len(self.titles) == 5
        self.images = {}
        for x in audit['images']:
            assert core.sha((ROOT / x['path']).read_bytes()) == x['sha256']
            self.images[x['key']] = x['id']
            ASSETS.append(dict(id=x['id'], type='cg', src=x['path'], label=f'第八章 第三幕 {route} CG{x["key"]}',
                               status='APPROVED', source=audit['archive']))

    def start(self, section, suffix='', image=None):
        super().start(section, suffix, image)
        self.node.update(planNodeId='EP08_ACT03', version='1.1.0' if self.route == 'SACRED' else '1.0.0')
        # Free reading still needs committed decisions before entering their
        # consequences; an unset input must never silently become a failure.
        prerequisites = []
        if self.route == 'SACRED' and section >= 3:
            prerequisites.append({'not': core.eq(SM['M01'], 'UNSET')})
            if section >= 4:
                prerequisites.append({'not': core.eq(SM['M02'], 'UNSET')})
        if self.route == 'WORLD' and section >= 3:
            prerequisites.append({'not': core.eq(WP['P01'], 'UNSET')})
        if prerequisites:
            self.node['availableWhen'] = core.both(self.node['availableWhen'], *prerequisites)
        if self.route == 'WORLD' and section == 4 and (suffix == '_NOTICE_COMMON' or suffix.startswith('_F07')):
            self.node['cg'] = self.images['15B']
            self.node['cgWhen'] = [dict(when=core.eq(NOTICE, True), cg=self.images['15A'])]

    def prose(self, line, when=None):
        text = self.rows[line].strip().replace('**', '')
        if not text:
            return
        if m := re.fullmatch(r'【CG\s*(?:W08A03-)?(\d\d[AB]?)｜[^】]+】', text):
            self.cue(m[1], line, when)
            return
        if text.startswith(('#', '>', '---', '【', '時間：', '出場：', 'BGM：', 'BG：', '玩家可見', '（場景短暫')):
            self.note(line, text)
            return
        text = re.sub(r'^([\u4e00-\u9fff]+)／([^：]+)：', r'\1（\2）：', text)
        text = text.replace('故事的最後一幕，並不在王都。', '遠在王都之外，舊祭場前依舊吹著山風。')
        if self.route == 'SACRED' and line == 693:
            self.emit('聖光會的後續教化安排被允許繼續，並取得了在聚落常設監督據點的資格。', line,
                      core.both(when, core.eq(SM['M03'], 'C')) if when else core.eq(SM['M03'], 'C'))
            self.emit('早期越界已經發生，王室最終卻只要求地方與教會自行磨合，未能充分收回先前的授權。', line,
                      core.both(when, {'not': core.eq(SM['M03'], 'C')}) if when else {'not': core.eq(SM['M03'], 'C')})
            return
        core.Act.speech(self, text, line, when)

    def flavor(self, line):
        code = re.search(r'[CF]\d\d', self.rows[line])[0]
        prompt = self.rows[line].split('｜', 1)[1].rstrip('】').replace('M01 後，', '裁示後，')
        stop = next(n for n in range(line + 1, len(self.rows)) if self.rows[n].startswith('【合流'))
        options = []
        for n in range(line + 1, stop):
            row = self.rows[n].strip()
            if row.startswith('（場景短暫'):
                continue
            if m := re.fullmatch(r'([ABC])\.(.+)', row):
                options.append((m[1], m[2].strip(), n, []))
            elif row:
                assert options, row
                options[-1][3].append(n)
        assert [o[0] for o in options] == list('ABC')
        section = self.section
        common = self.id(section, f'_{code}_COMMON')
        self.question(prompt, line, [self.option(key, label, self.id(section, f'_{code}_{key}')) for key, label, _, _ in options], flavor=True)
        image = self.held
        for key, label, source_line, responses in options:
            self.start(section, f'_{code}_{key}', image)
            self.emit(label, source_line, role='奧莉維亞')
            for n in responses:
                self.prose(n)
            self.finish(next=common)
        self.start(section, f'_{code}_COMMON', image)
        return stop + 1

    def major(self, line):
        code = re.search(r'[MNP]\d\d', self.rows[line])[0]
        prompt = self.rows[line].split('｜', 1)[1].rstrip('】')
        starts = [n for n in range(line + 1, len(self.rows)) if re.match(rf'###{{1,2}} {code}-[ABC]｜', self.rows[n])]
        stop = next(n for n in range(starts[-1] + 1, len(self.rows)) if self.rows[n].startswith(('【合流｜' + code, '【合流 ' + code)))
        if self.route == 'SACRED':
            labels = [re.search(r'\*\*(.+)\*\*', self.rows[n])[1] for n in range(line + 1, starts[0]) if re.match(r'> [123]\. ', self.rows[n])]
            effects = [[core.flag(SM[code], key)] for key in 'ABC']
            if code in ('M01', 'M02'):
                effects[2].append(core.flag(OVERREACH, True))
            else:
                effects[1].append(core.flag(BOUNDARY, True))
        else:
            labels = [re.fullmatch(r'- [AB]：「(.+)」', self.rows[n])[1] for n in range(line + 1, starts[0]) if re.match(r'- [AB]：', self.rows[n])]
            effects = [[core.flag(NOTICE, key == 'A')] if code == 'N01' else
                       [core.points(20 if key == 'A' else -15), dict(type='unrest', delta=10 if key == 'A' else -5, clamp=True),
                        core.flag(WP[code], WVALUES[code][i])] for i, key in enumerate('AB')]
        assert len(labels) == len(starts) == len(effects)
        section = self.section
        common = self.id(section, f'_{code}_COMMON')
        choices = [self.option(key, label, self.id(section, f'_{code}_{key}'), effect)
                   for key, label, effect in zip('ABC', labels, effects)]
        if self.route == 'SACRED':
            if code in ('M01', 'M02'):
                # Reserve affordability only; no points are charged here. An
                # overreach still has a -10 minimum eventual resolution cost.
                choices[2]['previewEffects'] = [dict(when=core.eq(SDONE, False), effects=[core.points(-10)])]
            else:
                for key, choice in zip('ABC', choices):
                    previews = []
                    for outcome in OUTCOMES:
                        rows = [r for r in RESOLVER if r['M03'] == key and r['result'] == outcome]
                        if rows and rows[0]['political_delta'] < 0:
                            previews.append(dict(when=core.both(core.eq(SDONE, False), result_condition(outcome, key)),
                                                 effects=[core.points(rows[0]['political_delta'])]))
                    if previews:
                        choice['previewEffects'] = previews
        self.question(prompt, line, choices)
        image = self.held
        for i, first in enumerate(starts):
            self.start(section, f'_{code}_{"ABC"[i]}', image)
            for n in range(first + 1, starts[i + 1] if i + 1 < len(starts) else stop):
                self.prose(n)
            self.finish(next=common)
        self.start(section, f'_{code}_COMMON', image)
        return stop + 1

    def block(self, first, last, when=None):
        for n in range(first, last + 1):
            self.prose(n, when)

    def world_conditionals(self, line):
        if line == 160:
            self.block(161, 162, core.eq(NOTICE, True)); self.block(164, 165, core.eq(NOTICE, False)); return 167
        if line == 416:
            self.start_recall()
            return 465
        if line == 703:
            self.block(704, 706, core.eq(NOTICE, True)); self.block(708, 711, core.eq(NOTICE, False)); return 713
        if line == 731:
            self.block(732, 733, core.eq(WP['P01'], WVALUES['P01'][0])); self.block(735, 736, core.eq(WP['P01'], WVALUES['P01'][1]))
            self.block(738, 739, core.eq(WP['P02'], WVALUES['P02'][0])); self.block(741, 742, core.eq(WP['P02'], WVALUES['P02'][1])); return 744
        return None

    def start_recall(self):
        common = self.id(4, '_NOTICE_COMMON')
        self.finish(next=self.id(4, '_NOTICE_FAILURE'), conditionalNext=dict(when=core.eq(NOTICE, True), next=self.id(4, '_NOTICE_SUCCESS')))
        for result, first, last, image in [('SUCCESS', 419, 438, '15A'), ('FAILURE', 442, 461, '15B')]:
            self.start(4, '_NOTICE_' + result, image)
            self.block(first, last)
            self.node['completionFlags'] = {SURVEY: result}
            self.finish(next=common)
        self.start(4, '_NOTICE_COMMON')

    def sacred_results(self):
        common = self.id(5, '_RESULT_COMMON')
        for i, outcome in enumerate(OUTCOMES):
            router = '_RESULT_CHECK_' + str(i)
            target = self.id(5, '_RESULT_' + outcome)
            if i == 0:
                self.finish(next=self.id(5, router))
            self.start(5, router, self.images['22'])
            if i < 3:
                self.finish(next=self.id(5, '_RESULT_CHECK_' + str(i + 1)), conditionalNext=dict(when=result_condition(outcome), next=target))
            else:
                self.finish(next=target)
            self.start(5, '_RESULT_' + outcome)
            first, last = [(643, 654), (659, 670), (675, 686), (691, 702)][i]
            self.block(first, last)
            delta = next(r['political_delta'] for r in RESOLVER if r['result'] == outcome)
            effects = [core.points(delta)] if delta else []
            success = outcome.endswith('SUCCESS')
            if success:
                effects.append(dict(type='clear', key='alinda', delta=1))
            effects.extend([core.flag(SDONE, True), core.flag(SGRANT, success), core.flag(SRESULT, outcome),
                            core.flag(declare('EP08_SACRED_VALKEN_DISSATISFACTION'), not success)])
            self.node['completionEffects'] = dict(when=core.eq(SDONE, False), effects=effects)
            self.node['scoring'] = 'STORY_EFFECTS'
            self.finish(next=common)
        self.start(5, '_RESULT_COMMON', self.images['12'])

    def compile(self):
        headings = [n for n, row in enumerate(self.rows) if re.match(r'^## SC\d\d｜', row)]
        for i, first in enumerate(headings, 1):
            self.start(i, image='14' if self.route == 'WORLD' and i == 4 else None)
            if self.route == 'WORLD' and i == 4:
                self.emit('儀式尚未開始，艾琳達已經抵達聖所。', first)
            last = headings[i] if i < 5 else next(n for n in range(first + 1, len(self.rows)) if self.rows[n].replace('**', '').startswith('【本幕結束'))
            line = first + 1
            while line < last:
                row = self.rows[line]
                if row.startswith('【無影響選項'):
                    line = self.flavor(line)
                elif re.match(r'^### (?:主要選擇|重要選擇|政治選擇) ', row):
                    line = self.major(line)
                elif self.route == 'SACRED' and line == 641:
                    self.sacred_results(); line = 705
                elif self.route == 'WORLD' and (next_line := self.world_conditionals(line)) is not None:
                    line = next_line
                else:
                    self.prose(line); line += 1
            if i == 4:
                names = ['LAVACAT_RESOLVED', 'AUREA_COVENANT_BEARER', 'ALINDA_FIELD_RESPONSE', 'CHURCH_GUIDANCE_ATTEMPT'] if self.route == 'SACRED' else ['AUREA_INHERITANCE_COMPLETE', 'LAVA_GUARDIAN_CALMED', 'EIRINDA_ATTENDS_RITUAL', 'ACADEMY_PROCEDURE_SUCCESS']
                self.node['completionFlags'] = {declare('EP08_' + self.route + '_' + key): True for key in names}
            if i < 5:
                self.finish(next=self.id(i + 1))
            else:
                self.finish(kind='end', completion=dict(title='第三幕完 · ' + TITLES[self.route], scope='ACT', nextChapterId='EP08',
                    pendingLabel='第四幕〈寒冰提前甦醒〉· 敬請期待', policy='NO_SCORING'))


def main():
    for route in TITLES:
        Act(route).compile()
    used = {s.get('cg') for s in SCENES} | {p.get('cg') for s in SCENES for p in s['segments']}
    assert not {a['id'] for a in ASSETS} - used, sorted({a['id'] for a in ASSETS} - used)
    path = ROOT / 'content/episodes/ep08/chapter.json'
    pack = core.read(path)
    prior = [s for s in pack['scenes'] if s['act'] != 'ACT03']
    for s in prior:
        if s['act'] == 'ACT02' and s.get('completion'):
            route = s['availableWhen']['value']; end = s['completion']; end.pop('pendingLabel', None)
            end.update(nextSceneId=f'EP08_ACT03_SC01_{route[0]}', nextChapterId='EP08', continueLabel='進入第三幕', nextLabel='第三幕〈' + TITLES[route] + '〉')
    pack.update(version='1.3.0', source='使用者提供第八章第一至三幕兩條獨立世界線逐字稿與原圖。', scenes=prior + SCENES)
    core.write(path, pack)
    path = ROOT / 'content/manifests/story.json'; manifest = core.read(path)
    manifest['version'] = '0.22.0-ep08-act03'; manifest['flags'].update(FLAGS); core.write(path, manifest)
    path = ROOT / 'content/manifests/assets.json'; core.write(path, [a for a in core.read(path) if not a['id'].startswith('EP08-ACT03-')] + ASSETS)
    path = ROOT / 'content/characters/index.json'; characters = core.read(path)
    for ident, name in core.ROLES.values(): characters.setdefault(ident, name)
    core.write(path, characters)
    print(len(SCENES), 'nodes', sum(len(s['segments']) for s in SCENES), 'segments', sum(len(s['choices']) for s in SCENES), 'answers', len(ASSETS), 'CGs')


if __name__ == '__main__':
    main()
