"""Source-pinned EP08 ACT04: independent winter crises and once-only relief settlements."""
import importlib.util
import itertools
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ep08_act03', ROOT / 'scripts/import-ep08-act03.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
base, core = previous.base, previous.core
SCENES, ASSETS, FLAGS = core.scenes, [], {}
TITLES = {'SACRED': '慈悲的價碼', 'WORLD': '未降臨的寒冰'}
# Approved in this conversation; no dedicated relief money is diverted to the crown.
SVALUES = {'BIG_SUCCESS': (20, 10), 'SUCCESS': (10, 5), 'SMALL_FAILURE': (-10, 5), 'BIG_FAILURE': (-20, 10)}
SCASES = core.read(ROOT / 'content/sources/ep08/act04/sacred/04_Production/All_81_Choice_Combinations.json')['cases']
assert len(SCASES) == 81 and len({x['choices'] for x in SCASES}) == 81
WMATRIX = core.read(ROOT / 'content/sources/ep08/act04/world/03_Production/Choices_Flags_and_Branch_Matrix.json')
for name, ident in {
    '亞丁': 'ADIN_GLEN', '亞丁・格倫': 'ADIN_GLEN', '奧莉薇雅': 'OLIVIA',
    '副官': 'THIRD_ORDER_ADJUTANT', '第三團副官': 'THIRD_ORDER_ADJUTANT',
    '騎士': 'THIRD_ORDER_KNIGHT', '修士': 'HOLYLIGHT_RELIEF_MONK', '老人': 'FROZEN_VILLAGE_ELDER',
    '老婦人': 'FROZEN_VILLAGE_WOMAN', '神職人員': 'HOLYLIGHT_RELIEF_CLERIC',
    '書記官': 'ROYAL_RELIEF_CLERK', '接待官': 'THIRD_ORDER_RECEPTION_OFFICER',
    '教授': 'ACADEMY_CONTRACT_PROFESSOR', '年長教授': 'ACADEMY_SENIOR_PROFESSOR',
    '一位教授': 'ACADEMY_CONTRACT_PROFESSOR', '第一位教授': 'ACADEMY_PROFESSOR_ONE',
    '第二位教授': 'ACADEMY_PROFESSOR_TWO', '年輕術士': 'ACADEMY_YOUNG_MAGE',
    '研究者': 'ACADEMY_RESEARCHER', '一位研究者': 'ACADEMY_RESEARCHER',
}.items():
    core.ROLES[name] = (ident, '亞丁' if ident == 'ADIN_GLEN' else ('奧莉維亞' if ident == 'OLIVIA' else name))
core.INLINE = re.compile(r'(' + '|'.join(sorted(core.ROLES, key=len, reverse=True)) + r')(（[^）]+）)?：「([^」]*)」')
# Line-number overrides from older source documents do not apply to this screenplay.
core.ATTRIBUTED = {}


def declare(key, initial=False):
    FLAGS[key] = dict(initial=initial, description='第八章第四幕：獨立世界線的決策、災害事實與一次性結算。')
    return key


SM = {code: declare('EP08_S4_' + code, 'UNSET') for code in ['M01', 'M02', 'M03', 'M04']}
WM = {code: declare('EP08_W4_' + code, 'UNSET') for code in ['N01', 'N02', 'P01', 'P02']}
NOTICE = declare('EP08_W4_NOTIFIED')
DONE = {r: declare('EP08_' + r + '_ACT04_SETTLED') for r in TITLES}
RESULT = {r: declare('EP08_' + r + '_ACT04_RESULT', 'UNSET') for r in TITLES}
EVENT = {r: declare('EP08_' + r + '_SHALIA_ACT04_EVENT', 'UNSET') for r in TITLES}
SGRANT = declare('EP08_SACRED_SHALIA_ACT04_CLEAR_GRANTED')


def any_of(items):
    return dict(any=list(items))


def sacred_condition(result, length=4, pick=None):
    rows = [x for x in SCASES if x['result'] == result and (pick is None or x['choices'][length - 1] == pick)]
    keys = list(SM)[:length if pick is None else length - 1]
    return any_of([core.both(*[core.eq(SM[k], row['choices'][i]) for i, k in enumerate(keys)]) for row in rows])


def world_condition(notice, good):
    pairs = [(a, b) for a, b in itertools.product('AB', repeat=2) if (a == 'A') + (b == 'A') == good]
    return core.both(core.eq(NOTICE, notice), any_of([core.both(core.eq(WM['P01'], a), core.eq(WM['P02'], b)) for a, b in pairs]))


class Act(base.Reader):
    def __init__(self, route):
        self.route = route
        self.number, self.act, self.chapter, self.folder = 4, 'ACT04', 'EP08', 'act04'
        folder = ROOT / f'content/sources/ep08/act04/{route.lower()}'
        audit = core.read(folder / 'asset-audit.json')
        self.source = f'sources/ep08/act04/{route.lower()}/{audit["script"]}'
        raw = (ROOT / 'content' / self.source).read_bytes()
        assert core.sha(raw) == audit['scriptSha256']
        self.rows = [''] + raw.decode('utf-8-sig').splitlines()
        self.titles = {int(m[1]): m[2] for row in self.rows if (m := re.fullmatch(r'#{1,2} SC(\d\d)｜(.+)', row))}
        assert len(self.titles) == 5
        self.context = ''
        self.images = {}
        for image in audit['images']:
            assert core.sha((ROOT / image['path']).read_bytes()) == image['sha256']
            self.images[image['key']] = image['id']
            ASSETS.append(dict(id=image['id'], type='cg', src=image['path'], label=f'第八章 第四幕 {route} CG{image["key"]}', status='APPROVED', source=audit['archive']))

    def start(self, section, suffix='', image=None):
        super().start(section, suffix, image)
        self.node.update(planNodeId='EP08_ACT04', version='1.0.0')
        keys = []
        if self.route == 'SACRED':
            keys = list(SM)[:1 if section == 2 else 2 if section >= 3 else 0]
            if suffix.startswith('_RESULT'):
                keys = list(SM)
            required = [SM[k] for k in keys]
        else:
            keys = list(WM)[:max(0, section - 1)]
            required = [WM[k] for k in keys]
        if required:
            self.node['availableWhen'] = core.both(self.node['availableWhen'], *[{'not': core.eq(key, 'UNSET')} for key in required])

    def prose(self, line, when=None, text=None):
        text = (self.rows[line] if text is None else text).strip().replace('**', '')
        if not text:
            return
        if cue := re.fullmatch(r'【CG\s*(?:W08A04-)?(\d\d[A-D]?)｜[^】]+】', text):
            self.cue(cue[1], line, when)
            return
        if text.startswith(('#', '>', '---', '【', '|', '時間：', '人物：', 'CG：', '時段', '場景：', '製作：', '幕後系統')):
            self.note(line, text)
            return
        if self.route == 'SACRED':
            text = {45: '王都東北塔窗上仍有晨光，奧莉維亞卻已收到兩批不同的求援文書。',
                    130: '風雪從第三團領地的山口向下推進，聖光會的前線營地也愈發忙碌。',
                    251: '下一波寒潮前，亞丁又收到新的現場需求。這一次，清冊變厚了。'}.get(line, text)
            if line == 745:
                success = any_of([core.eq(RESULT['SACRED'], 'BIG_SUCCESS'), core.eq(RESULT['SACRED'], 'SUCCESS')])
                self.emit('「寒冰之眼封印了，受災村莊的善後也有了安排。還缺什麼？」', line, success, role='奧莉維亞')
                self.emit('「寒冰之眼封印了，受災村莊的善後還得繼續處理。還缺什麼？」', line, {'not': success}, role='奧莉維亞')
                return
        text = text.replace('奧莉薇雅', '奧莉維亞')
        core.Act.speech(self, text, line, when)

    def block(self, first, last, when=None):
        line = first
        while line <= last:
            row = self.rows[line]
            if row.startswith('【無影響選項'):
                assert when is None, 'Branch flavor choices must use separate nodes'
                line = self.flavor(line)
            elif re.match(r'^### 有效選項 M\d\d', row):
                line = self.sacred_major(line)
            else:
                self.prose(line, when)
                line += 1

    def flavor(self, line):
        code = self.context + '_' + re.search(r'F\d\d', self.rows[line])[0]
        prompt = self.rows[line].split('｜', 1)[1].rstrip('】')
        stop = next(n for n in range(line + 1, len(self.rows)) if self.rows[n].startswith('【合流'))
        options = []
        for n in range(line + 1, stop):
            row = self.rows[n].strip()
            if m := re.fullmatch(r'([ABC])\.(.+)', row):
                options.append((m[1], m[2].strip(), n, []))
            elif row:
                assert options, (line, row)
                options[-1][3].append(n)
        assert [o[0] for o in options] == list('ABC')
        section, variants = self.section, self.node.get('cgWhen')
        common = self.id(section, code + '_COMMON')
        self.question(prompt, line, [self.option(key, label, self.id(section, code + '_' + key)) for key, label, _, _ in options], flavor=True)
        image = self.held
        for key, label, source_line, responses in options:
            self.start(section, code + '_' + key, image)
            if variants:
                self.node['cgWhen'] = variants
            self.emit(label, source_line, role='奧莉維亞')
            for n in responses:
                self.prose(n)
            self.finish(next=common)
        self.start(section, code + '_COMMON', image)
        if variants:
            self.node['cgWhen'] = variants
        return stop + 1

    def sacred_preview(self, code, pick):
        length = int(code[-2:])
        # Only reserve the minimum unavoidable final debit; no charge occurs yet.
        groups = {}
        for prefix in itertools.product('ABC', repeat=length - 1):
            start = ''.join(prefix) + pick
            best = max(SVALUES[x['result']][0] for x in SCASES if x['choices'].startswith(start))
            if best < 0:
                groups.setdefault(best, []).append(core.both(*[core.eq(SM[k], v) for k, v in zip(list(SM), prefix)]))
        return [dict(when=core.both(core.eq(DONE['SACRED'], False), any_of(conditions)), effects=[core.points(delta)]) for delta, conditions in groups.items()]

    def sacred_major(self, line):
        code = re.search(r'M\d\d', self.rows[line])[0]
        starts = [n for n in range(line + 1, len(self.rows)) if self.rows[n].startswith('**' + code + '-')][:3]
        stop = next(n for n in range(starts[-1] + 1, len(self.rows)) if self.rows[n].startswith(('【無影響選項', '【CG')))
        labels = [m[1] for n in range(line + 1, starts[0]) if (m := re.fullmatch(r'[ABC]\.(.+)', self.rows[n]))]
        assert len(labels) == len(starts) == 3
        section = self.section
        common = self.id(section, '_' + code + '_COMMON')
        choices = [self.option(key, label, self.id(section, '_' + code + '_' + key), [core.flag(SM[code], key)], preview=self.sacred_preview(code, key)) for key, label in zip('ABC', labels)]
        self.question(self.rows[line].split('｜', 1)[1], line, choices)
        image = self.held
        for i, first in enumerate(starts):
            self.start(section, '_' + code + '_' + 'ABC'[i], image)
            self.block(first + 1, (starts[i + 1] if i < 2 else stop) - 1)
            self.finish(next=common)
        self.start(section, '_' + code + '_COMMON', image)
        return stop

    def fork(self, code, condition, yes, no, image=None):
        """Compile real route branches, including their own dialogue choices, then merge."""
        section, context = self.section, self.context
        suffix = context + '_' + code
        common = self.id(section, suffix + '_COMMON')
        self.finish(next=self.id(section, suffix + '_N'), conditionalNext=dict(when=condition, next=self.id(section, suffix + '_Y')))
        prior = self.held
        ending_images = {}
        for branch, callback in [('Y', yes), ('N', no)]:
            self.context = suffix + '_' + branch
            self.start(section, self.context, prior)
            callback()
            self.finish(next=common)
            ending_images[branch] = self.held
        self.context = context
        self.start(section, suffix + '_COMMON', image or prior)
        if not image:
            self.node['cg'] = ending_images['N'] or prior
            if ending_images['Y']:
                self.node['cgWhen'] = [dict(when=condition, cg=ending_images['Y'])]

    def settle_sacred(self):
        common = self.id(5, '_RESULT_COMMON')
        outcomes = list(SVALUES)
        for i, outcome in enumerate(outcomes):
            if i == 0:
                self.finish(next=self.id(5, '_RESULT_CHECK_0'))
            self.start(5, '_RESULT_CHECK_' + str(i), '29')
            target = self.id(5, '_RESULT_' + outcome)
            if i < 3:
                self.finish(next=self.id(5, '_RESULT_CHECK_' + str(i + 1)), conditionalNext=dict(when=sacred_condition(outcome), next=target))
            else:
                self.finish(next=target)
            self.start(5, '_RESULT_' + outcome)
            self.block(*[(649, 673), (677, 691), (695, 703), (707, 719)][i])
            success = i < 2
            pp, unrest = SVALUES[outcome]
            effects = [core.points(pp), dict(type='unrest', delta=unrest, clamp=True)]
            if success:
                effects.append(dict(type='clear', key='shalia', delta=1))
            effects += [core.flag(DONE['SACRED'], True), core.flag(RESULT['SACRED'], outcome), core.flag(EVENT['SACRED'], 'COMPLETE' if success else 'FAILED'), core.flag(SGRANT, success)]
            self.node['completionEffects'] = dict(when=core.eq(DONE['SACRED'], False), effects=effects)
            self.node['scoring'] = 'STORY_EFFECTS'
            self.finish(next=common)
        self.start(5, '_RESULT_COMMON', '30')

    def finish_act(self):
        title = '第五幕〈再赴聖安奴加斯〉' if self.route == 'SACRED' else '第五幕〈東北塔的片刻〉'
        self.finish(kind='end', completion=dict(title='第四幕完 · ' + TITLES[self.route], scope='ACT', nextChapterId='EP08', pendingLabel=title + '· 敬請期待', policy='NO_SCORING'))

    def sacred(self):
        for section, first, last in [(1, 21, 132), (2, 140, 279), (3, 287, 379), (4, 387, 467)]:
            self.start(section)
            self.block(first, last)
            if section == 4:
                self.node['completionFlags'] = {declare('EP08_SACRED_ACT04_' + key): True for key in ['ICE_EYE_MANIFESTED', 'ALYSSIA_FAIRY_RESEAL', 'VILLAGES_SEVERELY_DAMAGED', 'CHURCH_RELIEF_ACTIVE', 'CHURCH_SUMMONING_INTERRUPTION_FAILED']}
            self.finish(next=self.id(section + 1))
        self.start(5)
        self.block(475, 644)
        self.settle_sacred()
        self.block(723, 810)
        self.finish_act()

    def notice_choice(self, code, line, ranges):
        section = self.section
        definition = next(x for x in WMATRIX['choice_definitions'] if x['id'] == code)
        common = self.id(section, '_' + code + '_COMMON')
        choices = []
        for option in definition['options']:
            key = option['id']
            effects = [core.flag(WM[code], key)]
            if code == 'N01':
                effects.append(core.flag(NOTICE, key == 'A'))
            elif key == 'A':
                effects.append(core.flag(NOTICE, True))
            preview = [dict(when=core.both(core.eq(DONE['WORLD'], False), core.eq(WM['N01'], 'B')), effects=[core.points(-20)])] if code == 'N02' and key == 'B' else None
            choices.append(self.option(key, '「' + option['text'] + '」', self.id(section, '_' + code + '_' + key), effects, preview=preview))
        self.question(self.rows[line].split('｜', 1)[1], line, choices)
        image = self.held
        for key, (first, last) in zip('AB', ranges):
            self.start(section, '_' + code + '_' + key, image)
            if code == 'N02' and key == 'A':
                self.block(first, 170)
                self.emit('「信我收到了。人又親自來，這份周到我可記下了。」', 171, core.eq(WM['N01'], 'A'), role='莎莉雅')
                self.emit('「沒有信也不要緊。人到了、事情說清楚，就能好好安排。」', 173, core.eq(WM['N01'], 'B'), role='莎莉雅')
                self.block(175, last)
            elif code == 'N02':
                self.block(first, 188)
                self.block(190, 192, core.eq(WM['N01'], 'A'))
                self.block(194, 196, core.eq(WM['N01'], 'B'))
                self.block(197, last)
            else:
                self.block(first, last)
            self.finish(next=common)
        self.start(section, '_' + code + '_COMMON', image)

        if code == 'N02':
            self.node['cg'] = self.images['06B']
            self.node['cgWhen'] = [dict(when=core.eq(WM['N02'], 'A'), cg=self.images['06A'])]

    def world_political(self, code, line, ranges, image):
        definition = next(x for x in WMATRIX['choice_definitions'] if x['id'] == code)
        section = self.section
        common = self.id(section, '_' + code + '_COMMON')
        self.finish(next=self.id(section, '_' + code + '_N_CHOICE'), conditionalNext=dict(when=core.eq(NOTICE, True), next=self.id(section, '_' + code + '_Y_CHOICE')))
        for notified, name in [(True, 'Y'), (False, 'N')]:
            self.start(section, '_' + code + '_' + name + '_CHOICE', image)
            choices = []
            for option in definition['options_by_notice']['notified' if notified else 'not_notified']:
                key = option['id']
                previews = []
                if not notified:
                    if code == 'P01':
                        previews = [dict(when=core.eq(DONE['WORLD'], False), effects=[core.points(-20 if key == 'A' else -35)])]
                    else:
                        for prior in 'AB':
                            cost = -50 + 15 * ((prior == 'A') + (key == 'A'))
                            previews.append(dict(when=core.both(core.eq(DONE['WORLD'], False), core.eq(WM['P01'], prior)), effects=[core.points(cost)]))
                choices.append(self.option(key, '「' + option['text'] + '」', self.id(section, '_' + code + '_' + name + '_' + key), [core.flag(WM[code], key)], preview=previews))
            self.question(self.rows[line].split('｜', 1)[1], line, choices)
            for key in 'AB':
                self.start(section, '_' + code + '_' + name + '_' + key, image)
                self.block(*ranges[(notified, key)])
                self.finish(next=common)
        self.start(section, '_' + code + '_COMMON', image)
        # Maintain the selected variant until the next authored image cue.
        self.node['cgWhen'] = [dict(when=core.both(core.eq(NOTICE, n), core.eq(WM[code], k)), cg=self.images[('12' if code == 'P01' else '16') + letter]) for (n, k), letter in zip([(True, 'A'), (True, 'B'), (False, 'A'), (False, 'B')], 'ABCD')]

    def world_event_yes(self):
        self.block(650, 659)
        self.block(661, 661, core.both(core.eq(WM['N01'], 'A'), core.eq(WM['N02'], 'A')))
        self.block(664, 664, core.both(core.eq(WM['N01'], 'A'), core.eq(WM['N02'], 'B')))
        self.block(667, 667, core.both(core.eq(WM['N01'], 'B'), core.eq(WM['N02'], 'A')))
        self.block(669, 672)

    def settle_world(self):
        common = self.id(5, '_SETTLEMENT_COMMON')
        tiers = [(True, 2, 'BIG_SUCCESS', 20, -30, 700), (True, 1, 'SUCCESS', 10, -20, 703), (True, 0, 'SUCCESS_MINIMUM', 0, -10, 706), (False, 2, 'SMALL_FAILURE_REMEDIED', -20, 20, 709), (False, 1, 'SMALL_FAILURE', -35, 35, 712), (False, 0, 'BIG_FAILURE', -50, 50, 715)]
        for i, (notice, good, result, pp, unrest, line) in enumerate(tiers):
            if i == 0:
                self.finish(next=self.id(5, '_SETTLEMENT_CHECK_0'))
            self.start(5, '_SETTLEMENT_CHECK_' + str(i), '22B')
            self.node['cgWhen'] = [dict(when=core.eq(NOTICE, True), cg=self.images['22A'])]
            target = self.id(5, '_SETTLEMENT_' + result)
            if i < 5:
                self.finish(next=self.id(5, '_SETTLEMENT_CHECK_' + str(i + 1)), conditionalNext=dict(when=world_condition(notice, good), next=target))
            else:
                self.finish(next=target)
            self.start(5, '_SETTLEMENT_' + result, '22A' if notice else '22B')
            self.prose(line)
            self.node['completionEffects'] = dict(when=core.eq(DONE['WORLD'], False), effects=[core.points(pp), dict(type='unrest', delta=unrest, clamp=True), core.flag(DONE['WORLD'], True), core.flag(RESULT['WORLD'], result), core.flag(EVENT['WORLD'], 'COMPLETE' if notice else 'FAILED')])
            self.node['scoring'] = 'STORY_EFFECTS'
            self.finish(next=common)
        self.start(5, '_SETTLEMENT_COMMON', '22B')
        self.node['cgWhen'] = [dict(when=core.eq(NOTICE, True), cg=self.images['22A'])]

    def world(self):
        self.start(1)
        self.block(17, 77)
        self.notice_choice('N01', 78, [(83, 93), (95, 105)])
        self.block(108, 127)
        self.finish(next=self.id(2))
        self.start(2)
        self.block(133, 138)
        self.block(141, 148, core.eq(WM['N01'], 'A'))
        self.block(151, 156, core.eq(WM['N01'], 'B'))
        self.notice_choice('N02', 159, [(165, 182), (185, 200)])
        def welcomed():
            self.block(205, 208)
            self.emit('莎莉雅的副官在舊哨站迎接車隊。不久，她也親自趕來與眾人碰面。', 209, core.eq(WM['N02'], 'B'))
            self.emit('堡邸裡，熱湯與地圖已經備妥，莎莉雅帶著眾人逐項確認安排。', 209, core.eq(WM['N02'], 'A'))
            self.block(211, 232)
        self.fork('RECEPTION', core.eq(NOTICE, True), welcomed, lambda: self.block(236, 275))
        self.block(277, 296)
        self.finish(next=self.id(3))
        self.start(3)
        self.block(302, 356)
        self.world_political('P01', 357, {(True, 'A'): (369, 380), (True, 'B'): (383, 392), (False, 'A'): (395, 404), (False, 'B'): (407, 416)}, '11')
        self.block(419, 438)
        self.finish(next=self.id(4))
        self.start(4)
        self.block(444, 451)
        self.prose(452, core.eq(NOTICE, True), '第三團依照雙方商定的方案，確認各條通路。')
        self.prose(454, core.eq(NOTICE, False), '額外開路仍需要新一輪費用與行政交換。')
        self.block(456, 474)
        self.world_political('P02', 475, {(True, 'A'): (487, 496), (True, 'B'): (499, 506), (False, 'A'): (509, 518), (False, 'B'): (521, 532)}, '15')
        self.block(535, 599)
        self.block(601, 601, core.eq(NOTICE, True))
        self.block(604, 604, core.eq(NOTICE, False))
        self.block(606, 617)
        self.node['completionFlags'] = {declare('EP08_WORLD_ACT04_' + key): value for key, value in {'ICE_EYE_MANIFESTED': False, 'SUMMONING_INTERRUPTED': True, 'ELIA_RESEARCH_USED': True, 'ACADEMY_TEAM_EXECUTED': True, 'ACADEMY_CREDIBILITY_PARTIAL': True}.items()}
        self.finish(next=self.id(5))
        self.start(5)
        self.block(623, 645)
        self.fork('EVENT', core.eq(NOTICE, True), self.world_event_yes, lambda: self.block(677, 696))
        self.settle_world()
        self.block(728, 779)
        self.finish_act()


def main():
    had_act05=any(s['act']=='ACT05' for s in core.read(ROOT/'content/episodes/ep08/chapter.json')['scenes'])
    for route in TITLES:
        act = Act(route)
        act.sacred() if route == 'SACRED' else act.world()
    used = {s.get('cg') for s in SCENES} | {p.get('cg') for s in SCENES for p in s['segments']} | {p['cg'] for s in SCENES for p in s.get('cgWhen', [])}
    assert not {a['id'] for a in ASSETS} - used
    assert len({s['id'] for s in SCENES}) == len(SCENES)
    path = ROOT / 'content/episodes/ep08/chapter.json'
    pack = core.read(path)
    prior = [s for s in pack['scenes'] if s['act'] != 'ACT04']
    for s in prior:
        if s['act'] == 'ACT03' and s.get('completion'):
            route = 'SACRED' if '_S_' in s['id'] else 'WORLD'
            end = s['completion']; end.pop('pendingLabel', None)
            end.update(nextSceneId=f'EP08_ACT04_SC01_{route[0]}', nextChapterId='EP08', continueLabel='進入第四幕', nextLabel='第四幕〈' + TITLES[route] + '〉')
    pack.update(version='1.4.0', source='使用者提供第八章第一至四幕兩條獨立世界線逐字稿與原圖。', scenes=prior + SCENES)
    core.write(path, pack)
    path = ROOT / 'content/manifests/story.json'; manifest = core.read(path)
    manifest['version'] = '0.23.0-ep08-act04'; manifest['flags'].update(FLAGS); core.write(path, manifest)
    path = ROOT / 'content/manifests/assets.json'; core.write(path, [a for a in core.read(path) if not a['id'].startswith('EP08-ACT04-')] + ASSETS)
    path = ROOT / 'content/characters/index.json'; characters = core.read(path)
    for ident, name in core.ROLES.values(): characters.setdefault(ident, name)
    core.write(path, characters)
    print(len(SCENES), 'nodes', sum(len(s['segments']) for s in SCENES), 'segments', sum(len(s['choices']) for s in SCENES), 'answers', len(ASSETS), 'CGs')
    if had_act05:
        import subprocess
        import sys
        subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/import-ep08-act05.py')],check=True)


if __name__ == '__main__':
    main()
