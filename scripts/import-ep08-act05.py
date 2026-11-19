"""EP08 finale, supplied 30/17 CG editions, deterministic negotiation and separate F5 events."""
import importlib.util
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ep08_act04',ROOT/'scripts/import-ep08-act04.py')
previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
base,core=previous.base,previous.core
SCENES,ASSETS,FLAGS=core.scenes,[],{}
TITLES={'SACRED':'善意的限度','WORLD':'老師留下的空白'}
for name,ident in {'米椰爾':'MIEL','侍從':'PALACE_ATTENDANT','東線傳令官':'EASTERN_FRONT_COURIER','艾拉':'ELLA','赫碧':'HEBE'}.items():core.ROLES[name]=(ident,name)
core.INLINE=re.compile(r'('+'|'.join(sorted(core.ROLES,key=len,reverse=True))+r')(（[^）]+）)?：「([^」]*)」')
core.ATTRIBUTED={}
def declare(key,initial=False):
    FLAGS[key]=dict(initial=initial,description='第八章第五幕：獨立路線決策、芬利事件與一次性結算。');return key
SP={code:declare('EP08_S5_'+code,'UNSET') for code in ['F5','P01','P02','P03']}
SDONE=declare('EP08_SACRED_ACT05_POLITICS_RESOLVED')
SF5=declare('EP08_SACRED_ACT05_F5_RESOLVED')
SGRANT=declare('EP08_SACRED_ACT05_F5_CLEAR_GRANTED')
TIER=declare('EP08_SACRED_ACT05_POLITICAL_TIER',-1)
WF5=declare('EP08_WORLD_ACT05_F5_CHOICE','UNSET')
WAPPROVED=declare('EP08_WORLD_ACT05_F5_APPROVED')
WCOMPLETE=declare('EP08_WORLD_ACT05_F5_COMPLETE')
WCONTACT=declare('EP08_WORLD_ACT05_INVESTOR_CONTACT','NOT_VISITED')
WSEAL=declare('EP08_WORLD_ACT05_ELIA_SEAL_POLICY','NOT_VISITED')
MATRIX=core.read(ROOT/'content/sources/ep08/act05/sacred/02_Codex/tests/all_36_political_combinations.json')
assert len(MATRIX)==36
PVALUES={'P01':['A','B','C','D'],'P02':['LIMIT','BOUND','EXPAND'],'P03':['CASE','OPEN','STANDING']}
def tier_condition(tier):
    return dict(any=[core.both(*[core.eq(SP[key],r[field]) for key,field in [('P01','entry'),('P02','middle'),('P03','closing')]]) for r in MATRIX if r['tier']==tier])

class Act(previous.Act):
    def __init__(self,route):
        self.route=route;self.number,self.act,self.chapter,self.folder=5,'ACT05','EP08','act05';self.context=''
        folder=ROOT/f'content/sources/ep08/act05/{route.lower()}';audit=core.read(folder/'asset-audit.json')
        self.source=f'sources/ep08/act05/{route.lower()}/{audit["script"]}'
        raw=(ROOT/'content'/self.source).read_bytes();assert core.sha(raw)==audit['scriptSha256']
        self.rows=['']+raw.decode('utf-8-sig').splitlines()
        self.titles={1:'東北塔的午後',2:'來自聖安奴加斯的善意',3:'合作的代價',4:'不該管的事情',5:'沒有協議的告別'} if route=='SACRED' else {1:'東北塔難得平靜的下午',2:'那些不在場的人',3:'芬利的請求',4:'分岔的午後',5:'尚未寫定的答案',6:'來自東線的信'}
        self.images={}
        for x in audit['images']:
            assert core.sha((ROOT/x['path']).read_bytes())==x['sha256'];self.images[x['key']]=x['id']
            ASSETS.append(dict(id=x['id'],type='cg',src=x['path'],label=f'第八章 第五幕 {route} CG{x["key"]}',status='APPROVED',source=audit['archive']))
        self.anchors={}
        if route=='SACRED':
            # Delivered art has its own 30-image semantic map, superseding the
            # earlier 32-prompt numbering. Seven outcome images are 22..28.
            for needle,image in [
                ('【旁白】東北塔向來','01'),('【艾莉西亞】「通常的元素術式','02'),
                ('【旁白】芬利原本坐在','03'),('【F5 有效選項','04'),('【旁白】三人好不容易','05'),
                ('【旁白】米椰爾走進','06'),('【米椰爾】「殿下。能在這裡','07'),('【奧莉維亞】「歡迎。坐吧','08'),
                ('【旁白】米椰爾把自己的文件','09'),('【旁白】陽光逐漸從書桌','14'),
                ('【艾莉西亞】「我想確認一件事','15'),('【米椰爾】「我們確實有需要','16'),
                ('【奧莉維亞】「在瓦肯領地','17'),('【奧莉維亞】「正是如此。所以我才奇怪','18'),
                ('【艾莉西亞】「我再說清楚一點','19'),('【芬利】「而且一旦民生協調','20'),
                ('【旁白】走廊外','21'),('【艾莉西亞】「今天至少有件事','29'),('【旁白】門外再次傳來','30')]:
                matches=[i for i,row in enumerate(self.rows) if row.startswith(needle)];assert len(matches)==1,(needle,matches);self.anchors[matches[0]]=image

    def start(self,section,suffix='',image=None):
        base.Reader.start(self,section,suffix,image)
        self.node.update(planNodeId='EP08_ACT05',version='1.0.0')
        if self.route=='SACRED':
            needed=[]
            if section>=2:needed.append(SP['F5'])
            if section>=3:needed.append(SP['P01'])
            if section>=4:needed.append(SP['P02'])
            if section>=5:needed.append(SP['P03'])
            if section==3:self.node['cgWhen']=[dict(when=core.eq(SP['P01'],key),cg=self.images[str(10+i)]) for i,key in enumerate('ABCD')]
        else:
            needed=[WF5] if section>=4 else []
            if '_AUTEDAN' in suffix:self.node['availableWhen']=core.both(self.node['availableWhen'],core.eq(WF5,'A'));self.node['title']='艾拉的另一份工作' if section==4 else '第三位投資者'
            if '_ACADEMY' in suffix:self.node['availableWhen']=core.both(self.node['availableWhen'],core.eq(WF5,'B'));self.node['title']='學院還是老樣子' if section==4 else '艾莉留下的封印資訊'
        if needed:self.node['availableWhen']=core.both(self.node['availableWhen'],*[{'not':core.eq(k,'UNSET')} for k in needed])

    def prose(self,line,when=None,text=None):
        row=(self.rows[line] if text is None else text).strip()
        if text is None and line in self.anchors:self.cue(self.anchors[line],line,when)
        if not row:return
        if self.route=='WORLD' and (cg:=re.fullmatch(r'【CG(\d\d[AB]?)｜[^】]+】',row)):
            self.cue(cg[1],line,when);return
        if row.startswith(('#','`','---','**','【CG')):self.note(line,row);return
        row=re.sub(r'\*\*[^*]+\*\*','',row)
        row=row.replace('真正的投資決定，留在下個章節。','真正的投資決定，還得等後續會談。').replace('她花了數章才建立的合作方式','她這段日子才建立的合作方式')
        if self.route=='SACRED':
            tags=list(re.finditer(r'【([^】]+)】([^【]*)',row))
            if tags:
                for tag in tags:
                    label,body=tag[1],tag[2].strip()
                    if not body:continue
                    name=label.split('／')[0]
                    if name=='旁白':self.emit(body,line,when)
                    elif name in core.ROLES:self.emit(body,line,when,role=name,suffix='（心聲）' if '心聲' in label else '（低聲）' if '低聲' in label else None)
                    else:self.note(line,row)
                return
        row=row.replace('奧莉薇雅','奧莉維亞')
        # A flavor reply may mix several speakers with attributed actions.
        # Parse every speaker, including "Olivia takes a bite: ...", rather
        # than leaving the remainder after the first normal quote as prose.
        pattern=re.compile(r'('+'|'.join(sorted(core.ROLES,key=len,reverse=True))+r')([^：「」]*?)：「([^」]*)」')
        matches=list(pattern.finditer(row));end=0
        if not matches:self.emit(row,line,when);return
        for m in matches:
            if row[end:m.start()].strip():self.emit(row[end:m.start()].strip(),line,when)
            if m[2].strip():self.emit(m[1]+m[2]+'。',line,when)
            self.emit('「'+m[3]+'」',line,when,role=m[1]);end=m.end()
        if row[end:].strip():self.emit(row[end:].strip(),line,when)

    def block(self,first,last,when=None):
        line=first
        while line<=last:
            row=self.rows[line]
            if re.search(r'【(?:FL\d\d 無影響選項|無影響選項 F\d\d)',row):line=self.flavor(line)
            elif self.route=='SACRED' and re.match(r'【(?:F5|P0\d) (?:有效選項|政治入口)',row):line=self.major(line)
            else:self.prose(line,when);line+=1

    def flavor(self,line):
        heading=self.rows[line];code=re.search(r'FL\d\d|F\d\d',heading)[0];suffix=self.context+'_'+code
        prompt=heading.split('｜',1)[1].rstrip('】');options=[];stop=line+1
        while stop<len(self.rows):
            row=self.rows[stop].strip()
            if m:=re.fullmatch(r'- ([ABC])「(.*?)」→\s*(.*)',row):options.append((m[1],'「'+m[2]+'」',m[3],stop))
            elif row:
                break
            stop+=1
        assert len(options)==3,(line,options)
        section=self.section;variants=self.node.get('cgWhen');common=self.id(section,suffix+'_COMMON')
        self.question(prompt,line,[self.option(key,label,self.id(section,suffix+'_'+key)) for key,label,_,_ in options],flavor=True)
        image=self.held
        for key,label,response,n in options:
            self.start(section,suffix+'_'+key,image)
            if variants:self.node['cgWhen']=variants
            if self.route=='WORLD':self.emit(label,n,role='奧莉維亞')
            self.prose(n,text=response)
            self.finish(next=common)
        self.start(section,suffix+'_COMMON',image)
        if variants:self.node['cgWhen']=variants
        return stop

    def previews(self,code,pick):
        order=['P01','P02','P03'];index=order.index(code);fields=['entry','middle','closing'];groups={}
        prefixes={tuple(row[f] for f in fields[:index]) for row in MATRIX}
        for prefix in prefixes:
            rows=[r for r in MATRIX if r[fields[index]]==pick and all(r[f]==v for f,v in zip(fields,prefix))]
            best=max(r['political_delta'] for r in rows)
            if best<0:groups.setdefault(best,[]).append(core.both(*[core.eq(SP[k],v) for k,v in zip(order,prefix)]))
        return [dict(when=core.both(core.eq(SDONE,False),dict(any=conditions)),effects=[core.points(delta)]) for delta,conditions in groups.items()]

    def major(self,line):
        if line in self.anchors:self.cue(self.anchors[line],line)
        code=re.search(r'F5|P0\d',self.rows[line])[0];options=[];cursor=line+1
        while cursor<len(self.rows):
            row=self.rows[cursor]
            m=re.match(r'- \*\*'+code+r'_(\w+)｜[^*]+\*\*：「([^」]+)」',row)
            if m:options.append((m[1],'「'+m[2]+'」',cursor,[]))
            elif row.startswith('  - '):options[-1][3].append(cursor)
            elif row.strip():break
            cursor+=1
        expected=['A','B','C'] if code=='F5' else PVALUES[code];assert [x[0] for x in options]==expected,(line,options)
        section=self.section;common=self.id(section,'_'+code+'_COMMON');choices=[]
        for letter,(value,label,_,_) in zip('ABCD',options):
            choices.append(self.option(letter,label,self.id(section,'_'+code+'_'+value),[core.flag(SP[code],value)],preview=self.previews(code,value) if code!='F5' else None))
        self.question(self.rows[line].split('｜',1)[1].rstrip('】'),line,choices);image=self.held
        for value,label,n,responses in options:
            self.start(section,'_'+code+'_'+value,image)
            for n in responses:self.prose(n,text=self.rows[n].strip().removeprefix('- ').strip())
            if code=='F5':
                effects=[core.flag(SF5,True),core.flag(SGRANT,value!='C')]
                if value!='C':effects.insert(0,dict(type='clear',key='finley',delta=1))
                self.node['completionEffects']=dict(when=core.eq(SF5,False),effects=effects);self.node['scoring']='STORY_EFFECTS'
            self.finish(next=common)
        self.start(section,'_'+code+'_COMMON',image)
        return cursor

    def ending(self):
        self.node.setdefault('completionFlags',{}).update({declare('EP08_'+self.route+'_ACT05_EASTERN_REPORT_RECEIVED'):True})
        self.finish(kind='end',completion=dict(title='第八章完 · '+TITLES[self.route],scope='CHAPTER',nextChapterId='EP09',pendingLabel='第九章 · 敬請期待',policy='NO_SCORING'))

    def sacred(self):
        self.start(1);self.block(28,134);self.finish(next=self.id(2))
        self.start(2);self.block(141,201);self.finish(next=self.id(3))
        self.start(3);self.block(208,209)
        for i,(key,first,last) in enumerate([('A',212,213),('B',215,216),('C',218,219),('D',221,222)]):
            self.cue(str(10+i),first,core.eq(SP['P01'],key));self.block(first,last,core.eq(SP['P01'],key))
        self.block(224,276);self.finish(next=self.id(4))
        self.start(4);self.block(283,333)
        for value,line in [('LIMIT',335),('BOUND',336),('EXPAND',337)]:
            row=self.rows[line].split('：',1)[1];self.prose(line,core.eq(SP['P02'],value),row)
        self.block(339,383);self.finish(next=self.id(5))
        self.start(5);self.block(390,410)
        common=self.id(5,'_RESULT_COMMON')
        for tier,(first,last) in enumerate([(414,419),(421,425),(427,431),(433,438),(440,445),(447,452),(454,465)]):
            if tier==0:self.finish(next=self.id(5,'_RESULT_CHECK_0'))
            self.start(5,'_RESULT_CHECK_'+str(tier),'21');target=self.id(5,'_RESULT_T'+str(tier))
            self.finish(next=self.id(5,'_RESULT_CHECK_'+str(tier+1)),conditionalNext=dict(when=tier_condition(tier),next=target)) if tier<6 else self.finish(next=target)
            self.start(5,'_RESULT_T'+str(tier),str(22+tier));self.block(first,last)
            row=next(x for x in MATRIX if x['tier']==tier)
            self.node['completionEffects']=dict(when=core.eq(SDONE,False),effects=[core.points(row['political_delta']),dict(type='unrest',delta=row['unrest_delta'],clamp=True),core.flag(SDONE,True),core.flag(TIER,tier),core.flag(declare('EP08_SACRED_ACT05_NO_SIGNED_AGREEMENT'),True)])
            self.node['scoring']='STORY_EFFECTS';self.finish(next=common)
        self.start(5,'_RESULT_COMMON','29');self.block(468,489);self.ending()

    def world_policy(self,code,line,ranges,flag,values):
        section=self.section;suffix=self.context+'_'+code;common=self.id(section,suffix+'_COMMON')
        options=[]
        for key,(first,last),value in zip('AB',ranges,values):
            label=re.search(r'：「([^」]+)」',self.rows[first])[1];options.append(self.option(key,'「'+label+'」',self.id(section,suffix+'_'+key),[core.flag(flag,value)]))
        self.question(self.rows[line].split('｜',1)[1].rstrip('】'),line,options);image=self.held
        for key,(first,last) in zip('AB',ranges):
            self.start(section,suffix+'_'+key,image);self.block(first+1,last);self.finish(next=common)
        self.start(section,suffix+'_COMMON',image)

    def world(self):
        for section,first,last in [(1,15,107),(2,112,198)]:self.start(section);self.block(first,last);self.finish(next=self.id(section+1))
        self.start(3);self.block(203,228)
        self.question('是否批准調查艾莉西亞？',229,[self.option(key,label,self.id(3,'_F5_'+key),[core.flag(WF5,key),core.flag(WAPPROVED,key=='A'),core.flag(WCOMPLETE,key=='A')]) for key,label in [('A','去吧。先確認消息來源，其他事情等有結果再談。'),('B','先不要展開新的調查。眼前還有其他事情需要處理。')]])
        for key,first,last,context in [('A',234,258,'_AUTEDAN'),('B',261,280,'_ACADEMY')]:
            self.start(3,'_F5_'+key,'05');self.block(first,last);self.finish(next=self.id(4,context))
        self.context='_AUTEDAN';self.start(4,self.context);self.block(288,358);self.finish(next=self.id(5,self.context))
        self.start(5,self.context);self.block(363,392);self.world_policy('INVESTOR',393,[(394,397),(398,401)],WCONTACT,['ROYAL_INVITATION','PRIVATE_APPROACH']);self.block(403,424);self.finish(next=self.id(6))
        self.context='_ACADEMY';self.start(4,self.context);self.block(434,490);self.finish(next=self.id(5,self.context))
        self.start(5,self.context);self.block(495,538);self.world_policy('SEAL',539,[(540,544),(545,549)],WSEAL,['LIMITED_RESEARCH','PRESERVE']);self.block(551,574);self.finish(next=self.id(6))
        self.context='';self.start(6);self.block(582,585)
        self.prose(586,core.eq(WF5,'A'),self.rows[586].split('：',1)[1]);self.prose(587,core.eq(WF5,'B'),self.rows[587].split('：',1)[1]);self.block(588,610)
        self.node.setdefault('completionFlags',{}).update({declare('EP08_WORLD_ACT05_'+key):value for key,value in {'ICE_EYE_MANIFESTED':False,'ELIA_RETURNED':False,'ACADEMY_REPUTATION_PARTIALLY_RESTORED':True,'ACADEMY_SEATS_AUTO_INCREASED':False}.items()})
        self.ending()

def main():
    for route in TITLES:
        act=Act(route);act.sacred() if route=='SACRED' else act.world()
    assert len({s['id'] for s in SCENES})==len(SCENES)
    used={s.get('cg') for s in SCENES}|{p.get('cg') for s in SCENES for p in s['segments']}|{p['cg'] for s in SCENES for p in s.get('cgWhen',[])};assert not {a['id'] for a in ASSETS}-used
    path=ROOT/'content/episodes/ep08/chapter.json';pack=core.read(path);prior=[s for s in pack['scenes'] if s['act']!='ACT05']
    for s in prior:
        if s['act']=='ACT04' and s.get('completion'):
            route='SACRED' if '_S_' in s['id'] else 'WORLD';end=s['completion'];end.pop('pendingLabel',None);end.update(nextSceneId=f'EP08_ACT05_SC01_{route[0]}',nextChapterId='EP08',continueLabel='進入第五幕',nextLabel='第五幕〈'+TITLES[route]+'〉')
    pack.update(version='1.5.0',source='使用者提供第八章完整兩條獨立世界線逐字稿與原圖。',scenes=prior+SCENES);core.write(path,pack)
    path=ROOT/'content/manifests/story.json';manifest=core.read(path);manifest['version']='0.24.0-ep08-act05';manifest['flags'].update(FLAGS);core.write(path,manifest)
    path=ROOT/'content/manifests/assets.json';core.write(path,[a for a in core.read(path) if not a['id'].startswith('EP08-ACT05-')]+ASSETS)
    path=ROOT/'content/characters/index.json';characters=core.read(path)
    for ident,name in core.ROLES.values():characters.setdefault(ident,name)
    core.write(path,characters)
    print(len(SCENES),'nodes',sum(len(s['segments']) for s in SCENES),'segments',sum(len(s['choices']) for s in SCENES),'answers',len(ASSETS),'CGs')
    if (ROOT/'content/episodes/ep09/chapter.json').exists():
        import subprocess,sys
        subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/import-ep09-act01.py')],check=True)
if __name__=='__main__':main()
