"""EP07 ACT03: isolated Sacred/World timelines; author-approved expansion and balancing."""
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ep07_base', ROOT/'scripts/import-ep07.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
core=base.core
core.ROLES.update({
    '教會使者':('CHURCH_EMISSARY','教會使者'),'教會代表':('CHURCH_DELEGATE','教會代表'),
    '村民':('VOID_DISPLACED_VILLAGER','村民'),'第六團騎士':('SIXTH_ORDER_KNIGHT','第六團騎士'),
    '技師':('OBSERVATORY_TECHNICIAN','技師'),'學派現場負責人':('OBSERVATORY_SUPERVISOR','學派現場負責人'),
    '負責人':('OBSERVATORY_SUPERVISOR','學派現場負責人'),
    '研究員甲':('OBSERVATORY_RESEARCHER_A','研究員甲'),'研究員乙':('OBSERVATORY_RESEARCHER_B','研究員乙'),
    '軍官甲':('SIXTH_ORDER_OFFICER_A','軍官甲'),'軍官乙':('SIXTH_ORDER_OFFICER_B','軍官乙'),
    '另一名騎士':('SIXTH_ORDER_KNIGHT','第六團騎士'),
})
core.INLINE=re.compile(r'('+'|'.join(sorted(core.ROLES,key=len,reverse=True))+r')(（[^）]+）)?：「([^」]*)」')
eq,both,flag,points=core.eq,core.both,core.flag,core.points
SCENES=core.scenes
ASSETS=[]
FLAGS={}
def declare(key,value=False):
    FLAGS[key]=dict(initial=value,description='第七章第三幕：路線獨立的證據、進度與一次性結算。')
    return key
SEAL=base.seal


class Act(base.Reader):
    def __init__(self,route):
        self.route=route
        self.number=3;self.act='ACT03';self.chapter='EP07';self.folder='act03'
        self.source='sources/ep07/act03/'+route.lower()+'/'+('02_Expanded_VN_Script_v1.1.md' if route=='SACRED' else '01_Full_Script_World_SC01-09.md')
        raw=(ROOT/'content'/self.source).read_bytes()
        if route=='WORLD':assert core.sha(raw)=='54f4aa9843ea82ff8bcdb6bd4e80cfb472ab4d206cd1ab8bae5265fe4d8dba21'
        self.rows=['']+raw.decode('utf-8-sig').splitlines()
        self.titles={int(m[1]):m[2] for row in self.rows if (m:=re.match(r'^## SC(\d\d)｜(.+)$',row))}
        audit=core.read(ROOT/f'content/sources/ep07/act03/{route.lower()}/asset-audit.json')
        self.images={x['key']:x['id'] for x in audit['images']}
        for x in audit['images']:
            assert core.sha((ROOT/x['path']).read_bytes())==x['sha256']
            ASSETS.append(dict(id=x['id'],type='cg',src=x['path'],label=f'第七章 第三幕 {route} CG{x["key"]}',status='APPROVED',source=audit['archive']))
        self.prefix='EP07_'+route[0]+'3_'
        self.count=declare(self.prefix+'EVIDENCE_COUNT',0)
        self.paid=declare(self.prefix+'SETTLED')
        self.evidence={}

    def evidence_key(self,key):
        if key not in self.evidence:self.evidence[key]=declare(self.prefix+key)
        return self.evidence[key]

    def start(self,section,suffix='',image=None,available=None,title=None):
        super().start(section,suffix,image,available,title)
        self.node['version']='1.3.0' if self.route=='WORLD' else '1.1.0'

    def prose(self,line,when=None,text=None):
        text=(self.rows[line] if text is None else text).strip().replace('**','')
        if not text:return
        cg=re.match(r'^【(?:W-CG|CG)(\d\d)(?:｜[^】]*)?】$',text)
        if cg:self.cue(cg[1],line,when);return
        if text.startswith(('##','>','---','【','時間','若有','- ','@')):
            self.note(line,text);return
        replacements={
            229:'芬利悄悄抄下幾筆輪廓與所在位置，隨即把筆記收好。',
            528:'芬利翻開舊研究筆記，把在現場記下的幾筆草圖放到旁邊。',
            657:'芬利拿出一張乾淨紙，低頭寫下幾行字，折起後推到艾拉面前。紙上的內容被折痕遮住。',
        }
        if self.route=='WORLD':text=replacements.get(line,text)
        self.speech(text,line,when)

    def increment(self,code,evidence):
        done=declare(self.prefix+code+'_RECORDED')
        return [dict(when=both(eq(done,False),eq(self.count,n)),
                     effects=[flag(self.count,n+1),flag(done,True),flag(self.evidence_key(evidence),True)]) for n in range(12)]

    def once(self,key,effects):
        return dict(when=eq(declare(self.prefix+key),False),effects=effects+[flag(self.prefix+key,True)])

    def decision(self,code,prompt,options,best,evidence,line,charge=0,requires=None,auto=False,extras=None):
        section=self.section
        self.hold()
        image=next((p['cg'] for p in reversed(self.node['segments']) if p.get('cg') and not p.get('when')),self.node.get('cg'))
        suffix='_'+code
        after=self.id(section,suffix+'_COMMON')
        manual=self.id(section,suffix+'_CHOICE')
        # Always enter via a narrative boundary so an automatic pass never displays a choice.
        if auto:
            self.finish(next=manual,conditionalNext=dict(when=SEAL,next=self.id(section,suffix+'_AUTO')))
            self.start(section,suffix+'_AUTO',image)
            self.emit('芬利依皇家秘書印的授權，完成文件與程序核對。',line)
            self.node['settlements']=self.increment(code,evidence)
            self.finish(next=after)
            self.start(section,suffix+'_CHOICE',image)
        choices=[]
        fee=self.once(code+'_COST',[points(-charge)]) if charge else None
        for key,label in options:
            preview=[fee] if fee else None
            choices.append(self.option(key,label,self.id(section,suffix+'_'+key),when=(requires if key==best else None),preview=preview))
        self.question(prompt,line,choices)
        for key,label in options:
            self.start(section,suffix+'_'+key,image)
            # Action options remain actions; do not put invented spoken words in Olivia's mouth.
            self.emit(label,line,role='奧莉維亞' if label.startswith('「') else None)
            settlements=([fee] if fee else [])
            if key==best:settlements+=self.increment(code,evidence)
            if extras:settlements+=extras
            if settlements:self.node['settlements']=settlements;self.node['scoring']='STORY_EFFECTS'
            self.finish(next=after)
        self.start(section,suffix+'_COMMON',image)


WORLD_COSTS={'W04':5,'W06':5}
def world():
    r=Act('WORLD')
    boundaries=[(i,m) for i,row in enumerate(r.rows) if (m:=re.match(r'^## SC(\d\d)｜(.+)',row))]
    evidence=['RAW_REPORT','CAUSE','GROUND','MEDICAL_LEDGER','FIELD','TRANSPORT','REMEDY','OWNERSHIP','REVIEW','REQUEST_CHANNEL','COMPENSATION_PROCEDURE','AGREEMENT']
    for key in evidence:r.evidence_key(key)
    for index,(first,m) in enumerate(boundaries):
        section=int(m[1]);last=boundaries[index+1][0]-1 if index+1<len(boundaries) else len(r.rows)-1
        r.start(section)
        line=first+1
        while line<=last:
            text=r.rows[line].replace('**','').strip()
            match=re.match(r'^【(W\d\d)／(?:最終)?玩家選擇：(.+?)】$',text)
            if match:
                code,prompt=match.groups();options=[];cursor=line+1
                while cursor<=last and r.rows[cursor].startswith('- '):
                    row=r.rows[cursor].replace('**','')
                    option=re.match(r'^- ([ABCD])(?:【[^】]*】)?\s*(.*?)\s*→',row)
                    assert option,row
                    label=option[2]
                    label=label.replace('；紙條內容不寫入玩家可見劇本','')
                    label=re.sub(r'。?需有永久秘書印.*','',label)
                    options.append((option[1],label));cursor+=1
                if code!='W13':
                    num=int(code[1:]);best=next(re.match(r'- ([ABC])',r.rows[j])[1] for j in range(line+1,cursor) if '【較佳】' in r.rows[j])
                    extras=[r.once('CRISIS_NOTICE',[base.unrest(5)])] if code=='W01' else None
                    r.decision(code,prompt,options,best,evidence[num-1],line,WORLD_COSTS.get(code,0),auto=code in ('W08','W10','W12'),extras=extras)
                else:
                    world_final_choice(r,prompt,options,line)
                line=cursor;continue
            if text=='【SC02 END】':
                r.node.setdefault('settlements',[]).append(r.once('LEAK_REPAIRED',[base.unrest(-5),flag(declare('EP07_WORLD_VOID_LEAK_STOPPED'),True)]))
            r.prose(line)
            line+=1
        if section<9:r.finish(next=r.id(section+1))
        else:r.ending('第三幕完 · 虛空聖母',pending='第四幕 · 敬請期待')


def world_final_choice(r,prompt,options,line):
    count=lambda n:dict(path='flags.'+r.count,op='gte',value=n)
    required=both(SEAL,count(9),*[eq(r.evidence_key(x),True) for x in ['CAUSE','OWNERSHIP','REQUEST_CHANNEL','COMPENSATION_PROCEDURE','AGREEMENT']])
    r.hold()
    after=r.id(9,'_W13_COMMON');image=next((p['cg'] for p in reversed(r.node['segments']) if p.get('cg')),r.node.get('cg'))
    tone=declare('EP07_WORLD_ENDING_TONE','UNSET')
    r.question(prompt,line,[r.option(key,label,r.id(9,'_W13_'+key),[flag(tone,{'A':'FORMAL','B':'FAVOR','C':'DOCUMENTED','D':'SEAL'}[key])],when=required if key=='D' else None) for key,label in options])
    for key,label in options:
        r.start(9,'_W13_'+key,image);r.emit(label,line,role='奧莉維亞')
        r.finish(next=after)
    r.start(9,'_W13_COMMON',image)
    outcome=declare('EP07_WORLD_SETTLEMENT','UNSET')
    for when,bonus,name in [(required,25,'SEALED'),(count(9),20,'COMPLETE'),(count(5),15,'PREPARED'),(None,10,'BASIC')]:
        guard=eq(r.paid,False)
        r.node.setdefault('settlements',[]).append(dict(when=both(guard,when) if when else guard,
            effects=[points(bonus),flag(r.paid,True),flag(outcome,name)]+[flag(declare(k),True) for k in [
                'EP07_WORLD_ACADEMY_LIABILITY_ACKNOWLEDGED','EP07_WORLD_ALINDA_INVOICE_PENDING',
                'EP07_WORLD_FINLEY_NOTE_REQUEST_ACCEPTED','EP07_WORLD_AYLA_FAVOR_OWED']]))
    # These settlements are carried to the final node after its source dialogue is read.


SACRED_EVIDENCE=['ORIGIN','EXPENSE','RIGHTS','FIELD','CHAIN','REVISION','GROUND','WIRING','AUTHORITY','CAUSE','REMEDY','AGREEMENT']
def sacred():
    r=Act('SACRED')
    for x in SACRED_EVIDENCE:r.evidence_key(x)
    original=(ROOT/'content/sources/ep07/act03/sacred/EP07_ACT03_Sacred_Full_Script_v1.0.md').read_bytes()
    assert core.sha(original)=='2570fa38e69b4e51a6cba664cb0b703f6204a70e8a5d6c311c9774b38f15f9df'
    raw=original.decode('utf-8-sig').splitlines()
    definitions={}
    for i,row in enumerate(raw):
        if m:=re.match(r'^## Choice (C\d\d)｜(.+)',row):
            if m[1]=='C13':continue
            opts=[]
            for row in raw[i+1:]:
                if row.startswith('## '):break
                if o:=re.match(r'^([ABC])\.\s*(.*)',row):
                    label=o[2].replace('**','');label=re.sub(r'（正解.*?）','',label).strip()
                    opts.append((o[1],label))
            assert len(opts)==3,(m[1],opts)
            definitions[m[1]]=(m[2].split('（')[0],opts)
    start=next(i for i,row in enumerate(r.rows) if row.startswith('## SC01'))
    for line in range(start,len(r.rows)):
        row=r.rows[line].strip()
        if row=='## RESULT_FAILURE':break
        if m:=re.match(r'^## SC(\d\d)',row):
            section=int(m[1])
            if section>1:r.finish(next=r.id(section))
            r.start(section);continue
        if m:=re.match(r'^@C(\d\d)$',row):
            num=int(m[1]);code='C'+m[1]
            if num==13:
                sacred_final(r,line);break
            e=lambda key:eq(r.evidence_key(key),True)
            required={5:e('RIGHTS'),6:both(e('ORIGIN'),e('EXPENSE')),8:dict(any=[e('ORIGIN'),e('GROUND')]),9:both(e('RIGHTS'),e('CHAIN')),12:both(e('RIGHTS'),e('AUTHORITY'))}.get(num)
            extra=[]
            if num==1:extra.append(r.once('CRISIS_NOTICE',[base.unrest(5)]))
            if num==10:extra.append(r.once('LEAK_REPAIRED',[base.unrest(-5),flag(declare('EP07_SACRED_VOID_LEAK_STOPPED'),True)]))
            if num==11:extra.append(r.once('A2_RECORDED',[flag(declare('ALINDA_A2_CLEAR'),True),dict(type='clear',key='alinda',delta=1)]))
            prompt,options=definitions[code]
            r.decision(code,prompt,options,{1:'B',2:'B',3:'C',4:'A',5:'B',6:'C',7:'C',8:'A',9:'C',10:'B',11:'A',12:'C'}[num],SACRED_EVIDENCE[num-1],line,
                       charge={2:15,4:10,6:15}.get(num,0),requires=required,auto=num in (3,9,12),extras=extra)
            continue
        if row=='@SEAL_CG35':
            r.cue('35',line,SEAL)
            r.emit('芬利把可追蹤文書的術式範本放到協議旁。查閱與轉交，都將留下可核對的軌跡。',line,SEAL)
            continue
        if row=='@EVIDENCE_PRESENTATION':
            r.emit('奧莉維亞將已經核對的文件依序攤開。哪些問題有了憑據，哪些仍有缺口，在桌上已經分得清楚。',line)
            continue
        r.prose(line)


def sacred_final(r,line):
    e=lambda key:eq(r.evidence_key(key),True)
    full=both(dict(path='flags.'+r.count,op='gte',value=9),*[e(x) for x in ['EXPENSE','RIGHTS','AUTHORITY','CAUSE','AGREEMENT']])
    perfect=both(SEAL,full)
    partial=dict(any=[e('CHAIN'),e('AUTHORITY')])
    targets={k:r.id(9,'_C13_'+k) for k in 'ABCD'}
    options=[('A','請教會內部自行檢討，先維持原本安排。'),('B','先建立資料轉交的通報與核對程序。'),('C','攤出證據，重訂合作窗口與王宮資訊的核准範圍。'),('D','依完整協議加入皇家文書追蹤術式。')]
    r.question('如何與米耶爾完成最後的交涉？',line,[r.option(k,t,targets[k],when=perfect if k=='D' else None) for k,t in options])
    names=['FAILURE','PARTIAL','FULL','SEAL']
    ids={name:r.id(9,'_RESULT_'+name) for name in names}
    for k,_ in options:
        r.start(9,'_C13_'+k,'39')
        r.emit('奧莉維亞將最後的要求說清楚，等待米耶爾回答。',line)
        if k=='A':r.finish(next=ids['FAILURE'])
        elif k=='D':r.finish(next=ids['SEAL'])
        elif k=='B':r.finish(next=ids['FAILURE'],conditionalNext=dict(when=partial,next=ids['PARTIAL']))
        else:
            r.finish(next=r.id(9,'_C13_CHECK'),conditionalNext=dict(when=full,next=ids['FULL']))
    r.start(9,'_C13_CHECK','39');r.emit('米耶爾逐項核對桌上的紀錄。',line)
    r.finish(next=ids['FAILURE'],conditionalNext=dict(when=partial,next=ids['PARTIAL']))
    headings={row[3:]:i for i,row in enumerate(r.rows) if row.startswith('## RESULT_') or row=='## COMMON_END'}
    ordered=sorted(headings.items(),key=lambda x:x[1])
    blocks={name:(first+1,ordered[i+1][1]-1 if i+1<len(ordered) else len(r.rows)-1) for i,(name,first) in enumerate(ordered)}
    for name,bonus in zip(names,[20,40,50,60]):
        r.start(9,'_RESULT_'+name,'39')
        if name=='SEAL':
            first,last=blocks['RESULT_FULL']
            for n in range(first,last+1):r.prose(n)
        first,last=blocks['RESULT_'+name]
        for n in range(first,last+1):r.prose(n)
        result=declare('EP07_SACRED_NEGOTIATION_RESULT','UNSET')
        effects=[points(bonus),flag(result,name),flag(r.paid,True)]
        for key,value in {'CHURCH_ALERTED':name!='FAILURE','CHURCH_RESTRAINED':name!='FAILURE','CHURCH_REALIGNED':name in ('FULL','SEAL'),'PALACE_DOCUMENT_TRACE_ACTIVE':name=='SEAL','FINLEY_SEAL_PROTOCOL':name=='SEAL'}.items():
            effects.append(flag(declare('EP07_SACRED_'+key),value))
        r.node['settlements']=[dict(when=eq(r.paid,False),effects=effects)]
        r.finish(next=r.id(9,'_END'))
    r.start(9,'_END','39')
    # Preserve the result CG through the shared closing prose.
    r.node['cgWhen']=[dict(when=eq('EP07_SACRED_NEGOTIATION_RESULT',name),cg=r.images[cg]) for name,cg in [('PARTIAL','40'),('FULL','41'),('SEAL','42')]]
    first,last=blocks['COMMON_END']
    for n in range(first,last+1):r.prose(n)
    r.ending('第三幕完 · 虛空聖母',pending='第四幕 · 敬請期待')


def main():
    had_act04=any(s['act']=='ACT04' for s in core.read(ROOT/'content/episodes/ep07/chapter.json')['scenes'])
    sacred();world()
    used={s['cg'] for s in SCENES if s.get('cg')}|{p['cg'] for s in SCENES for p in s['segments'] if p.get('cg')}
    assert not {a['id'] for a in ASSETS}-used
    path=ROOT/'content/episodes/ep07/chapter.json';pack=core.read(path)
    prior=[s for s in pack['scenes'] if s['act']!='ACT03']
    for s in prior:
        if s['act']=='ACT02' and s.get('completion'):
            route='SACRED' if '_S_' in s['id'] else 'WORLD'
            end=s['completion'];end.pop('pendingLabel',None)
            end.update(nextSceneId=f'EP07_ACT03_SC01_{route[0]}',nextChapterId='EP07',continueLabel='進入第三幕',nextLabel='第三幕〈虛空聖母〉')
    pack.update(version='1.3.0',source='第七章兩條獨立世界線；Sacred 經使用者授權擴寫，World 依 v1.3 原稿。',scenes=prior+SCENES)
    core.write(path,pack)
    path=ROOT/'content/manifests/story.json';manifest=core.read(path);manifest['version']='0.17.0-ep07-act03-worldlines';manifest['flags'].update(FLAGS);core.write(path,manifest)
    path=ROOT/'content/manifests/assets.json';old=[a for a in core.read(path) if not a['id'].startswith('EP07-ACT03-')];core.write(path,old+ASSETS)
    path=ROOT/'content/characters/index.json';characters=core.read(path)
    for key,label in core.ROLES.values():characters.setdefault(key,label)
    core.write(path,characters)
    core.write(ROOT/'docs/ep07-act03-import-report.json',dict(nodes=len(SCENES),segments=sum(len(s['segments']) for s in SCENES),answers=sum(len(s['choices']) for s in SCENES),images=len(ASSETS),sourceTrace=core.trace))
    print(len(SCENES),'nodes',len(ASSETS),'CGs')
    if had_act04:
        import subprocess,sys
        subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/import-ep07-act04.py')],check=True)


if __name__=='__main__':main()
