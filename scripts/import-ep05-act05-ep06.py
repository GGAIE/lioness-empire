"""Import supplied EP05 finale and EP06 ACT01/02, preserving original scripts and PNGs."""
from pathlib import Path
import json,re,hashlib,zipfile,struct,itertools
ROOT=Path(__file__).resolve().parent.parent
DOWNLOAD=Path('C:/Users/45P/Downloads')
def load(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
def write(p,x):
    p=ROOT/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def digest(b):return hashlib.sha256(b).hexdigest()
for name,expected in load('content/sources/ep06/import-source-lock.json').items():
    if digest((ROOT/name).read_bytes())!=expected:raise ValueError('Source changed; review exact gates and CG anchors: '+name)
p5=next((ROOT/'content/sources/ep05/act05').glob('01*'))
p61=next((ROOT/'content/sources/ep06/act01').glob('Lioness*md'))
p62=ROOT/'content/sources/ep06/act02/01_完整劇情_含分支.md'
pdyn=ROOT/'content/sources/ep06/act02/02_動態對話分支.md'
sources={'5-5':p5,'6-1':p61,'6-2':p62}
rows={k:list(enumerate(p.read_text(encoding='utf-8').splitlines(),1)) for k,p in sources.items()}
rows['dynamic']=list(enumerate(pdyn.read_text(encoding='utf-8').splitlines(),1))
imagepacks={'5-5':'LE_EP05_ACT05_23CG_final_v1.0.zip','6-1':'LE_EP06_ACT01_23CG_Final_v1.0.zip','6-2':'LE_EP06_ACT02_25CG_Final_v1.0.zip'}
assets=[];cgmap={};audits=[]
for k,name in imagepacks.items():
    ep,act=map(int,k.split('-'));path=DOWNLOAD/name;data=path.read_bytes();audit=dict(archive=str(path),archiveSha256=digest(data),images=[],sourceSha256=digest(sources[k].read_bytes()))
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.is_dir():continue
            filename=info.filename
            if Path(filename).name!=filename:raise ValueError('Unsafe archive path')
            m=re.fullmatch(r'LE_(?:CG_EP05_ACT05_|EP06_ACT0[12]_CG)(\d{2}[AB]?)(?:_v1\.0)?\.png',filename)
            if not m:raise ValueError('Unexpected asset '+filename)
            key=m[1];raw=z.read(info)
            if raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[-8:-4]!=b'IEND':raise ValueError('Incomplete PNG')
            width,height=struct.unpack_from('>II',raw,16)
            ident=f'EP{ep:02}-ACT{act:02}-CG{key}';cgmap[k,key]=ident
            dest=f'assets/cg/ep{ep:02}/act{act:02}/{filename}'
            out=ROOT/dest;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(raw)
            audit['images'].append(dict(id=ident,entry=filename,path=dest,bytes=len(raw),width=width,height=height,sha256=digest(raw)))
            title=None
            for _,line in rows[k]:
                mm=re.search(r'(?:LE_CG_EP05_ACT05_|CG-?)(\d{2}[AB]?)[｜](.+?)(?:】|$)',line)
                if mm and mm[1]==key:title=mm[2];break
            assets.append(dict(id=ident,type='cg',src=dest,label=(title or f'第{key}幅插圖').replace('Act01 收尾','未完的日常'),status='APPROVED',source=f'使用者提供 {name} 原始PNG；CRC／SHA256／尺寸見 sources/ep{ep:02}/act{act:02}/asset-audit.json。正文保留DRAFT。'))
    if len(audit['images'])!={'5-5':23,'6-1':23,'6-2':25}[k]:raise ValueError('Wrong image count')
    audit['images'].sort(key=lambda a:a['id']);audits.append(audit)
    write(f'content/sources/ep{ep:02}/act{act:02}/asset-audit.json',audit)

flag=lambda k,v:dict(type='flag',key=k,value=v)
cond=lambda k,v:dict(path='flags.'+k,op='eq',value=v)
allof=lambda *xs:dict(all=list(xs))
anyof=lambda *xs:dict(any=list(xs))
neg=lambda x:dict(not_=x) # use explicit not below (reserved Python word)
notof=lambda x:{'not':x}
points=lambda v:dict(type='points',delta=v)
unrest=lambda v:dict(type='unrest',delta=v,clamp=True)
TRANSFER='ROUENNE_TRANSFER_APPROVED';D1='EP06_ACT01_DECISION';CH=[f'EP06_ACT02_CH{i:02}' for i in (1,2,3)]
combo=lambda s:allof(*(cond(k,v) for k,v in zip(CH,s)))
AAA=combo('AAA');BBB=combo('BBB');CCC=combo('CCC');OTHERS=notof(anyof(AAA,BBB,CCC))
TYES=cond(TRANSFER,True);TNO=cond(TRANSFER,False)
# Verified script-line conditions, protected by the source SHA lock above.
gates={'5-5':[(337,347,TYES),(348,358,TNO),(396,401,TYES),(403,408,TNO)],'6-1':[(159,172,TYES),(173,198,TNO)],'6-2':[(615,628,BBB),(629,638,AAA),(639,648,CCC),(649,656,OTHERS),(721,740,CCC),(741,772,notof(CCC)),(755,762,AAA),(763,770,BBB)]}
for i in range(3):
    for j,v in enumerate('ABC'):gates['6-2'].append((699+i*6+j*2,700+i*6+j*2,cond(CH[i],v)))
# EP06 ACT01 has storyboard prompts after the script, so bind each to an exact body line.
anchor_texts={'01':'清晨，王宮東北塔一樓。','02':'塔馬拉走了進來，','03':'**奧莉薇雅：**「這叫平面辦公精神。」','04A':'**塔馬拉：**「有沒有意思我不知道。不過至少莎莉亞願意接手','04B':'塔馬拉聽完，立刻露出一言難盡','05':'莉姆斯走進房內。','06':'莉姆斯取出一封封緘文件','07':'**奧莉薇雅：**「這麼大的領主需要支援？怪了。」','08':'她把信放到茶几上，','09':'奧莉薇雅離開了她那張舒服的沙發','10':'**米椰爾：**「哎呀？','11':'**米椰爾：**「沒什麼。只是卡巴岡德','12':'米椰爾沿著另一側迴廊離開','13':'芬利已經在桌邊等候。','14':'**奧莉薇雅：**「芬利，今天有兩件麻煩事。','15':'**芬利：**「我認為，她大概正在準備回奧特丹','16':'**芬利：**「卡巴岡德的地域影響力不小。','17':'芬利沒有反駁。','18':'會談結束後，奧莉薇雅剛走出內務','19':'**艾拉：**「對他們來說，確實不會。','20':'兩人一邊說，一邊往側廊','21':'說完，她轉身登上馬車。','22':'奧莉薇雅站在原地，看著車輪'}
anchors={}
for image,text in anchor_texts.items():
    hits=[n for n,t in rows['6-1'][:680] if t.startswith(text)]
    if len(hits)!=1:raise ValueError('Ambiguous CG anchor '+image)
    anchors[hits[0]]=image
voices={'奧莉維亞':'OLIVIA','奧莉薇雅':'OLIVIA','芬利':'FINLEY','艾拉':'ELLA','塔馬拉':'TAMARA','莎莉亞':'SHALIA','莎莉雅':'SHALIA','米椰爾':'MIEL','米耶爾':'MIEL','莉姆斯':'RIMUS','艾琳達':'ALINDA','侍從':'COURT_ATTENDANT','魔法守衛':'MAGIC_GUARD','路恩代表':'RUENNE_EXILE_DELEGATE','第二團文書':'SECOND_ORDER_CLERK','店員':'TAVERN_CLERK','地方書記':'RELIEF_LOCAL_SCRIBE','教會醫療人員':'CHURCH_MEDIC','婦人':'DISPLACED_WOMAN'}
labels={v:k for k,v in voices.items()};labels.update(OLIVIA='奧莉維亞',SHALIA='莎莉亞',MIEL='米耶爾')
scenes=[];uses=[];directions=[];edits=[]
class Reader:
    def __init__(self,k,number,title,initial,pov='OLIVIA'):
        self.k=k;self.ep,self.act=map(int,k.split('-'));self.number=number;self.title=title;self.base=f'EP{self.ep:02}_ACT{self.act:02}_SC{number:02}';self.held=cgmap[k,initial];self.carry={};self.pending=None;self.pov=pov;self.current=self.make('')
    def make(self,suffix):
        return dict(id=self.base+suffix,chapter=f'EP{self.ep:02}',act=f'ACT{self.act:02}',sceneNumber=self.number,title=self.title,pov=self.pov,cast=[self.pov],kind='narrative',status='DRAFT',playback='READER',scoring='NONE',source=str(sources[self.k].relative_to(ROOT/'content')).replace('\\','/'),version='1.2.0' if self.k=='6-2' else '1.0.0',planNodeId=f'EP{self.ep:02}_ACT{self.act:02}',knowledge=dict(knows=['僅本稿已呈現的觀察與對話。'],withheld=['未驗證身分、未履行承諾與未結案調查不提前定案。']),cg=self.held,cgWhen=list(self.carry.values()),presentation=dict(fit='contain',focusX=50,focusY=50,zoom=1,panX=0,fadeMs=700),segments=[],choices=[],directions=[])
    def gate(self,line):
        found=[c for a,b,c in gates[self.k] if a<=line<=b]
        return found[0] if len(found)==1 else allof(*found) if found else None
    def cue(self,key,gate=None,line=0):
        self.hold();image=cgmap[self.k,key];self.pending=(image,gate,line)
        if gate:self.carry[json.dumps(gate,sort_keys=True)]=dict(when=gate,cg=image)
        else:self.held=image;self.carry={}
    def append(self,text,line,speaker=None,kind='narration',gate=None,label=None,origin='BODY'):
        if self.pending and self.pending[1]!=gate:self.hold()
        seg=dict(id=f'L{len(self.current["segments"])+1:03}',text=text,kind=kind,visual='SCENE')
        if speaker:
            seg.update(speaker=speaker,speakerLabel=label or labels[speaker])
            if speaker not in self.current['cast']:self.current['cast'].append(speaker)
        if gate:seg['when']=gate
        if self.pending:seg['cg']=self.pending[0];self.pending=None
        self.current['segments'].append(seg);uses.append(dict(sceneId=self.current['id'],segmentId=seg['id'],line=line,source='dynamic' if origin=='DYNAMIC' else self.k,origin=origin))
    def hold(self):
        if self.pending:
            image,gate,line=self.pending;self.pending=None
            self.append('…',line,kind='caption',gate=gate,origin='SOURCE_CG_HOLD');self.current['segments'][-1]['cg']=image
    def note(self,line,text):self.current['directions'].append(dict(beforeSegment=len(self.current['segments']),cue='來源製作註記',text=text));directions.append(dict(act=self.k,line=line,text=text))
    def push(self,line,text,extra=None,origin='BODY'):
        gate=extra or self.gate(line);raw=text;text=text.strip().replace('**','')
        if not text or text=='---' or re.fullmatch(r'[＊*\s]+',text):return
        if text.startswith(('轉場：', '轉場:')):
            self.note(line, text)
            if self.pending:
                self.append(' ', line, kind='caption', gate=gate, origin='CG_TRANSITION')
            return
        if re.fullmatch(r'CUT TO BLACK[。.]?', text, re.IGNORECASE):
            if self.pending and self.current['segments']:
                previous = self.current['segments'][-1]
                image, image_gate, _ = self.pending
                if previous.get('when') == image_gate and 'cg' not in previous:
                    previous['cg'] = image
                    self.pending = None
            self.hold()
            self.append(' ', line, kind='caption', gate=gate, origin='BLACKOUT')
            self.current['segments'][-1]['visual'] = 'BLACK'
            return
        if self.k=='6-1' and line in anchors:self.cue(anchors[line],gate,line)
        m=re.match(r'^【(?:LE_CG_EP05_ACT05_|CG-)(\d{2})｜',text)
        if m:self.cue(m[1],gate,line);return
        m=re.match(r'^【([^】]+)】(.*)$',text) or re.match(r'^([^：]+)：(「.*)$',text)
        speaker=None;kind='narration';label=None
        if m:
            base=re.split('[（・／]',m[1])[0]
            if base in voices:
                speaker=voices[base];kind='thought' if '心聲' in m[1] else 'dialogue';label=labels[speaker]
                if kind=='thought':label+='（心聲）'
                elif '（' in m[1]:label+='（'+m[1].split('（',1)[1].rstrip('）')+'）'
                text=m[2]
            elif m[1]=='旁白':text=m[2]
            else:self.note(line,text);return
        if re.match(r'^(#|\||`|>|→|\{|\}|\*隱藏|[-*] (?:隱性|政治|不|T1|F2)|(?:地點|人物|功能|戲劇功能|時間|BGM|POV|選項|前台選項|SC03 結算|A1_CLEAR|A1_NOT_CLEAR|本章不選|ACT\d|EP\d|若|如果)|所有分支共用結束|按玩家三次|此處依三次)',text):self.note(line,text);return
        if text.startswith(('隱含結果：','動態後綴：')):self.note(line,text);return
        if not text:return
        old=text
        text=text.replace('EP05 那批貨運異常','先前那批貨運異常').replace('下一章的正式議程前','下一次正式議程前').replace('鏡頭慢慢拉遠。','')
        if old!=text:edits.append(dict(act=self.k,line=line,from_=old,to=text))
        self.append(text,line,speaker,kind,gate,label,origin)
    def body(self,start,end):
        for line,text in rows[self.k][start-1:end]:self.push(line,text)
    def link(self,target):
        self.hold();self.current['next']=target;scenes.append(self.current)
    def switch(self,suffix):self.hold();self.current=self.make(suffix)
    def question(self,prompt,options):
        self.hold();self.append(prompt,0,origin='CHOICE_PROMPT');self.current['segments'][-1]['speakerLabel']='選擇'
        self.current.update(kind='choice',pov='OLIVIA',choiceMode='STORY',scoring='STORY_EFFECTS',choices=options)
        if self.act==1:self.current['planDecisionOverride']=dict(source=self.current['source'],reason='使用者新提供的第一幕逐字稿明列有效選擇，覆寫早期開場無選項規劃。')
        scenes.append(self.current)
    def finish(self):
        self.hold()
        if self.number<5:self.link(f'EP{self.ep:02}_ACT{self.act:02}_SC{self.number+1:02}');return
        self.current['kind']='end'
        scope='CHAPTER' if self.k=='5-5' else 'ACT'
        target='EP06_ACT01_SC01' if self.k=='5-5' else 'EP06_ACT02_SC01' if self.k=='6-1' else None
        self.current['completion']=dict(title={'5-5':'第五章完 · 庇護的代價','6-1':'第一幕完 · 東北塔的一天','6-2':'第二幕完 · 伸向卡巴岡德的手'}[self.k],scope=scope,nextChapterId='EP06',policy='NO_SCORING')
        if target:self.current['completion'].update(nextSceneId=target,nextLabel='第六章〈兩份攝政令〉' if self.k=='5-5' else '第二幕〈伸向卡巴岡德的手〉',continueLabel='進入第六章' if self.k=='5-5' else '進入第二幕')
        else:self.current['completion']['pendingLabel']='第三幕〈盤根錯節〉· 敬請期待'
        scenes.append(self.current)

def section_titles(k,cut):return [(int(m[1]),m[2]) for n,t in rows[k][:cut-1] if (m:=re.match(r'^#{1,2} SC(\d\d)〈(.+)〉',t))]
def bounds(k,cut):
    heads=[n for n,t in rows[k][:cut-1] if re.match(r'^#{1,2} SC\d\d〈',t)]
    return [(a+1,b-1) for a,b in zip(heads,heads[1:]+[cut])]
success=[flag('T1_STATUS','SUCCESS'),flag('S1_STATUS','SUCCESS'),flag(TRANSFER,True),flag('T1_S1_RESOLVED',True)]
failure=[flag('T1_STATUS','FAILED'),flag('S1_STATUS','FAILED'),flag(TRANSFER,False),flag('T1_S1_RESOLVED',True)]
for (num,title),(start,end),cg in zip(section_titles('5-5',439),bounds('5-5',439),['01','05','09','12','18']):
    r=Reader('5-5',num,title,cg)
    if num==4:
        r.body(start,247)
        r.question('奧莉維亞如何回應？',[dict(id='A',text='默認兩人的安排。',next=r.base+'_ACCEPT_DIRECT',effects=success),dict(id='B',text='提出質疑：「莎莉亞，妳為什麼願意接這個麻煩？」',next=r.base+'_QUESTION',effects=[])])
        r.switch('_QUESTION');r.body(259,270)
        r.question('聽完解釋後，奧莉維亞如何決定？',[dict(id='A',text='接受解釋，批准自願安置移交。',next=r.base+'_ACCEPT',effects=success),dict(id='B',text='仍然否決，不准第三團接手。',next=r.base+'_REJECT',effects=failure)])
        r.held=cgmap['5-5','13'];r.carry={};r.switch('_ACCEPT_DIRECT');r.body(253,255);r.link(r.base+'_ACCEPT')
        r.switch('_ACCEPT');r.body(276,307);r.link('EP05_ACT05_SC05')
        r.switch('_REJECT');r.body(309,end);r.link('EP05_ACT05_SC05')
    else:
        r.body(start,end)
        if num==1:r.current['completionFlags']={'TAMARA_TEMP_HOUSING':True}
        if num==2:r.current['completionFlags']={'F2_LEDGER_ANOMALY_FOUND':True,'F2_INVESTIGATION_PENDING':True}
        r.finish()
for (num,title),(start,end),cg in zip(section_titles('6-1',681),bounds('6-1',681),['01','05','09','13','18']):
    r=Reader('6-1',num,title,cg)
    if num==4:
        r.body(start,549)
        choices=[]
        for i,line in enumerate([554,558,562,566,570]):
            text=re.search('「.+」',rows['6-1'][line-1][1])[0]
            choices.append(dict(id=str(i+1),text=text,next=r.base+'_COMMON',effects=[points([5,-1,-2,-3,-5][i]),flag(D1,str(i+1))]))
        r.question('奧莉維亞接下來要怎麼做？',choices);r.switch('_COMMON');r.body(574,end);r.finish()
    else:
        r.body(start,end)
        if num==5:r.current['completionFlags']={'ELLA_DEPARTED_FOR_AOTEDAN':True}
        r.finish()

balance=load('content/sources/ep06/act02/balance.json')
if balance['status']!='USER_CONFIRMED':raise ValueError('EP06 ACT02 numerical effects await user input')
ending_groups={f'E{i:02}':[] for i in range(1,12)}
def ending_for(s):
    if s=='AAA':return 'E01'
    if s=='CCC':return 'E02'
    if s=='BBB':return 'E03'
    positions=tuple(i for i,c in enumerate(s) if c=='B')
    if len(positions)==2:return {(0,1):'E04',(0,2):'E05',(1,2):'E06'}[positions]
    if len(positions)==1:return ['E07','E08','E09'][positions[0]]
    return 'E10' if s.count('A')==2 else 'E11'
for comb in itertools.product('ABC',repeat=3):
    s=''.join(comb);ending_groups[ending_for(s)].append(s)
for (num,title),(start,end),cg in zip(section_titles('6-2',845),bounds('6-2',845),['01','07','12','17','22']):
    r=Reader('6-2',num,title,cg,'ALINDA' if num==1 else 'OLIVIA')
    if num==4:
        r.body(start,426)
        for qi,(optrows,branches,merge,nextstart) in enumerate([([427,428,429],[(432,444),(446,466),(468,478)],479,493),([494,495,496],[(499,507),(509,529),(531,541)],542,556),([557,558,559],[(562,574),(576,600),(602,610)],611,612)]):
            qbase=r.base if qi==0 else r.base+f'_Q{qi+1}'
            opts=[]
            for j,letter in enumerate('ABC'):
                text=re.search('「.+」',rows['6-2'][optrows[j]-1][1])[0];b=balance['options'][letter];effects=[flag(CH[qi],letter)]
                if b['points']:effects.append(points(b['points']))
                if b['unrest']:effects.append(unrest(b['unrest']))
                if letter=='B':effects.append(flag(['B1_FINLEY','B2_SHALIA','B3_OFFICIALS'][qi],True))
                opts.append(dict(id=letter,text=text,next=r.base+f'_C{qi+1}_{letter}',effects=effects))
            r.question(['如何安排緊急人力、搬運與道路安全？','如何安排難民住所、土地與生計？','如何安排長期工程與行政？'][qi],opts)
            common=r.base+f'_Q{qi+2}' if qi<2 else r.base+'_COMMON'
            baseline=r.held
            for letter,(a,b) in zip('ABC',branches):
                r.held=baseline;r.switch(f'_C{qi+1}_{letter}');r.body(a,b);r.link(common)
            r.held=baseline;r.switch(f'_Q{qi+2}' if qi<2 else '_COMMON');r.body(merge,nextstart)
        r.body(613,end);r.finish()
    elif num==5:
        for line,text in rows['6-2'][start-1:end]:
            if 699<=line<=715 and line%2==1:
                body=text.replace('**','').split('：',1)[1].strip().replace('魔法守衛形態與既有美術資產一致。','')
                r.push(line,body);continue
            if line==813:
                r.cue('24',line=line)
                heads=[(n,m[1]) for n,t in rows['dynamic'] if (m:=re.match(r'^## 結尾 (E\d\d)',t))]
                for (a,eid),b in zip(heads,[n for n,_ in heads[1:]]+[270]):
                    group=anyof(*(combo(s) for s in ending_groups[eid]));sub=None
                    for n,t in rows['dynamic'][a:b-1]:
                        m=re.match(r'\*\*若第([一二三])項是 ([AC])',t)
                        if m:sub=cond(CH['一二三'.index(m[1])],m[2]);continue
                        if t.startswith('**動態後綴'):
                            for idx in range(3):
                                if all(s[idx]=='B' for s in ending_groups[eid]):continue
                                for value,phrase in [('A',['教會追加人手。','安置交由聖光會協助。','重建讓聖光會提出方案。'][idx]),('C',['第六團自行輪班。','安置仍待地方領主協商。','重建仍待進一步評估。'][idx])]:
                                    r.append('「'+phrase+'」',n,'OLIVIA','dialogue',allof(group,cond(CH[idx],value)),origin='DYNAMIC_SUFFIX')
                            continue
                        if eid=='E08' and '她最近不是忙著處理那批落魄貴族' in t:
                            r.push(n,t,allof(group,TYES),'DYNAMIC')
                            r.push(n,'**奧莉薇雅：**「對。她先前對安置那批落魄貴族很有興趣。」',allof(group,TNO),'DYNAMIC')
                            edits.append(dict(act='6-2',line=n,source='dynamic',reason='未批准移交時不稱莎莉亞已在處理安置。'))
                        else:r.push(n,t,allof(group,sub) if sub else group,'DYNAMIC')
                continue
            r.push(line,text)
        r.current['settlements']=[dict(when=allof(cond('EP06_A1_RESOLVED',False),CCC),effects=[flag('A1_STATUS','FAILED'),flag('EP06_A1_RESOLVED',True)]),dict(when=allof(cond('EP06_A1_RESOLVED',False),notof(CCC)),effects=[flag('A1_STATUS','SUCCESS'),flag('EP06_A1_RESOLVED',True)])]
        r.current['scoring']='STORY_EFFECTS';r.finish()
    elif num==3:
        for line,text in rows['6-2'][start-1:end]:
            if 293<=line<=297:
                quotes=re.findall(r'「[^」]+」',text)
                if len(quotes)!=2:raise ValueError('Inline carry dialogue changed')
                for speaker,quote in zip(['RIMUS','OLIVIA'],quotes):r.append(quote,line,speaker,'dialogue',cond(D1,str(line-292)),origin='ACT01_CARRY')
            else:r.push(line,text)
        r.current['completionFlags']={'EP06_DISASTER_PERSONALLY_INSPECTED':True};r.finish()
    else:r.body(start,end);r.finish()

manifest=load('content/manifests/story.json');characters=load('content/characters/index.json');oldassets=load('content/manifests/assets.json')
defs={'TAMARA_TEMP_HOUSING':False,'F2_LEDGER_ANOMALY_FOUND':False,'F2_INVESTIGATION_PENDING':False,'T1_STATUS':'PENDING','S1_STATUS':'PENDING',TRANSFER:False,'T1_S1_RESOLVED':False,D1:'UNSET','ELLA_DEPARTED_FOR_AOTEDAN':False,**{k:'UNSET' for k in CH},'B1_FINLEY':False,'B2_SHALIA':False,'B3_OFFICIALS':False,'A1_STATUS':'PENDING','EP06_A1_RESOLVED':False,'EP06_DISASTER_PERSONALLY_INSPECTED':False}
for k,v in defs.items():manifest['flags'][k]=dict(initial=v,description='2026-11-06 使用者逐字劇本與明定選項效果；任務成敗不自動增加未授權CLEAR或鎖定政治路線。')
ep06_path=ROOT/'content/episodes/ep06/chapter.json'
existing_ep06=load('content/episodes/ep06/chapter.json') if ep06_path.exists() else {}
later_acts=[s for s in existing_ep06.get('scenes',[]) if s['act'] in ('ACT03','ACT04','ACT05')]
if not later_acts:manifest['version']='0.14.2-reader-staging'
next(c for c in manifest['chapters'] if c['id']=='EP06').update(status='DRAFT_AVAILABLE',file='episodes/ep06/chapter.json',entry='EP06_ACT01_SC01')
p5chapter=load('content/episodes/ep05/chapter.json');p5chapter['scenes']=[s for s in p5chapter['scenes'] if s['act']!='ACT05']+[s for s in scenes if s['chapter']=='EP05']
previous=next(s for s in p5chapter['scenes'] if s['act']=='ACT04' and s.get('completion'))
previous['completion'].pop('pendingLabel',None);previous['completion'].update(nextSceneId='EP05_ACT05_SC01',continueLabel='進入第五幕',nextLabel='第五幕〈庇護的代價〉')
p5chapter['version']='1.1.0';p5chapter['source']=p5chapter['source'].split('；ACT05')[0].split('。ACT05未提供')[0]+'；ACT05 v1.0已接入，完成第五章並接續EP06。'
write('content/episodes/ep05/chapter.json',p5chapter)
ep06_scenes=[s for s in scenes if s['chapter']=='EP06']
if later_acts:
    previous_end=next(s['completion'] for s in existing_ep06['scenes'] if s['act']=='ACT02' and 'completion' in s)
    next(s for s in ep06_scenes if s['act']=='ACT02' and 'completion' in s)['completion']=previous_end
    existing_ep06['scenes']=ep06_scenes+later_acts
else:
    existing_ep06=dict(schemaVersion=1,id='EP06',status='DRAFT',version='1.2.0',source='使用者EP06 ACT01 v1.0、ACT02 v1.2完整劇本與原圖；第二幕數值由使用者2026-11-06在本聊天指定。ACT03尚未提供。',scenes=ep06_scenes)
write('content/episodes/ep06/chapter.json',existing_ep06)
characters.update(labels);write('content/characters/index.json',characters)
write('content/manifests/story.json',manifest)
write('content/manifests/assets.json',[a for a in oldassets if not a['id'].startswith(('EP05-ACT05-','EP06-ACT01-','EP06-ACT02-'))]+assets)
write('docs/ep05-finale-ep06-import-report.json',dict(nodes=len(scenes),segments=sum(len(s['segments']) for s in scenes),choices=sum(s['kind']=='choice' for s in scenes),answers=sum(len(s['choices']) for s in scenes),images=len(assets),uses=uses,directions=directions,readerEdits=edits,anchors=[dict(line=n,image=cgmap['6-1',im],text=rows['6-1'][n-1][1]) for n,im in anchors.items()],dynamicEndings=ending_groups,balance=balance,clear='T1/S1/A1 status recorded once; no unspecified numeric CLEAR awarded'))
print(json.dumps(dict(nodes=len(scenes),images=len(assets),choices=sum(s['kind']=='choice' for s in scenes)),ensure_ascii=False))
