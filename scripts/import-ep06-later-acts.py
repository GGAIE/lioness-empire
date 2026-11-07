"""Compile the reviewed EP06 act 3–5 scripts and their verified local CGs."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'content/sources/ep06'
VERSION = '0.15.0-ep06-complete'
TRANSFER = 'ROUENNE_TRANSFER_APPROVED'
SEAL = 'FINLEY_SECRETARY_SEAL'
METHOD = 'F2_METHOD'
S2 = 'S2_REFUGEE_OUTCOME'
T2 = 'T2_GATE_FIRST_HALF'
TITLES = {3: '盤根錯節', 4: '代價與承諾', 5: '聖安奴加斯的聖女選拔'}
ORDINALS = {3: '三', 4: '四', 5: '五'}
ROLES = {
    '奧莉薇雅': ('OLIVIA', '奧莉維亞'), '奧莉維亞': ('OLIVIA', '奧莉維亞'),
    '芬利': ('FINLEY', '芬利'), '艾拉': ('ELLA', '艾拉'), '艾麗斯': ('ALICE_SHAMAN', '艾麗斯'),
    '莎莉雅': ('SHALIA', '莎莉亞'), '塔馬拉': ('TAMARA', '塔馬拉'), '米耶爾': ('MIEL', '米耶爾'),
    '司書': ('ROYAL_ARCHIVE_LIBRARIAN', '司書'), '侍從': ('COURT_ATTENDANT', '侍從'),
    '承辦官': ('COURT_OFFICER', '承辦官'), '主持神官': ('SAINT_SELECTION_OFFICIANT', '主持神官'),
    '薩拉菲尼亞': ('SERAPHINIA', '薩拉菲尼亞'), '蘇菲': ('SOPHIE', '蘇菲'),
}
INLINE = re.compile(r'(' + '|'.join(ROLES) + r')(（[^）]+）)?：「([^」]*)」')
SCRIPT_HASHES = {
    3: '315897ae58c3c1d36124358e5cc4e66ad51efeba4c44beb01a9ba1bd619b466a',
    4: '845e60d662f1dd97c8ef92f05c3c9056ea6a3e25b6dcb376eca275b5d309b83e',
    5: 'c72b54d3b8508259a027cb263e548db16d5e0bd9c974360b254f97daa0f07816',
}
CG = re.compile(r'^【CG-(\d{2})｜([^】]+)】$')
HEADING = re.compile(r'^#{1,2} SC(\d\d)(?:-[ABC])?〈([^〉]+)〉')
FLAVOR = re.compile(r'^【(FLAVOR-[\w-]+)｜([^】]+)】$')
MARKUP = re.compile(r'^(?:#|【|---$|\[|→|[-*] |時間|地點|登場人物|功能|任務|CG\s|場景|玩家資訊|共同目的|條件|Scene Result|[ABC] Result|SC\d|結果|立刻寫入|動態差分|分支專屬|ACT\d|轉場|現場變化|所有變體)')
# Explicit attributions for embedded quotations without a literal speaker label.
ATTRIBUTED = {
    (3, 316): '艾麗斯', (3, 409): '艾麗斯',
    (4, 263): '塔馬拉', (4, 270): '塔馬拉', (4, 284): '塔馬拉',
    (4, 291): '塔馬拉', (4, 325): '塔馬拉', (4, 327): '塔馬拉',
    (4, 329): '奧莉薇雅', (4, 409): '芬利',
}
assets = []
scenes = []
trace = []


def read(path):
    return json.loads(path.read_text('utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', 'utf-8')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def eq(key, value):
    return dict(path=f'flags.{key}', op='eq', value=value)


def both(*conditions):
    return dict(all=list(conditions))


def negate(condition):
    return {'not': condition}


def flag(key, value):
    return dict(type='flag', key=key, value=value)


def points(delta):
    return dict(type='points', delta=delta)


def clear(key):
    return dict(type='clear', key=key, delta=1)


def normalize(text):
    return (text.replace('奧莉薇雅', '奧莉維亞').replace('莎莉雅', '莎莉亞')
            .replace('卡巴剛得', '卡巴岡德').replace('EP05 的路恩貴族接收紀錄', '先前的路恩貴族接收紀錄')
            .replace('SC02 找出的重複代碼', '先前在檔案庫找出的重複代碼'))


class Act:
    def __init__(self, number):
        self.number = number
        self.act = f'ACT{number:02}'
        self.source = f'sources/ep06/act{number:02}/01_Full_VN_Script.md'
        script = ROOT / 'content' / self.source
        raw = script.read_bytes()
        if sha(raw) != SCRIPT_HASHES[number]:
            raise ValueError(f'Review exact story ranges before importing {self.act}')
        self.rows = [''] + raw.decode('utf-8-sig').splitlines()
        self.titles = {int(m[1]): m[2] for line in self.rows if (m := HEADING.match(line))}
        audit = read(script.parent / 'asset-audit.json')
        titles = {int(m[1]): m[2] for line in self.rows if (m := CG.fullmatch(line.strip()))}
        self.images = {}
        for i, image in enumerate(audit['images'], 1):
            if sha((ROOT / image['path']).read_bytes()) != image['sha256']:
                raise ValueError(f"Incorrect PNG: {image['path']}")
            self.images[i] = image['id']
            assets.append(dict(id=image['id'], type='cg', src=image['path'],
                               label=titles[i], status='APPROVED', source=audit['archive']))

    def id(self, section, suffix=''):
        return f'EP06_{self.act}_SC{section:02}{suffix}'

    def start(self, section, suffix='', image=None, available=None, title=None):
        self.section = section
        self.available = available
        self.pending = None
        self.node = dict(
            id=self.id(section, suffix), chapter='EP06', act=self.act, sceneNumber=section,
            title=title or self.titles[section], pov='OLIVIA', cast=['OLIVIA'], kind='narrative',
            status='DRAFT', playback='READER', scoring='NONE', source=self.source, version='1.0.0',
            planNodeId=f'EP06_{self.act}', knowledge=dict(knows=['依本幕對話及已選前情。'], withheld=[]),
            segments=[], choices=[], directions=[], presentation=dict(fit='contain', focusX=50,
                                                                       focusY=50, zoom=1, panX=0, fadeMs=700))
        if image:
            self.node['cg'] = self.images[image] if isinstance(image, int) else image
        if available:
            self.node['availableWhen'] = available
            self.node['directoryVisibleWhenLocked'] = True

    def note(self, line, text):
        self.node['directions'].append(dict(beforeSegment=len(self.node['segments']), cue='原稿註記', text=text))

    def emit(self, text, line, when=None, role=None, suffix=None, kind='narration', visual='SCENE'):
        if self.pending and self.pending[1] != when:
            self.hold()
        segment = dict(id=f"L{len(self.node['segments'])+1:03}", text=normalize(text), kind=kind, visual=visual)
        if role:
            character, name = ROLES[role]
            segment.update(speaker=character, speakerLabel=name + (suffix or ''),
                           kind='thought' if suffix and '心聲' in suffix else 'dialogue')
            if character not in self.node['cast']:
                self.node['cast'].append(character)
        if when:
            segment['when'] = when
        if self.pending:
            segment['cg'] = self.pending[0]
            self.pending = None
        self.node['segments'].append(segment)
        trace.append(dict(scene=self.node['id'], segment=segment['id'], line=line))

    def hold(self):
        if self.pending:
            self.emit(' ', self.pending[2], self.pending[1], kind='caption')

    def cue(self, image, line, when=None):
        self.hold()
        self.pending = (self.images[image], when, line)

    def speech(self, text, line, when=None):
        """Split authored inline dialogue, preserving actions as narration."""
        matches = list(INLINE.finditer(text))
        if matches:
            end = 0
            for m in matches:
                prefix = text[end:m.start()].strip()
                if prefix:
                    self.emit(prefix, line, when)
                self.emit(f'「{m[3]}」', line, when, m[1], m[2])
                end = m.end()
            if text[end:].strip():
                self.emit(text[end:].strip(), line, when)
        elif (m := re.search(r'：「([^」]*)」', text)) and (
            role := ATTRIBUTED.get((self.number, line)) or next(
                (role for role in ROLES if text.startswith(role)), None
            )
        ):
            intro = text[:m.start()]
            self.emit(intro + '。', line, when)
            self.emit(f'「{m[1]}」', line, when, role)
            if text[m.end():].strip():
                self.emit(text[m.end():].strip(), line, when)
        else:
            self.emit(text, line, when)

    def prose(self, line, when=None, text=None):
        text = (self.rows[line] if text is None else text).strip().replace('**', '')
        if not text:
            return
        if match := CG.fullmatch(text):
            self.cue(int(match[1]), line, when)
        elif text.startswith('CUT TO BLACK'):
            self.hold()
            self.note(line, text)
            self.emit(' ', line, when, kind='caption', visual='BLACK')
        elif self.number == 5 and line == 332:
            self.emit(text, line, when, '主持神官')
        elif MARKUP.match(text):
            self.note(line, text)
        else:
            self.speech(text, line, when)

    def block(self, start, end, when=None):
        line = start
        while line <= end:
            text = self.rows[line].strip()
            if match := FLAVOR.fullmatch(text):
                stop = next(i for i in range(line+1, end+1) if '合流' in self.rows[i])
                self.flavor(line, stop, match)
                line = stop
            else:
                self.prose(line, when)
            line += 1

    def flavor(self, line, stop, match):
        options = []
        for number in range(line+1, stop):
            row = self.rows[number].strip()
            if head := re.fullmatch(r'- [①②]「(.+?)」(?:→|\s*→\s*)?\s*(.*)', row):
                options.append((number, f'「{head[1]}」', [head[2]] if head[2] else []))
            elif row:
                assert options and row.startswith('- '), row
                options[-1][2].append(row[2:])
        assert len(options) == 2, (self.act, line, options)
        section, available, title = self.section, self.available, self.node['title']
        stem = '_' + match[1].replace('-', '_')
        after = self.id(section, stem+'_COMMON')
        self.question(match[2], line, [
            self.option(letter, text, self.id(section, stem+'_'+letter))
            for letter, (_, text, _) in zip('AB', options)
        ], flavor=True)
        image = self.held
        for letter, (source_line, option, response) in zip('AB', options):
            self.start(section, stem+'_'+letter, image, available, title)
            self.emit(option, source_line, role='奧莉維亞')
            for text in response:
                self.speech(text, source_line)
            self.finish(next=after)
        self.start(section, stem+'_COMMON', image, available, title)

    def option(self, letter, text, target, effects=(), when=None, preview=None):
        result = dict(id=letter, text=normalize(text.strip()), next=target, effects=list(effects))
        if when:
            result['when'] = when
        if preview:
            result['previewEffects'] = preview
        return result

    def question(self, prompt, line, options, flavor=False):
        self.emit(prompt, line, kind='caption')
        self.finish(kind='choice', scoring='NONE' if flavor else 'STORY_EFFECTS',
                    choiceMode='DIALOGUE_FLAVOR' if flavor else 'STORY', choices=options)

    def finish(self, **fields):
        self.hold()
        if not self.node['segments']:
            self.emit(' ', 0, kind='caption')
        self.node.update(fields)
        self.held = next((p['cg'] for p in reversed(self.node['segments']) if 'cg' in p and 'when' not in p),
                         self.node.get('cg'))
        scenes.append(self.node)

    def ending(self):
        scope = 'CHAPTER' if self.number == 5 else 'ACT'
        title = f"第{ORDINALS[self.number]}幕完 · {TITLES[self.number]}" if scope == 'ACT' else f"第六章完 · {TITLES[self.number]}"
        completion = dict(title=title, scope=scope, nextChapterId='EP07' if scope == 'CHAPTER' else 'EP06',
                          policy='NO_SCORING')
        if scope == 'ACT':
            next_act = self.number + 1
            label = f'第{ORDINALS[next_act]}幕'
            completion.update(nextSceneId=f'EP06_ACT{next_act:02}_SC01',
                              continueLabel='進入'+label, nextLabel=f'{label}〈{TITLES[next_act]}〉')
        else:
            completion['pendingLabel'] = '幕間〈不能兼顧的王國〉· 敬請期待'
        self.finish(kind='end', completion=completion)


def act_three():
    a = Act(3)
    for section, first, last in [(1, 25, 77), (2, 89, 143)]:
        a.start(section)
        a.block(first, last)
        a.finish(next=a.id(section+1))
    a.start(3)
    a.block(155, 174)
    choice = []
    for key, line in zip('ABC', [178, 180, 182]):
        text = a.rows[line].split('｜', 1)[1].split('** →', 1)[0]
        effects = [flag(METHOD, key)]
        if key == 'A':
            effects.append(flag(SEAL, True))
        preview = [dict(when=eq('F2_RESOLVED', False), effects=[points(-20)])] if key == 'C' else None
        choice.append(a.option(key, text, a.id(3, '_'+key), effects, preview=preview))
    a.question('採用哪種方式調查奧特丹舊案？', 176, choice)
    for key, first, last in [('A',186,222), ('B',228,244), ('C',250,256)]:
        a.start(3, '_'+key, 11)
        a.block(first,last)
        a.prose(260)
        a.finish(next=a.id(4, '_'+key), kind='result')
    for key, first, last, title in [
        ('A',270,345,'兩個人的不同工作'), ('B',357,446,'老朋友與不小心說出的答案'),
        ('C',458,549,'度假的人沒有義務開門'),
    ]:
        a.start(4, '_'+key, available=eq(METHOD,key), title=title)
        a.block(first,last)
        a.finish(next=a.id(5))
    available = negate(eq(METHOD,'UNSET'))
    a.start(5, available=available)
    a.block(561,565)
    for line,key in zip(range(568,571),'ABC'):
        a.speech(a.rows[line].split('** ',1)[1], line, eq(METHOD,key))
    a.block(572,588)
    for line,key in zip(range(591,594),'ABC'):
        a.speech(a.rows[line].split('** ',1)[1], line, eq(METHOD,key))
    a.block(595,605)
    a.node['scoring'] = 'STORY_EFFECTS'
    a.node['settlements'] = [
        dict(when=both(eq(METHOD,key),eq('F2_RESOLVED',False)), effects=[
            flag('F2_RESOLVED',True), flag('F2_CLEAR',key!='C'),
            flag('F2_INVESTIGATION_PENDING',False),
            *[flag(k, True) for k in ('OTTODAN_COLD_CASE_SOLVED','ACADEMY_EMBEZZLEMENT_EXPOSED',
                                      'AYLA_POLITICAL_FAVOR','ACADEMY_CROWN_COOPERATION_OPEN')],
            *([clear('finley')] if key != 'C' else []),
            *([points(delta)] if delta else []),
        ]) for key,delta in zip('ABC',[5,0,-20])
    ]
    a.ending()


def act_four():
    a = Act(4)
    t, f = eq(TRANSFER,True), eq(TRANSFER,False)
    a.start(1)
    a.block(26,55)
    a.block(58,60,t)
    a.block(63,65,f)
    a.block(67,84)
    a.finish(next=a.id(2))
    a.start(2)
    a.block(96,109)
    a.finish(next=a.id(2,'_F'), conditionalNext=dict(when=t,next=a.id(2,'_T')))
    for code, start, end, lines, outcomes, values in [
        ('T',115,140,[143,146],[(150,157),(160,167)],[(5,None),(-2,5)]),
        ('F',175,194,[197,200],[(206,212),(215,219)],[(-5,None),(-10,15)]),
    ]:
        a.start(2,'_'+code,5)
        a.block(start,end)
        opts=[]
        for i,key in enumerate('AB'):
            delta, unrest = values[i]
            effects = [flag(S2, 'SUCCESS' if i==0 else 'FAILURE'), flag('S2_CLEAR', i==0), points(delta)]
            if unrest is not None:
                effects.append(dict(type='unrest', delta=unrest, clamp=True))
            opts.append(a.option(key,a.rows[lines[i]].split('｜',1)[1].replace('**',''),
                                 a.id(2,'_'+code+'_'+key),effects))
        a.question('如何與第三團安排這一波難民的安置？', lines[0]-1, opts)
        for i,key in enumerate('AB'):
            a.start(2,'_'+code+'_'+key,11 if code=='F' else None)
            a.block(*outcomes[i])
            closing = ('莎莉亞把可轉送的名冊和仍待處理的需求送往王都，供塔馬拉查閱。'
                       if code=='T' else '莎莉亞將目前能提供的援助清單送交塔馬拉。')
            a.emit(closing,169 if code=='T' else 221)
            a.finish(next=a.id(3),kind='result')
    gate_variants = [
        ('TS',True,'SUCCESS',262,265,307),('TF',True,'FAILURE',269,272,310),
        ('FS',False,'SUCCESS',276,279,313),('FF',False,'FAILURE',283,286,316),
    ]
    resolved = {'any': [both(eq(TRANSFER,transfer),eq(S2,outcome))
                        for _,transfer,outcome,_,_,_ in gate_variants]}
    a.start(3,available=resolved)
    a.block(232,257)
    variants = []
    for code, transfer, outcome, start, end, option in gate_variants:
        when = both(eq(TRANSFER,transfer), eq(S2,outcome))
        a.block(start,end,when)
        variants.append((code,when,option))
    a.block(289,300)
    opts = []
    for code,when,line in variants:
        for i,key in enumerate('AB'):
            text = a.rows[line+i].split('**',2)[2]
            opts.append(a.option(code+'_'+key,text,a.id(3,'_T2_'+key),
                                 [flag(T2,'SUCCESS' if i==0 else 'FAILURE'),
                                  flag('CAPITAL_GATE_TRIAGE_READY',i==0)],when))
    a.question('如何下達城門的處置命令？',302,opts)
    for key,line in [('A',325),('B',327)]:
        a.start(3,'_T2_'+key,19,resolved)
        a.prose(line,text=a.rows[line].split('** ',1)[1])
        a.block(329,330)
        a.finish(next=a.id(4),kind='result')
    a.start(4)
    a.block(341,354)
    a.finish(next=a.id(4,'_NO_SEAL'), conditionalNext=dict(when=eq(SEAL,True),next=a.id(4,'_SEAL')))
    a.start(4,'_SEAL')
    a.block(360,380)
    a.finish(next=a.id(4,'_SEALED_REPLY'), completionFlags={
        'F3_CLEAR':True,'F3_RESOLUTION':'PERMANENT_SEAL_AUTO_PASS'})
    a.start(4,'_SEALED_REPLY',21)
    a.block(416,427)
    a.finish(next=a.id(4,'_FILES'))
    a.start(4,'_NO_SEAL')
    a.block(386,399)
    opts = []
    for i,key in enumerate('AB'):
        line = 402+i*2
        text = a.rows[line].split('｜',1)[1].replace('**','')
        opts.append(a.option(key,text,a.id(4,'_AGREEMENT_'+key),
                             [flag('F3_CLEAR',i==0),
                              flag('F3_RESOLUTION','LIMITED_OVERSIGHT_AGREEMENT' if i==0 else 'AD_HOC_ONLY')]))
    a.question('如何建立王室與學院之間的資料合作？',401,opts)
    for key,line in [('A',409),('B',411)]:
        a.start(4,'_AGREEMENT_'+key,23)
        a.prose(line,text=a.rows[line].split('** ',1)[1])
        a.block(421,422)
        a.finish(next=a.id(4,'_FILES'),kind='result')
    a.start(4,'_FILES')
    a.prose(429)
    a.finish(next=a.id(5))
    a.start(5)
    a.block(440,532)
    a.ending()


def act_five():
    a = Act(5)
    for section, first, last in [(1,33,149),(2,163,259),(3,273,365)]:
        a.start(section)
        a.block(first,last)
        a.finish(next=a.id(section+1))
    a.start(4)
    a.block(379,456)
    a.block(460,460)
    # The supplied art manifest identifies 21 and 22 as mutually exclusive.
    for image,start,end,approved in [(21,463,471,True),(22,474,484,False)]:
        when=eq(TRANSFER,approved)
        a.cue(image,458 if approved else 486,when)
        a.block(start,end,when)
    a.block(488,517)
    a.finish(next=a.id(5))
    a.start(5)
    a.block(531,699)
    a.prose(701,text='燈火漸暗，兩份提案並排留在桌上。')
    a.prose(703)
    a.ending()


def main():
    act_three()
    act_four()
    act_five()
    used = {p['cg'] for s in scenes for p in s['segments'] if 'cg' in p}
    used.update(s['cg'] for s in scenes if 'cg' in s)
    missing = {a['id'] for a in assets} - used
    if missing:
        raise ValueError(f'Unmapped CGs: {sorted(missing)}')
    pack_path = ROOT / 'content/episodes/ep06/chapter.json'
    pack = read(pack_path)
    prior = [s for s in pack['scenes'] if s['act'] in ('ACT01','ACT02')]
    handoff = next(s['completion'] for s in prior if s['act']=='ACT02' and 'completion' in s)
    handoff.pop('pendingLabel',None)
    handoff.update(nextSceneId='EP06_ACT03_SC01', continueLabel='進入第三幕', nextLabel='第三幕〈盤根錯節〉')
    interludes = [s for s in pack['scenes'] if s.get('interlude')]
    if interludes:
        end = next(s['completion'] for s in scenes if s.get('completion',{}).get('scope')=='CHAPTER')
        end.pop('pendingLabel',None)
        end.update(nextSceneId='EP06_ACT06_SC01',nextChapterId='EP06',continueLabel='進入幕間',nextLabel='幕間〈不能兼顧的王國〉')
    pack.update(version='1.3.0',source='使用者提供第六章五幕的逐字劇本及 CG。',scenes=prior+scenes+interludes)
    manifest_path = ROOT / 'content/manifests/story.json'
    manifest = read(manifest_path)
    if not interludes:
        manifest['version'] = VERSION
    defaults = {METHOD:'UNSET',SEAL:False,'F2_RESOLVED':False,'F2_CLEAR':False,
                'OTTODAN_COLD_CASE_SOLVED':False,'ACADEMY_EMBEZZLEMENT_EXPOSED':False,
                'AYLA_POLITICAL_FAVOR':False,'ACADEMY_CROWN_COOPERATION_OPEN':False,
                S2:'PENDING','S2_CLEAR':False,T2:'PENDING','CAPITAL_GATE_TRIAGE_READY':False,
                'F3_CLEAR':False,'F3_RESOLUTION':'PENDING'}
    for key, value in defaults.items():
        manifest['flags'][key] = dict(initial=value,description='第六章第三至五幕劇本的事件狀態。')
    characters_path = ROOT / 'content/characters/index.json'
    characters = read(characters_path)
    for key,name in ROLES.values():
        characters.setdefault(key,name)
    asset_path = ROOT / 'content/manifests/assets.json'
    old = [a for a in read(asset_path) if not a['id'].startswith(tuple(f'EP06-ACT0{i}-' for i in TITLES))]
    write(pack_path,pack)
    write(manifest_path,manifest)
    write(characters_path,characters)
    write(asset_path,old+assets)
    report = dict(nodes=len(scenes), segments=sum(len(s['segments']) for s in scenes),
                  choices=sum(s['kind']=='choice' for s in scenes),
                  answers=sum(len(s['choices']) for s in scenes),images=len(assets))
    write(ROOT/'docs/ep06-later-acts-import-report.json',dict(**report,sourceTrace=trace))
    print(json.dumps(report,ensure_ascii=False))


if __name__ == '__main__':
    main()
