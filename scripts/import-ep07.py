"""Import the user-provided interlude and EP07 ACT01–02, with source-pinned branches."""
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ep06_import', ROOT/'scripts/import-ep06-later-acts.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
ROLES = core.ROLES
ROLES.update({
    '唱詩文件': ('HOLY_DOCUMENT', '唱詩文件'), '預錄艾拉': ('ELLA_RECORDING', '艾拉（預錄影像）'),
    '艾琳達': ('ALINDA','艾琳達'), '軍醫': ('SIXTH_ORDER_MEDIC','軍醫'),
    '地方代表': ('LOCAL_DELEGATE','地方代表'), '守衛': ('PALACE_GUARD','守衛'),
    '官員甲': ('DISPLACED_OFFICIAL_A','官員甲'), '官員乙': ('DISPLACED_OFFICIAL_B','官員乙'),
    '中年官員': ('DISPLACED_OFFICIAL_A','中年官員'),
    '隨行書記': ('TRAVELLING_SCRIBE','隨行書記'), '書記': ('TRAVELLING_SCRIBE','書記'),
    '搬運員': ('PALACE_PORTER','搬運員'), '神職人員': ('CORONATION_CLERIC','神職人員'),
    '撒拉非尼亞': ('SERAPHINIA','薩拉菲尼亞'), '接待官': ('ROUENNE_RECEPTION','接待官'),
    '隨行接待官': ('ROUENNE_RECEPTION','隨行接待官'), '魔法學派代表': ('ROUENNE_ACADEMY_DELEGATE','魔法學派代表'),
    '代表': ('ROUENNE_ACADEMY_DELEGATE','代表'),
})
core.INLINE = re.compile(r'('+'|'.join(sorted(ROLES,key=len,reverse=True))+r')(（[^）]+）)?：「([^」]*)」')
HASHES = {
 'interlude':'c4a07de1ee23f392d8ce6176fb94e8578260b5f56adb0bcdfed5bd492cd1ee21',
 'act01':'fe2841bbd3ecf8d9988066a6b46adef33f52181cbe6565483148bc4495d2c5ad',
 'act02':'c913a7e895c06def75d23ac0190fea733eb4c31913cbdf6e9cd07a7b4b2e2303',
}
FILES={'interlude':'01_Full_VN_Script.md','act01':'EP07_ACT01_Full_Script_v1.0.md','act02':'Full_Script_ZH_TW.md'}
eq, both, flag, points = core.eq, core.both, core.flag, core.points
protected=both(eq('ROUENNE_TRANSFER_APPROVED',True),eq('S1_STATUS','SUCCESS'))
not_protected={'not':protected}
seal=eq('FINLEY_SECRETARY_SEAL',True)
not_seal={'not':seal}
assets=[]
scenes=core.scenes
trace=core.trace
exclusions=[]


def route_is(route):
    return dict(path='politicalRoute',op='eq',value=route)


def unrest(delta):
    return dict(type='unrest',delta=delta,clamp=True)


class Reader(core.Act):
    def __init__(self, folder, route=None):
        self.folder=folder
        self.route=route
        self.number=6 if folder=='interlude' else int(folder[-2:])
        self.act=f'ACT{self.number:02}'
        self.chapter='EP06' if folder=='interlude' else 'EP07'
        self.source=f'sources/ep07/{folder}/{FILES[folder]}'
        raw=(ROOT/'content'/self.source).read_bytes()
        assert core.sha(raw)==HASHES[folder],self.source
        self.rows=['']+raw.decode('utf-8-sig').splitlines()
        self.titles={int(m[1]):m[2] for row in self.rows
                     if (m:=re.match(r'^# SC(\d\d)〈([^〉]+)〉',row))}
        self.images={}
        for image in core.read(ROOT/f'content/sources/ep07/{folder}/asset-audit.json')['images']:
            assert core.sha((ROOT/image['path']).read_bytes())==image['sha256']
            self.images[image['key']]=image['id']
            if not any(x['id']==image['id'] for x in assets):
                assets.append(dict(id=image['id'],type='cg',src=image['path'],
                                   label=f"幕間 CG{image['key']}" if folder=='interlude' else f"第七章 {self.act} CG{image['key']}",
                                   status='APPROVED',source=f'使用者提供 {folder} 圖包原圖。'))

    def id(self, section, suffix=''):
        branch='_'+self.route[0] if self.route else ''
        return f'{self.chapter}_{self.act}_SC{section:02}{branch}{suffix}'

    def start(self, section, suffix='', image=None, available=None, title=None):
        # The shared base builder only supplies structure, not story or effects.
        core.Act.start(self,section,suffix,None,available or (route_is(self.route) if self.route else None),title)
        self.node['chapter']=self.chapter
        self.node['source']=self.source
        self.node['planNodeId']='EP06_ACT05' if self.folder=='interlude' else 'EP07_'+self.act
        if self.folder=='interlude':
            self.node['interlude']=True
        if self.route:
            self.node['directoryVisibleWhenLocked']=True
        if image:
            self.node['cg']=self.images.get(str(image),image)
        self.node['version']='1.1.0' if self.folder=='act02' else '1.0.0'

    def cue(self,image,line,when=None):
        self.hold()
        self.pending=(self.images[str(image)],when,line)

    def speech(self,text,line,when=None):
        text=re.sub(r'^\s*\[(?:敘事|內心)\]\s*','',text)
        text=text.replace('／奧莉維亞', '奧莉維亞').replace('／芬利','芬利')
        text=text.replace('奧莉維亞心聲：','奧莉維亞（心聲）：')
        if self.route:
            role='神職人員' if self.route=='SACRED' else '芬利'
            text=re.sub(r'\[Sacred：神職人員／World：芬利\]|\[Sacred／World 同路線角色\]',role+'：',text)
            text=re.sub(r'\[Sacred 撒拉非尼亞／World 芬利\]',
                        ('撒拉非尼亞' if self.route=='SACRED' else '芬利')+'：',text)
            parts=re.split(r'\{(SACRED|WORLD)\}',text)
            if len(parts)>1:
                text=parts[0]+''.join(parts[i+1].rstrip('／') for i in range(1,len(parts),2) if parts[i]==self.route)
        if '：「' in text and not core.INLINE.search(text):
            name=next((name for name in sorted(ROLES,key=len,reverse=True) if name in text[:text.index('：「')]),None)
            if name:
                match=re.search(r'：「([^」]*)」',text)
                self.emit(text[:match.start()]+'。',line,when)
                self.emit('「'+match[1]+'」',line,when,name)
                if text[match.end():].strip():self.emit(text[match.end():].strip(),line,when)
                return
        core.Act.speech(self,text,line,when)

    def prose(self,line,when=None,text=None):
        text=(self.rows[line] if text is None else text).strip().replace('**','')
        if not text:return
        dedicated=re.match(r'^(Sacred|World) 專屬：\s*(.*)$',text)
        if dedicated:
            if dedicated[1].upper()!=self.route:return
            text=dedicated[2]
        if self.folder=='interlude' and line==669:
            text='兩人同時抬頭，看向玩家。'
        if text.startswith('{SACRED}') or text.startswith('{WORLD}'):
            marker=re.match(r'^\{(SACRED|WORLD)\}',text)
            if marker[1]!=self.route:return
            text=text[marker.end():]
        match=re.match(r'^【CG\s*([CSW]?\d\d)｜([^】]+)】(.*)$',text)
        if not match:match=re.match(r'^\[CG\s+(\d\d[SW]?)\](.*)$',text)
        if match:
            self.cue(match[1],line,when)
            text=match[3] if len(match.groups())==3 else match[2]
            if not text.strip():return
            text=text.strip()
        text=text.replace('艾拉向鏡頭揮手','艾拉揮手道別').replace('鏡頭回到書桌俯視角度。','')
        if text.startswith('[畫面漸暗]'):
            self.hold();self.emit(' ',line,when,kind='caption',visual='BLACK');return
        if text.startswith('[轉場]') or text.startswith('鏡頭停在') or text.startswith('鏡頭短暫'):
            self.note(line,text)
            return
        # Production tags are retained outside the reading text.
        if text.startswith(('[隱藏','【HIDDEN','【ROUTE','【SYSTEM','【右上角','【玩家','{','#','>','---','→','【')):
            self.note(line,text);return
        if text.startswith(('SCENE_ID','定位：','場景：','人物：','CG：','普通選項：','關鍵選項：','時間','地點','登場人物','功能','普通選項','定位')):
            self.note(line,text);return
        if text.startswith('[CG'):raise ValueError(text)
        if text.startswith('[音效'):
            text=re.sub(r'^\[音效[^]]*\]\s*','',text)
        if text.startswith('[畫面漸暗]'):
            self.hold();self.emit(' ',line,when,kind='caption',visual='BLACK');return
        text=re.sub(r'^\[(?:敘事(?:／[^]]+)?|鏡頭)\]\s*','',text)
        if not text.strip():return
        # These sentences explicitly describe art production, not in-world events.
        if self.folder=='act02' and line==338:
            text='王權象徵依路恩儀式被呈上，蘇菲接受正式加冕。'
        if self.folder=='act02':
            text=text.replace('封面無可辨認文字。','').replace('不帶可讀文字的登錄冊','登錄冊')
            text=text.replace('沒有歡呼式的施恩場景。','').replace('難民困境不是舞台上的群眾背景，而是','難民的困境在於')
        if text.startswith('CUT TO BLACK'):
            self.hold();self.emit(' ',line,when,kind='caption',visual='BLACK');return
        self.speech(text,line,when)

    def block(self,start,end,when=None):
        line=start
        while line<=end:
            row=self.rows[line].strip().replace('**','')
            prompt=re.match(r'^【(FLAVOR-[\w-]+)｜([^】]+)】$',row) or re.match(r'^Choice ([\w-]+)｜(.+)$',row)
            if prompt:
                cursor=line+1
                options=[]
                while cursor<=end:
                    original=self.rows[cursor]
                    text=original.strip().replace('**','')
                    head=re.match(r'^(?:- )?([ABC①②③])(?:\s*)(「.*?」|[^→]+?)(?:\s*→\s*(.*))?$',text)
                    if head:
                        options.append([cursor,head[2].strip(),[head[3]] if head[3] else []])
                    elif not text:
                        if options:break
                    elif '合流' in text:
                        break
                    elif options and (original[:1].isspace() or original.startswith('　')):
                        options[-1][2].append(text.lstrip('- '))
                    else:break
                    cursor+=1
                assert len(options) in (2,3),(self.folder,line,options)
                self.flavor_options(line,prompt[1],prompt[2],options)
                line=cursor
                if '合流' not in self.rows[line]:continue
            else:self.prose(line,when)
            line+=1

    def flavor_options(self,line,code,prompt,options):
        section,available,title=self.section,self.available,self.node['title']
        stem='_'+code.replace('-','_')
        after=self.id(section,stem+'_COMMON')
        prompt=re.split('[；｜]',prompt)[0]
        if prompt.startswith('無影響'):
            prompt='您的回應'
        self.question(prompt,line,[self.option(key,opt,self.id(section,stem+'_'+key))
                                   for key,(_,opt,_) in zip('ABC',options)],flavor=True)
        image=self.held
        for key,(source_line,option,responses) in zip('ABC',options):
            self.start(section,stem+'_'+key,image,available,title)
            self.emit(option,source_line,role='奧莉維亞' if option.startswith('「') else None)
            for response in responses:self.speech(response,source_line)
            self.finish(next=after)
        self.start(section,stem+'_COMMON',image,available,title)

    def ending(self,title,next_id=None,next_chapter=None,pending=None):
        completion=dict(title=title,scope='ACT',nextChapterId=next_chapter or self.chapter,policy='NO_SCORING')
        if next_id:completion.update(nextSceneId=next_id,continueLabel='進入第七章' if next_chapter=='EP07' else '進入第二幕',
                                    nextLabel='第七章〈改革的價碼〉' if next_chapter=='EP07' else '第二幕〈路恩的新王〉')
        if pending:completion['pendingLabel']=pending
        self.finish(kind='end',completion=completion)


def interlude():
    r=Reader('interlude')
    for section,first,last in [(1,30,81),(2,94,201),(3,214,314),(4,326,396),(5,408,480),(6,492,557)]:
        r.start(section)
        r.block(first,last)
        r.finish(next=r.id(section+1))
    r.start(7,image='27')
    options=[r.option('A','「我明天去找米耶爾。」',r.id(7,'_SACRED')),
             r.option('B','拿起艾拉的信，循符文聯絡她。',r.id(7,'_WORLD')),
             r.option('C','「算了，我不想玩了。」',r.id(7,'_ABANDON'))]
    r.question('您的決定',571,options)
    for route,first,last,image in [('SACRED',580,611,'28'),('WORLD',617,657,'30')]:
        r.start(7,'_'+route,image)
        r.block(first,last)
        r.node['completionEffects']=dict(when=eq('ROUTE_06','UNSET'),
                                         effects=[flag('ROUTE_06',route),dict(type='political',value=route)])
        r.ending('幕間完 · 不能兼顧的王國','EP07_ACT01_SC01','EP07')
    r.start(7,'_ABANDON','32')
    r.node['transient']=True
    r.block(669,683)
    r.question('確定放棄並回到主畫面？',685,[
        r.option('CONFIRM','「確定，我不玩了。」',r.id(7,'_RETURN_TO_TITLE')),
        r.option('CANCEL','「取消，繼續遊戲。」',r.id(7,'_CANCEL')),
    ])
    r.start(7,'_RETURN_TO_TITLE','34')
    r.node.update(transient=True,specialEnding='RETURN_TO_TITLE')
    r.block(693,696)
    r.finish(kind='end',completion=dict(title='回主畫面',scope='ACT',nextChapterId='EP06',policy='NO_SCORING',
                                       pendingLabel='特殊結局〈回主畫面〉'))
    r.start(7,'_CANCEL','27')
    r.block(708,711)
    r.question('您的決定',713,options[:2])


def act_one():
    # Route-neutral opening preserves the script's C01 before the exclusive meeting.
    r=Reader('act01')
    r.start(1,available={'any':[route_is('SACRED'),route_is('WORLD')]})
    r.node['directoryVisibleWhenLocked']=True
    r.prose(19)
    r.finish(next='EP07_ACT01_SC01_W',conditionalNext=dict(when=route_is('SACRED'),next='EP07_ACT01_SC01_S'))
    for route in ('SACRED','WORLD'):
        r=Reader('act01',route)
        r.start(1)
        r.block(27,50) if route=='SACRED' else r.block(54,77)
        r.finish(next=r.id(2))
        r.start(2);r.block(85,118);r.finish(next=r.id(3))
        r.start(3)
        r.block(127,137) if route=='SACRED' else r.block(155,169)
        option_lines=range(140,143) if route=='SACRED' else range(172,175)
        options=[]
        for i,line in enumerate(option_lines):
            row=r.rows[line].replace('**','')
            key,title=row[2:].split('｜',1)
            label=title.split('：',1)[0]
            value=re.search(r'EP07_REFORM_RESPONSE=(\w+)',row)[1]
            effects=[points(-10 if route=='SACRED' else 20),unrest(-10 if route=='SACRED' else [10,15,20][i]),
                     flag('EP07_REFORM_RESPONSE',value)]
            options.append(r.option(key,label,r.id(3,'_'+key),effects))
        r.question('如何處理改革帶來的爭議？',139 if route=='SACRED' else 171,options)
        r.node['planDecisionOverride']=dict(source=r.source,reason='新版逐字劇本明列改革決策與數值，取代早期規劃。')
        for i,key in enumerate(['S-A','S-B','S-C'] if route=='SACRED' else ['W-A','W-B','W-C']):
            r.start(3,'_'+key,'S03' if route=='SACRED' else 'W03')
            line=(145 if route=='SACRED' else 177)+i
            r.prose(line,text=r.rows[line].split('：',1)[1])
            r.block(149,151) if route=='SACRED' else r.block(181,183)
            r.finish(next=r.id(3,'_COMMON'))
        r.start(3,'_COMMON','C04')
        r.block(187,192);r.finish(next=r.id(4))
        r.start(4)
        r.block(202,224)
        r.block(227,228,protected);r.block(230,231,not_protected)
        r.block(234,254)
        r.block(259,262,seal);r.block(265,267,not_seal)
        r.block(271,271)
        r.node['settlements']=[dict(when=both(seal,eq('EP07_ACT01_SECRETARY_BONUS_CLAIMED',False)),
                                   effects=[points(10),flag('EP07_ACT01_SECRETARY_BONUS_CLAIMED',True)])]
        r.node['scoring']='STORY_EFFECTS'
        r.finish(next=r.id(5))
        r.start(5);r.block(281,335)
        r.block(338,338,seal);r.block(340,340,not_seal);r.block(343,351)
        r.emit(' ',353,kind='caption',visual='BLACK')
        r.node['completionFlags']={'T2_STARTED':True,'F4_STARTED':True,'EP07_BORDER_REPORT_RECEIVED':True}
        r.ending('第一幕完 · 改革的價碼','EP07_ACT02_SC01')


def act_two():
    r=Reader('act02')
    r.start(1,available={'any':[route_is('SACRED'),route_is('WORLD')]})
    r.node['directoryVisibleWhenLocked']=True
    r.node['cg']=r.images['03']
    r.cue('01',0,route_is('SACRED'))
    r.emit(' ',0,kind='caption',when=route_is('SACRED'))
    r.emit(' ',0,kind='caption')
    r.finish(next='EP07_ACT02_SC01_W',conditionalNext=dict(when=route_is('SACRED'),next='EP07_ACT02_SC01_S'))
    for route in ('SACRED','WORLD'):
        r=Reader('act02',route);r.start(1)
        r.block(27,48) if route=='SACRED' else r.block(58,85)
        for line in ([51,52] if route=='SACRED' else [88,89]):
            success=line==([51,52] if route=='SACRED' else [88,89])[0]
            row=r.rows[line].split('：',1)[1]
            r.speech(row,line,protected if success else not_protected)
        r.block(95,102);r.finish(next=r.id(2))
        r.start(2);r.block(114,120)
        r.finish(next=r.id(2,'_UNSETTLED'),conditionalNext=dict(when=protected,next=r.id(2,'_PROTECTED')))
        r.start(2,'_PROTECTED');r.block(124,156)
        r.node['completionFlags']={'S3_CLEAR':True,'S3_RESOLVED_ONCE':True,'EP07_ACT02_REFUGEE_RESPONSE':'SETTLED'}
        r.finish(next=r.id(2,'_CLOSE'))
        r.start(2,'_UNSETTLED');r.block(164,178)
        options=[]
        for key,line,cost in [('A',181,-10),('B',182,-20),('C',183,-10)]:
            effects=[flag('EP07_ACT02_REFUGEE_RESPONSE',key)]
            pending=[points(cost),unrest(10),flag('S3_CLEAR',True),flag('S3_RESOLVED_ONCE',True)]
            options.append(r.option(key,r.rows[line].strip()[3:],r.id(2,'_RESPONSE_'+key),effects,
                                    preview=[dict(when=eq('S3_RESOLVED_ONCE',False),effects=pending)]))
        r.question('如何處理仍待安置的路恩人？',180,options)
        for key,first,last,cost in [('A',186,189,-10),('B',193,197,-20),('C',201,204,-10)]:
            r.start(2,'_RESPONSE_'+key,'10');r.block(first,last)
            r.node['settlements']=[dict(when=eq('S3_RESOLVED_ONCE',False),
                                       effects=[points(cost),unrest(10),flag('S3_CLEAR',True),flag('S3_RESOLVED_ONCE',True)])]
            r.node['scoring']='STORY_EFFECTS';r.finish(next=r.id(2,'_RESPONSE_COMMON'))
        r.start(2,'_RESPONSE_COMMON','10');r.block(207,211);r.finish(next=r.id(2,'_CLOSE'))
        r.start(2,'_CLOSE');r.block(215,215);r.finish(next=r.id(3))
        r.start(3);r.block(226,263)
        opts=[r.option('A','準確回答她的問題。',r.id(3,'_ACCURATE')),
              r.option('B','給出比較模糊的回答。',r.id(3,'_VAGUE'))]
        r.question('如何回答蘇菲？',265,opts,flavor=True)
        r.start(3,'_ACCURATE','15');r.emit(' ',0,kind='caption');r.block(270,273,protected)
        for key,line in [('A',283),('B',284),('C',285)]:
            r.speech(r.rows[line].split('：',1)[1],line,both(not_protected,eq('EP07_ACT02_REFUGEE_RESPONSE',key)))
        r.finish(next=r.id(3,'_CLOSE'))
        r.start(3,'_VAGUE','15');r.emit(' ',0,kind='caption');r.block(276,280,protected);r.block(288,291,not_protected)
        r.finish(next=r.id(3,'_CLOSE'))
        r.start(3,'_CLOSE','15');r.block(293,305);r.finish(next=r.id(4))
        r.start(4);r.block(315,371)
        r.node['completionFlags']={'SOPHIE_CORONATED':True}
        r.finish(next=r.id(5))
        r.start(5);r.block(381,390)
        r.block(396,408) if route=='SACRED' else r.block(412,422)
        r.block(424,436)
        r.ending('第二幕完 · 路恩的新王',pending='第三幕 · 敬請期待')


def main():
    existing_acts={s['act'] for s in core.read(ROOT/'content/episodes/ep07/chapter.json')['scenes']}
    interlude();act_one();act_two()
    used={s['cg'] for s in scenes if 'cg' in s}|{p['cg'] for s in scenes for p in s['segments'] if 'cg' in p}
    assert not {a['id'] for a in assets}-used,{a['id'] for a in assets}-used
    p=ROOT/'content/episodes/ep06/chapter.json';pack=core.read(p)
    prior=[s for s in pack['scenes'] if not s.get('interlude')]
    end=next(s['completion'] for s in prior if s.get('completion',{}).get('scope')=='CHAPTER')
    end.pop('pendingLabel',None)
    end.update(nextSceneId='EP06_ACT06_SC01',nextChapterId='EP06',continueLabel='進入幕間',nextLabel='幕間〈不能兼顧的王國〉')
    pack['scenes']=prior+[s for s in scenes if s['chapter']=='EP06'];core.write(p,pack)
    core.write(ROOT/'content/episodes/ep07/chapter.json',dict(schemaVersion=1,id='EP07',version='1.1.0',status='DRAFT',
               source='使用者提供第七章第一幕v1.0與第二幕v1.1。',scenes=[s for s in scenes if s['chapter']=='EP07']))
    p=ROOT/'content/manifests/story.json';manifest=core.read(p);manifest['version']='0.16.0-interlude-ep07-act01-act02'
    next(c for c in manifest['chapters'] if c['id']=='EP07').update(status='DRAFT_AVAILABLE',file='episodes/ep07/chapter.json',entry='EP07_ACT01_SC01')
    for key,value in {'ROUTE_06':'UNSET','EP07_REFORM_RESPONSE':'UNSET','EP07_ACT01_SECRETARY_BONUS_CLAIMED':False,
                       'T2_STARTED':False,'F4_STARTED':False,'EP07_BORDER_REPORT_RECEIVED':False,
                       'EP07_ACT02_REFUGEE_RESPONSE':'UNSET','S3_CLEAR':False,'S3_RESOLVED_ONCE':False,
                       'SOPHIE_CORONATED':False}.items():
        manifest['flags'][key]=dict(initial=value,description='幕間與第七章逐字劇本的路線及一次性事件狀態。')
    core.write(p,manifest)
    p=ROOT/'content/manifests/assets.json';old=[a for a in core.read(p) if not a['id'].startswith('EP07-')]
    core.write(p,old+assets)
    p=ROOT/'content/characters/index.json';characters=core.read(p)
    for key,label in ROLES.values():characters.setdefault(key,label)
    core.write(p,characters)
    core.write(ROOT/'docs/ep07-import-report.json',dict(nodes=len(scenes),segments=sum(len(s['segments']) for s in scenes),
         choices=sum(s['kind']=='choice' for s in scenes),answers=sum(len(s['choices']) for s in scenes),
         images=len(assets),trace=trace,sourceHashes=HASHES))
    print(len(scenes),'nodes',len(assets),'CGs')
    if 'ACT03' in existing_acts:
        import subprocess,sys
        subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/import-ep07-act03.py')],check=True)
        if 'ACT04' in existing_acts:
            subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/import-ep07-act04.py')],check=True)


if __name__=='__main__':main()
