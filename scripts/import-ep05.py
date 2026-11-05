"""Import the user's EP05 sources without executing anything in the archives."""
from pathlib import Path
import json, re, zipfile, hashlib, csv, struct, zlib, binascii
ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path('C:/Users/45P/Downloads/ep5')
def write(path, value):
    p=ROOT/path; p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def read(path): return json.loads((ROOT/path).read_text(encoding='utf-8'))
def sha(b):return hashlib.sha256(b).hexdigest()
# Retain original script and production notes, but never run packaged commands.
for archive in SOURCE.glob('*.zip'):
    if '完整' not in archive.name and not archive.name.startswith('%'):continue
    act=int(archive.name.split('ACT')[1][:2]);folder=ROOT/f'content/sources/ep05/act{act:02}'
    folder.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            if item.is_dir():continue
            if Path(item.filename).name != item.filename:raise ValueError('Unexpected source path')
            (folder/item.filename).write_bytes(z.read(item))
    write(f'content/sources/ep05/act{act:02}/archive-source.json',dict(path=str(archive),sha256=sha(archive.read_bytes())))
source_lock=read('content/sources/ep05/import-source-lock.json')
for act in range(1,5):
    source=next((ROOT/f'content/sources/ep05/act{act:02}').glob('01*'))
    if sha(source.read_bytes())!=source_lock[str(act)]:raise ValueError('Script version changed; review exact line gates before importing ACT'+str(act))
assets=[];audits=[];cgmap={};roles={}
for act in range(1,5):
    folder=ROOT/f'content/sources/ep05/act{act:02}'
    table=list(csv.DictReader(next(folder.glob('*CG*csv')).read_text(encoding='utf-8-sig').splitlines()))
    archive=next(p for p in SOURCE.glob('*.zip') if f'ACT{act:02}' in p.name and ('CG_v0.2' in p.name or '正確圖片包' in p.name or 'verified' in p.name))
    data=archive.read_bytes();files={};partial=[]
    try:
        with zipfile.ZipFile(archive) as z:
            for item in z.infolist():
                if item.filename.lower().endswith('.png'):files[Path(item.filename).name]=z.read(item)
    except zipfile.BadZipFile:
        # Only recover complete local entries with matching compressed length, CRC and PNG IEND.
        if act!=4:raise
        pos=0
        while data[pos:pos+4]==b'PK\x03\x04':
            _,v,flags,method,t,d,crc,cs,us,nl,el=struct.unpack_from('<4s5H3I2H',data,pos)
            if flags & 8:raise ValueError('Unsupported recovery descriptor')
            name=data[pos+30:pos+30+nl].decode('utf-8');start=pos+30+nl+el
            compressed=data[start:start+cs]
            if len(compressed)!=cs:
                partial.append(dict(entry=name,expectedCompressedBytes=cs,availableCompressedBytes=len(compressed)));break
            raw=zlib.decompress(compressed,-15) if method==8 else compressed
            if len(raw)!=us or binascii.crc32(raw)!=crc:raise ValueError('Recovery CRC mismatch')
            if Path(name).name!=name:raise ValueError('Unsafe recovered name')
            files[name]=raw;pos=start+cs
    supplements=[];file_sources={name:str(archive) for name in files};superseded_partial=[]
    supplement_file=folder/'supplement-archives.json'
    if act==4 and supplement_file.exists():
        supplements=json.loads(supplement_file.read_text(encoding='utf-8'))
        supplement_names=set()
        for item in supplements:
            supplement=Path(item['path']);raw_archive=supplement.read_bytes()
            if sha(raw_archive)!=item['sha256']:raise ValueError('Supplement archive changed')
            with zipfile.ZipFile(supplement) as z:
                for info in z.infolist():
                    if info.is_dir():continue
                    name=info.filename
                    if not re.fullmatch(r'LE_CG_EP05_ACT04_\d{2}\.png',name) or name in supplement_names:raise ValueError('Unexpected supplemental entry '+name)
                    supplement_names.add(name);files[name]=z.read(info);file_sources[name]=str(supplement)
        if supplement_names!={f'LE_CG_EP05_ACT04_{i:02}.png' for i in range(1,24)}:raise ValueError('Incomplete supplemental set')
        superseded_partial=partial;partial=[]
    audit=dict(archive=str(archive),archiveSha256=sha(data),supplements=supplements,supersededPartial=superseded_partial,partial=partial,images=[],missing=[])
    for n,row in enumerate(table):
        key=(f'CG{n+1:02}' if act==1 else row.get('CG_ID') if act==2 else f'CG{n+1:02}')
        if act==1:
            key=['CG'+f'{i:02}' for i in range(1,18)]+['CG18-K','CG18-R','CG19','CG20']
            key=key[n];prefix=row['cg_id']
            matches=[f for f in files if f.startswith(prefix+'_v')]
        else:
            expected=row.get('TARGET_ASSET') or row.get('filename') or f'LE_CG_EP05_ACT04_{n+1:02}.png'
            matches=[f for f in files if f==expected]
        ident=f'EP05-ACT{act:02}-{key}';cgmap[act,key]=ident
        title=row.get('TITLE') or row.get('title_zh') or row.get('title') or key
        if len(matches)==1:
            name=matches[0];raw=files[name]
            if raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[-12:-8]!=b'\x00\x00\x00\x00' or raw[-8:-4]!=b'IEND':raise ValueError('Incomplete PNG '+name)
            dest=f'assets/cg/ep05/act{act:02}/{name}';(ROOT/dest).parent.mkdir(parents=True,exist_ok=True);(ROOT/dest).write_bytes(raw)
            width,height=struct.unpack_from('>II',raw,16)
            audit['images'].append(dict(id=ident,entry=name,archive=file_sources[name],path=dest,bytes=len(raw),sha256=sha(raw),width=width,height=height))
            status='APPROVED'
        else:
            if act!=4 or key!='CG23':raise ValueError('Missing or ambiguous image '+ident)
            dest='assets/placeholders/ep05-act04-cg23.svg';(ROOT/dest).parent.mkdir(parents=True,exist_ok=True)
            (ROOT/dest).write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941" viewBox="0 0 1672 941"><rect width="1672" height="941" fill="#111c29"/><text x="836" y="470" fill="#c8af7b" text-anchor="middle" font-size="32" font-family="sans-serif">插圖待補</text></svg>',encoding='utf-8')
            audit['missing'].append(dict(id=ident,reason='Supplied ZIP truncated inside final PNG; incomplete bytes not published'))
            status='PLACEHOLDER'
        assets.append(dict(id=ident,type='cg',src=dest,label=title,status=status,source=f'使用者提供EP05 ACT{act:02}圖片；原PNG與CRC／SHA256見sources/ep05/act{act:02}/asset-audit.json。素材可用不代表DRAFT正文升格。' if status=='APPROVED' else '原包最後一張截斷，待使用者補原圖；不使用錯圖或生成替代品。'))
    audit['sourceSha256']=sha(next(folder.glob('01*')).read_bytes());audits.append(audit)
    write(f'content/sources/ep05/act{act:02}/asset-audit.json',audit)

flag=lambda k,v:dict(type='flag',key=k,value=v)
cond=lambda k,v:dict(path='flags.'+k,op='eq',value=v)
allof=lambda *a:dict(all=list(a))
anyof=lambda *a:dict(any=list(a))
points=lambda n:dict(type='points',delta=n)
unrest=lambda n:dict(type='unrest',delta=n,clamp=True)
ATT='EP05_UNION_ATTITUDE';PREP='EP05_PORT_PREP';METHOD='EP05_PORT_METHOD';REP='EP05_OSINM_REPRESENTATION';STAFF='EP05_ACT03_STAFF_SOURCE'
PORTDONE='EP05_PORT_POLITICAL_SETTLED';REPDONE='EP05_OSINM_REP_SETTLED';FUND='EP05_TAMARA_FAMILY_FUNDING_CONFIRMED'
portconditions=[cond(METHOD,'KEEP'),allof(cond(METHOD,'RIVER'),cond(ATT,'SOOTHE')),allof(cond(METHOD,'RIVER'),cond(ATT,'QUESTION'))]
portgroups=[dict(when=allof(cond(PORTDONE,False),c),effects=[points(p),flag('EP05_PORT_RELATION',r),flag(PORTDONE,True)]) for c,p,r in zip(portconditions,[0,15,-15],['RECONCILED','SOOTHED_WITH_ALTERNATIVE','WARY_AFTER_BYPASS'])]
repgroups=[dict(when=allof(cond(REPDONE,False),cond(REP,r)),effects=[points(p),unrest(u),flag(REPDONE,True)]) for r,p,u in [('YURIS_APPOINTED',-15,-10),('GRASS_APPOINTED',10,20),('PUBLIC_NOMINATION_PENDING',5,-10)]]
# Exact source line ranges, gated with the decisions named in the production package.
gates={1:[(360,367,cond(ATT,'SOOTHE')),(368,377,cond(ATT,'QUESTION')),(378,381,cond(PREP,'CONTACT_UNION')),(382,385,cond(PREP,'CHECK_CARRIERS'))],2:[(149,156,cond(ATT,'SOOTHE')),(157,164,cond(ATT,'QUESTION')),(165,170,cond(PREP,'CONTACT_UNION')),(171,176,cond(PREP,'CHECK_CARRIERS')),(325,328,cond(REP,'YURIS_APPOINTED')),(329,332,cond(REP,'GRASS_APPOINTED')),(333,338,cond(REP,'PUBLIC_NOMINATION_PENDING')),(343,351,cond(METHOD,'KEEP')),(352,365,cond(METHOD,'RIVER')),(358,360,cond(ATT,'SOOTHE')),(361,363,cond(ATT,'QUESTION')),(421,423,cond(REP,'YURIS_APPOINTED')),(424,426,cond(REP,'GRASS_APPOINTED')),(427,429,cond(REP,'PUBLIC_NOMINATION_PENDING'))],3:[(564,617,anyof(cond(STAFF,'PALACE'),cond(STAFF,'ELLA_REJECTED'))),(568,573,cond(STAFF,'PALACE')),(574,587,cond(STAFF,'ELLA_REJECTED')),(618,679,cond(STAFF,'TAMARA'))],4:[]}
voiceids={'奧莉維亞':'OLIVIA','芬利':'FINLEY','艾拉':'ELLA','格拉斯':'GRASS','侍從':'COURT_ATTENDANT','瑪蕾娜':'MARENA','尤里斯':'YURIS','米耶爾':'MIEL','塔馬拉':'TAMARA','塔瑪拉':'TAMARA','王宮官員 NPC':'PALACE_RELIEF_OFFICIAL','魔法守衛':'MAGIC_GUARD','流亡貴族代表':'RUENNE_EXILE_DELEGATE'}
roles={v:k for k,v in voiceids.items()};roles['TAMARA']='塔馬拉';roles['PALACE_RELIEF_OFFICIAL']='王宮官員'
titles={1:'陛下不見客',2:'七艘船',3:'苦難者的名字',4:'尚未結束的夜晚'}
cutoffs={1:'## ACT02 接續',2:'## 互動與劇情 QA',3:'# 分支與結算表',4:'## 無影響選項總表'}
trailing={1:[],2:[350,365],3:[123],4:[318]}
scenes=[];uses=[];omitted=[];edits=[]
for act in range(1,5):
    src=next((ROOT/f'content/sources/ep05/act{act:02}').glob('01*'))
    raw=src.read_text(encoding='utf-8');raw=raw[:raw.index(cutoffs[act])]
    rows=list(enumerate(raw.splitlines(),1));heads=[(i,int(m[1]),m[2]) for i,(ln,t) in enumerate(rows) if (m:=re.match(r'^#{1,2} SC(\d\d)〈(.+)〉$',t))]
    if len(heads)!=5:raise ValueError('Wrong scene count')
    def condition(ln):
        cs=[c for a,b,c in gates[act] if a<=ln<=b]
        return cs[0] if len(cs)==1 else allof(*cs) if cs else None
    for hi,(index,number,title) in enumerate(heads):
        base=f'EP05_ACT{act:02}_SC{number:02}';body=rows[index+1:heads[hi+1][0] if hi+1<len(heads) else len(rows)]
        first=next((re.search(r'(?:CG(\d\d(?:-[KR]|[ABCKR])?)|LE_CG_EP05_ACT0[34]_(\d\d))',t) for _,t in body if re.search(r'^(?:\*\*)?【?(?:CG\d|LE_CG_EP05_ACT)',t)),None)
        if not first:raise ValueError('Missing initial CG '+base)
        initial=cgmap[act,'CG'+(first[1] or first[2])]
        carry={}
        def make(suffix='',cg=initial):
            return dict(id=base+suffix,chapter='EP05',act=f'ACT{act:02}',sceneNumber=number,title=title,pov='OLIVIA',cast=['OLIVIA'],kind='narrative',status='DRAFT',playback='READER',scoring='NONE',source=str(src.relative_to(ROOT/'content')).replace('\\','/'),version='1.1.0' if act in (2,3) else '1.0.0',planNodeId=f'EP05_ACT{act:02}',knowledge=dict(knows=['僅逐字劇本已呈現的資訊。'],withheld=['不提前定案議會聯盟、政治罪名或流亡者身分。']),segments=[],choices=[],directions=[],cg=cg,cgWhen=list(carry.values()),presentation=dict(fit='contain',focusX=50,focusY=50,zoom=1,panX=0,fadeMs=700))
        current=make();held=initial;pending=None;choicecount=0
        def push(ln,t):
            global current,held,pending,carry
            t=t.strip().replace('**','')
            t=re.sub(r'^【(?:F\d\d .*?匯合[^】]*|共通匯合)】','',t).strip()
            m=re.match(r'^(?:【CG(\d\d(?:-[KR]|[ABCKR])?)｜|【?LE_CG_EP05_ACT0[34]_(\d\d))',t)
            if m:
                key='CG'+(m[1] or m[2]);image=cgmap[act,key];pending=image
                gate=condition(ln)
                if gate:carry[json.dumps(gate,sort_keys=True)]=dict(when=gate,cg=image)
                else:held=image;carry={}
                if ln in trailing[act]:
                    segment=dict(id=f'L{len(current["segments"])+1:03}',text='…',kind='caption',visual='SCENE',cg=image)
                    if gate:segment['when']=gate
                    current['segments'].append(segment);pending=None
                    uses.append(dict(act=act,sceneId=current['id'],segmentId=segment['id'],line=ln,original=t,origin='SOURCE_CG_HOLD'))
                current['directions'].append(dict(beforeSegment=len(current['segments']),cue='CG',text=key));return
            if not t or t=='---':return
            m=re.match(r'^【([^】]+)】(.*)$',t)
            if m and m[1] in ('旁白','共通旁白'):
                text=m[2];speaker=None;kind='narration';label=None
                if not text:return
            elif m and re.split('[・／]',m[1])[0] in voiceids:
                name=re.split('[・／]',m[1])[0];speaker=voiceids[name];kind='thought' if '心聲' in m[1] else 'dialogue';label=roles[speaker]+('（心聲）' if kind=='thought' else ('（'+m[1].split('・')[1]+'）' if '・' in m[1] else ''));text=m[2]
            else:
                if re.match(r'^(#|\||[-*] |[0-9A-C]\. |`|ID[： ]|時間|人物|POV|BGM|任務|Result|場景結果|若 |條件|分支條件|ACT0|政治 |玩家選擇|【(?:場景結果|結果註記|結算|轉場|ACT0))',t):
                    current['directions'].append(dict(beforeSegment=len(current['segments']),cue='來源製作註記',text=t));return
                if m and re.match(r'^(SC\d|F\d|A/C)',m[1]):return
                if m:raise ValueError(f'Unassigned tag {act}:{ln} {t}')
                # The script has one explicitly continued narrator paragraph.
                if act==4 and ln==219:text=t;speaker=None;kind='narration';label=None
                else:
                    omitted.append(dict(act=act,line=ln,text=t));return
            original=text
            text=text.replace('ACT02 的協商','之後的協商').replace('本幕卷宗','這次的卷宗')
            replacements={ (1,296):('ACT02 的河運核實','之後的河運核實'),(1,366):('ACT02 現場','抵達奧辛姆後在現場') }
            if (act,ln) in replacements:
                a,b=replacements[act,ln];text=text.replace(a,b)
            if original!=text:edits.append(dict(act=act,line=ln,original=original,text=text))
            seg=dict(id=f'L{len(current["segments"])+1:03}',text=text,kind=kind,visual='SCENE')
            if speaker:
                seg.update(speaker=speaker,speakerLabel=label)
                if speaker not in current['cast']:current['cast'].append(speaker)
            if pending:seg['cg']=pending;pending=None
            if condition(ln):seg['when']=condition(ln)
            current['segments'].append(seg);uses.append(dict(act=act,sceneId=current['id'],segmentId=seg['id'],line=ln,original=original))
        i=0
        while i<len(body):
            ln,t=body[i];clean=t.replace('**','').strip()
            if act==2 and ln==444:
                current['settlements']=portgroups+repgroups;current['scoring']='STORY_EFFECTS'
                current['completionFlags']={'EP05_ELLA_CARGO_STATUS':'DELIVERED_TO_AOTEDAN','EP05_OSINM_RESTORED':True}
                target=base+'_DELIVERY_CONFIRMED';current['next']=target;scenes.append(current);current=make('_DELIVERY_CONFIRMED',held)
            if re.match(r'^### 【(?:FLAVOR|CHOICE POINT|MAIN CHOICE)',t):
                choicecount+=1;flavor='FLAVOR' in t
                opts=[];j=i+1;merge=None
                overrides={(1,130):157,(1,273):298,(1,329):358,(2,240):310,(3,482):548}
                limit=overrides.get((act,ln))
                while j<len(body):
                    l,u=body[j];v=u.replace('**','').strip()
                    if (limit and l==limit) or (not limit and re.match(r'^【(?:F\d\d .*?(?:匯合)|共通匯合)',v)):
                        merge=j;break
                    m=re.match(r'^(?:(\d\d-[AB]|[ABC]|選項[一二三])｜|([1-3A-C])\.\s*)[「](.+)[」]',v)
                    if m:opts.append((j,m[1] or m[2],'「'+m[3]+'」'))
                    j+=1
                if merge is None or len(opts) not in (2,3):raise ValueError(f'Choice bounds {act}:{ln}: {opts}')
                if act==3 and number==5:
                    current['settlements']=[dict(when=allof(cond(STAFF,'TAMARA'),cond(FUND,False)),effects=[points(15),flag(FUND,True)])]
                    current['completionFlags']={'EP05_STAFF_DELIVERED':True,'EP05_CHURCH_FUNDING_UNRESOLVED':True}
                    current['scoring']='STORY_EFFECTS'
                prompt=clean.split('｜')[-2 if flavor else -1].rstrip('】')
                if flavor:prompt=clean.split('｜')[1]
                current['segments'].append(dict(id=f'L{len(current["segments"])+1:03}',text=prompt,kind='narration',speakerLabel='選擇',visual='SCENE'))
                current.update(kind='choice',choiceMode='DIALOGUE_FLAVOR' if flavor else 'STORY',scoring='NONE' if flavor else 'STORY_EFFECTS')
                # Move any result settlement before the flavor prompt, rather than onto a choice.
                if 'settlements' in current:
                    question=current['segments'].pop();target=base+f'_Q{choicecount}'
                    result=current;result.pop('choiceMode');result['kind']='result';result['next']=target
                    scenes.append(result);current=make(f'_Q{choicecount}',held);current['segments']=[question];current.update(kind='choice',choiceMode='DIALOGUE_FLAVOR')
                if act==1 and not flavor:current['planDecisionOverride']=dict(source=current['source'],reason='使用者新提供ACT01逐字劇本明列三個連續選擇點，覆寫早期開場無選項規劃；不改PROLOGUE或EP12。')
                q=current;scenes.append(q);join=base+f'_C{choicecount}_COMMON';startcg=held
                for oi,(index2,oid,label) in enumerate(opts):
                    ident=chr(65+oi);target=base+f'_C{choicecount}_{ident}';effects=[]
                    if not flavor:
                        if act==1:
                            key={2:ATT,4:PREP,5:METHOD}[number];value={2:['SOOTHE','QUESTION'],4:['CONTACT_UNION','CHECK_CARRIERS'],5:['KEEP','RIVER']}[number][oi];effects=[flag(key,value)]
                        elif act==2:effects=[flag(REP,['YURIS_APPOINTED','GRASS_APPOINTED','PUBLIC_NOMINATION_PENDING'][oi])]
                        elif act==3:effects=[flag(STAFF,['PALACE','TAMARA','ELLA_REJECTED'][oi]),points([10,-8,-12][oi])]+([unrest(8)] if oi==0 else [])
                    option=dict(id=ident,text=label,next=target,effects=effects)
                    if act==2 and not flavor:option['previewEffects']=portgroups+repgroups
                    q['choices'].append(option)
                    current=make(f'_C{choicecount}_{ident}',startcg);held=startcg;pending=None
                    for l,u in body[index2+1:opts[oi+1][0] if oi+1<len(opts) else merge]:push(l,u)
                    if not current['segments']:raise ValueError('Empty response')
                    current['next']=join;scenes.append(current)
                current=make(f'_C{choicecount}_COMMON',startcg);held=startcg;pending=None;i=merge;continue
            push(ln,t);i+=1
        if not current['segments']:raise ValueError('Empty continuation '+base)
        if hi<4:current['next']=f'EP05_ACT{act:02}_SC{number+1:02}'
        else:
            current['kind']='end';current['segments'].append(dict(id=f'L{len(current["segments"])+1:03}',text='＊　＊　＊',kind='caption',visual='BLACK'))
            current['completion']=dict(title=['','第一幕完','第二幕完','第三幕完','第四幕完'][act]+' · '+titles[act],scope='ACT',nextChapterId='EP05',policy='NO_SCORING')
            if act<4:current['completion'].update(nextSceneId=f'EP05_ACT{act+1:02}_SC01',nextLabel=titles[act+1],continueLabel='進入'+['','','第二幕','第三幕','第四幕'][act+1])
            else:current['completion']['pendingLabel']='第五幕〈庇護的代價〉· 敬請期待'
        scenes.append(current)
# Appending source-derived common facts is separate from flavor choices.
next(s for s in scenes if s['id']=='EP05_ACT04_SC05')['completionFlags']={'EP05_TEMPORARY_HOUSING_AUTHORIZED':True,'EP05_EXILE_IDENTITY_VERIFIED':False}
manifest=read('content/manifests/story.json');oldassets=read('content/manifests/assets.json');characters=read('content/characters/index.json');plan=read('content/planning/part-one.json')
for k,v in {ATT:'UNSET',PREP:'UNSET',METHOD:'UNSET',REP:'UNSET',STAFF:'UNSET',PORTDONE:False,REPDONE:False,'EP05_PORT_RELATION':'UNSET','EP05_ELLA_CARGO_STATUS':'WAITING_AT_OSINM','EP05_OSINM_RESTORED':False,FUND:False,'EP05_STAFF_DELIVERED':False,'EP05_CHURCH_FUNDING_UNRESOLVED':True,'EP05_TEMPORARY_HOUSING_AUTHORIZED':False,'EP05_EXILE_IDENTITY_VERIFIED':False}.items():manifest['flags'][k]=dict(initial=v,description='EP05 使用者逐字劇本連續性與一次性結算；非路線／CLEAR授權。')
manifest['version']=manifest['version'] if any(a['id'].startswith('EP05-ACT05-') for a in oldassets) else '0.13.1-ep05-act04-cg-complete' if (ROOT/'content/sources/ep05/act04/supplement-archives.json').exists() else '0.13.0-ep05-act01-act04'
chapter=next(c for c in manifest['chapters'] if c['id']=='EP05');chapter.update(status='DRAFT_AVAILABLE',file='episodes/ep05/chapter.json',entry='EP05_ACT01_SC01')
previous=read('content/episodes/ep04/chapter.json');end=next(s for s in previous['scenes'] if s.get('completion',{}).get('nextChapterId')=='EP05');end['completion'].pop('pendingLabel',None);end['completion'].update(nextSceneId='EP05_ACT01_SC01',continueLabel='進入第五章',nextLabel='第五章〈攝政成為習慣〉')
for act in next(c for c in plan['chapters'] if c['id']=='EP05')['acts'][:4]:
    act['authoringStatus']='NOT_AUTHORED'
    if act['number']==1:act['decision']='NONE'
# Normalize one display name, without changing existing stored IDs.
characters.update(roles)
later=read('content/episodes/ep05/chapter.json') if (ROOT/'content/episodes/ep05/chapter.json').exists() else {}
extra=[s for s in later.get('scenes',[]) if s['act']=='ACT05']
if extra:
    end=next(s for s in scenes if s['id']=='EP05_ACT04_SC05')
    end['completion']=next(s for s in later['scenes'] if s['id']==end['id'])['completion']
write('content/episodes/ep05/chapter.json',dict(schemaVersion=1,id='EP05',status='DRAFT',version=later.get('version','1.0.0'),source=later['source'] if extra else '使用者EP05 ACT01 v1.0、ACT02 v1.1、ACT03 v1.1、ACT04 v1.0完整製作包；原始劇本與圖片稽核見sources/ep05。ACT05未提供；不提前章末結算、不鎖定EP06路線。',scenes=scenes+extra))
write('content/episodes/ep04/chapter.json',previous);write('content/manifests/story.json',manifest)
write('content/manifests/assets.json',[a for a in oldassets if not a['id'].startswith(('EP05-ACT01-','EP05-ACT02-','EP05-ACT03-','EP05-ACT04-'))]+assets)
write('content/characters/index.json',characters);write('content/planning/part-one.json',plan)
write('docs/ep05-import-report.json',dict(scenes=len(scenes),segments=sum(len(s['segments']) for s in scenes),uses=uses,omitted=omitted,readerEdits=edits,images=sum(len(a['images']) for a in audits),missing=[x for a in audits for x in a['missing']],choices=sum(s['kind']=='choice' for s in scenes)))
print(json.dumps(dict(scenes=len(scenes),images=sum(len(a['images']) for a in audits),omitted=omitted),ensure_ascii=False,indent=2))
