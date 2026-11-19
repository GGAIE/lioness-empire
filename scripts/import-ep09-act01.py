"""Compile the supplied EP09 ACT01 scripts and native 28+28 CG editions."""
import importlib.util
import json
import re
import hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ep07_base',ROOT/'scripts/import-ep07.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
core=base.core
SCENES=core.scenes
ASSETS=[];FLAGS={}
TITLES={'SACRED':'讓子彈飛一下','WORLD':'讓子彈飛一下的政治分贓大會'}
S_PACT='EP09_S_ACT01_PACT_CHOICE'
W_PICK='EP09_W_ACT01_M01_CHOICE'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def declare(k,value=False):FLAGS[k]=dict(initial=value,description='第九章第一幕：依路線分開記錄救濟承諾與籌資選擇。');return k
for k,v in [(S_PACT,'UNSET'),(W_PICK,'UNSET'),('EP09_S_RIFT_CHURCH_PRECOMMIT',False),('EP09_W_VALKEN_FUNDING_SOURCE','UNSET'),('EP09_W_HEBE_FAVOR_OWED',False),('EP09_W_VALKEN_LAND_OFFER_REJECTED',False),('EP09_W_ACADEMY_LAND_LEASE_PENDING',False),('EP09_W_VALKEN_REFUGEE_COMMITMENT',False),('EP09_W_HEBE_FAMILY_LAND_INTEREST',False),('EP09_W_RECONSTRUCTION_FUNDING_PENDING',False),('EP09_W_LAND_LEGALLY_TRANSFERRED',False),('EP09_W_ROLAND_DEAD',False),('EP09_W_ROLAND_DEFEATED',False),('EP09_S_ROLAND_DEAD',False),('EP09_S_LAND_LEGALLY_TRANSFERRED',False)]:declare(k,v)
core.ROLES.update({'赫碧':('HEBE','赫碧'),'米椰爾':('MIEL','米椰爾'),'傳令兵':('SIXTH_ORDER_MESSENGER','傳令兵')})
class Act(base.Reader):
 def __init__(self,route):
  self.route=route;self.number=1;self.act='ACT01';self.chapter='EP09';self.folder='act01'
  folder=ROOT/f'content/sources/ep09/act01/{route.lower()}';audit=read(folder/'asset-audit.json')
  self.source=f'sources/ep09/act01/{route.lower()}/'+audit['script']
  raw=(ROOT/'content'/self.source).read_bytes();assert hashlib.sha256(raw).hexdigest()==audit['scriptSha256']
  self.rows=['']+raw.decode('utf-8-sig').splitlines();self.titles={int(m[1]):m[2] for row in self.rows if (m:=re.match(r'^#{1,2} SC(\d\d)｜(.+?)(?:（CG.*)?$',row))}
  assert len(self.titles)==5
  self.images={}
  for x in audit['images']:
   assert hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest()==x['sha256']
   self.images[x['key']]=x['id'];ASSETS.append(dict(id=x['id'],type='cg',src=x['path'],label='第九章 第一幕 '+route+' CG'+x['key'],status='APPROVED',source=audit['archive']))
  self.anchors={};self.used=set();self.choice_count=0
  anchors=[
   ('王都的天色','01_01'),('七枚封蠟','01_02'),('芬利抱著','01_03'),('奧莉維亞翻到','01_04'),('**芬利**：「還有另一件事','01_05'),('芬利把羅蘭','01_06'),
   ('芬利從書架','02_01'),('**芬利**：「溫室分裂後','02_02'),('**芬利**：「黑冠王大敗','02_03'),('**芬利**：「但黑冠王征服','02_04'),('她將一枚象徵羅蘭','02_05'),
   ('小會客室沒有','03_01'),('聖光會米椰爾','03_02'),('**奧莉維亞**：「王室會協調','03_03'),('**米椰爾**：「那麼，這份約定','03_04'),('米椰爾原本扶著','03_05'),('米椰爾收好地圖','03_06'),
   ('戰事比任何','04_01'),('第一份報告說','04_02'),('第二份報告說','04_03'),('第三份則帶來','04_04'),('**芬利**：「聖光會已經開放','04_05'),('**芬利**：「好。但戰報','04_06'),
   ('深夜，王宮','05_01'),('**芬利**：「艾琳達的軍報','05_02'),('**奧莉維亞**：「第三團呢','05_03'),('傳令員拿走軍令','05_04')
  ] if route=='SACRED' else [
   ('（窗外細雨','01'),('芬利：「第一位要求','02'),('芬利翻出另一張','03'),('艾琳達：「妳看見的是','04'),('奧莉維亞把七枚','05'),
   ('芬利：「您該不會','06'),('奧莉維亞：「溫室分裂','07'),('（畫面切入歷史插敘','08'),('奧莉維亞：「對。銀槍','09'),('（繪卷中的銀槍軍','10'),('芬利闔上史書','11'),
   ('（芬利將地圖換成','12'),('艾琳達：「我們能開','13'),('赫碧：「咦，可是','14'),('奧莉維亞：「所以一邊','15'),('（芬利將四份方案','16'),
   ('（新戰報遞上','19'),('傳令兵：「第六團','20'),('艾琳達：「我們已經把醫療','21'),('（轉入無選項結果','22'),('芬利：「如果等下去','23'),
   ('芬利把七領地標記','24'),('艾琳達：「第六團已經守住','25'),('奧莉維亞：「通知第三團','26'),('（軍令離桌','27'),('芬利：「殿下，現在','28')]
  for needle,image in anchors:self.anchors[needle]=image
 def start(self,section,suffix='',image=None):
  super().start(section,suffix,image);self.node['planNodeId']='EP09_ACT01';self.node['version']='1.1.0' if self.route=='SACRED' else '1.0.0'
  if section>=4:self.node['availableWhen']=core.both(self.node['availableWhen'],{'not':core.eq(S_PACT if self.route=='SACRED' else W_PICK,'UNSET')})
 def cue(self,key,line,when=None):self.used.add(key);super().cue(key,line,when)
 def prose(self,line,text=None):
  row=(self.rows[line] if text is None else text).strip()
  if not row:return
  for needle,image in self.anchors.items():
   if row.startswith(needle):self.cue(image,line)
  if row.startswith(('**[轉場]**',)):
   self.emit(' ',line,kind='caption',visual='BLACK');self.cue('05_05',line);self.emit(' ',line,kind='caption');return
  if row.startswith(('#','---','**CG','**場所','**地點','**旁白','**共同','**[HIDDEN','**玩家','效果：','（三個分支','（四分支','**END')):return
  if row.startswith('（鏡頭停在'):return
  if row.startswith('（'):
   stages={
    '（窗外細雨':'窗外細雨綿綿，桌上攤著裂谷地圖。七個領地分別用不同顏色的封蠟標示；旁邊是一疊將近倒下的請求書。',
    '（畫面切入歷史插敘':'繪卷上，七道小旗被黑色王旗取代。',
    '（繪卷中的銀槍軍':'繪卷中的銀槍軍轉向反擊。',
    '（芬利將地圖換成':'芬利將地圖換成難民收容與道路修復報告。',
    '（芬利將四份方案':'芬利將四份方案攤在桌上。',
    '（新戰報遞上':'新戰報遞上。羅蘭奪取一領的實權後，試圖繼續向其餘領地施壓。部分聚落被掠奪，難民沿舊商路往第六團的哨站走。',
    '（轉入無選項結果':'第六團士兵把毯子交給被雨淋透的難民；遠方的房舍冒著煙。',
    '（軍令離桌':'軍令離桌。第六團在夜間整隊，第三團也收到了封緘軍令。'}
   row=next((v for k,v in stages.items() if row.startswith(k)),None)
   if row is None:return
  row=row.replace('**','')
  pattern=re.compile(r'('+'|'.join(sorted(core.ROLES,key=len,reverse=True))+r')([^：「」]*?)：「([^」]*)」')
  matches=list(pattern.finditer(row));end=0
  if not matches:self.emit(row,line);return
  for m in matches:
   if row[end:m.start()].strip():self.emit(row[end:m.start()].strip(),line)
   if m[2].strip():self.emit(m[1]+m[2]+'。',line)
   self.emit('「'+m[3]+'」',line,role=m[1]);end=m.end()
  if row[end:].strip():self.emit(row[end:].strip(),line)
 def flavor(self,line):
  head=self.rows[line];code=re.search(r'C\d\d_FLAVOR_\d\d|F\d\d',head)[0]
  prompt=head.split('｜',1)[1].split('（')[0] if self.route=='SACRED' else head.split('：',1)[1].rstrip('*')
  cursor=line+1;options=[]
  while cursor<len(self.rows):
   row=self.rows[cursor].strip()
   if not row:cursor+=1;continue
   pat=r'- \*\*([ABC])「(.*?)」\*\* (.*)' if self.route=='SACRED' else r'- F\d\d_([ABC])「(.*?)」→(.*)'
   m=re.fullmatch(pat,row)
   if not m:break
   options.append((m[1],'「'+m[2]+'」',m[3],cursor));cursor+=1
  assert len(options)==3,(line,options)
  section=self.section;common=self.id(section,'_'+code+'_COMMON')
  self.question(prompt,line,[self.option(k,label,self.id(section,'_'+code+'_'+k)) for k,label,_,_ in options],flavor=True);self.choice_count+=1;image=self.held
  for k,label,response,n in options:
   self.start(section,'_'+code+'_'+k,image)
   if self.route=='WORLD':self.emit(label,n,role='奧莉維亞')
   self.prose(n,text=response);self.finish(next=common)
  self.start(section,'_'+code+'_COMMON',image);return cursor
 def major(self,line):
  section=self.section;code='PACT' if self.route=='SACRED' else 'M01';common=self.id(section,'_'+code+'_COMMON');options=[]
  if self.route=='SACRED':
   starts=[n for n in range(line+1,len(self.rows)) if re.match(r'^### [ABC]｜',self.rows[n])][:3]
   stop=next(n for n in range(starts[-1]+1,len(self.rows)) if self.rows[n].startswith('**共同續接'))
   for i,n in enumerate(starts):
    label=re.search('「[^」]+」',self.rows[n])[0];options.append(('ABC'[i],label,n+1,starts[i+1] if i<2 else stop))
   prompt='這份約定要如何對外說明？'
  else:
   cursor=line+1
   while not self.rows[cursor].strip():cursor+=1
   while self.rows[cursor].startswith('- **M01_'):
    row=self.rows[cursor];m=re.match(r'- \*\*M01_([ABCD])\*\*「([^」]+)」',row);assert m,row
    options.append((m[1],'「'+m[2]+'」',cursor,cursor+1));cursor+=1
   stop=cursor;prompt='如何替瓦肯家族籌措安置資金？'
  choices=[]
  for k,label,_,_ in options:
   if self.route=='SACRED':effects=[core.flag(S_PACT,k),core.flag('EP09_S_RIFT_CHURCH_PRECOMMIT',True)]+([core.points(-30)] if k=='B' else [])
   else:
    effects=[core.flag(W_PICK,k),core.flag('EP09_W_VALKEN_FUNDING_SOURCE',{'A':'GRAVITZ','B':'ACADEMY','C':'BASIC_AID','D':'HEBE_BRIDGE'}[k]),core.flag('EP09_W_VALKEN_REFUGEE_COMMITMENT',True),core.flag('EP09_W_HEBE_FAMILY_LAND_INTEREST',True)]
    for key,value in [('HEBE_FAVOR_OWED',k=='D'),('VALKEN_LAND_OFFER_REJECTED',k=='D'),('ACADEMY_LAND_LEASE_PENDING',k=='B'),('RECONSTRUCTION_FUNDING_PENDING',k=='C')]:effects.append(core.flag('EP09_W_'+key,value))
    delta={'A':10,'B':5,'C':0,'D':-15}[k]
    if delta:effects.append(core.points(delta))
   c=self.option(k,label,self.id(section,'_'+code+'_'+k),effects)
   if (self.route=='SACRED' and k=='B') or (self.route=='WORLD' and k=='D'):c['pointCostPolicy']='ALLOW_EXHAUSTION'
   choices.append(c)
  self.node['planDecisionOverride']=dict(source=self.source,reason='使用者提供的第一幕完整版明定此處為唯一實質政治選擇，覆蓋早期無選項規劃。')
  self.question(prompt,line,choices);self.choice_count+=1;image=self.held
  for k,label,first,last in options:
   self.start(section,'_'+code+'_'+k,image)
   if self.route=='WORLD':
    self.cue('17',first)
    reply=self.rows[first].split('對白：',1)[1].split('（',1)[0]
    if k=='D':
     before,after=reply.split('赫碧：「啊，那我家',1);self.prose(first,text=before);self.cue('18',first);self.prose(first,text='赫碧：「啊，那我家'+after)
    else:self.prose(first,text=reply)
   else:
    for n in range(first,last):self.prose(n)
   self.finish(next=common)
  self.start(section,'_'+code+'_COMMON',image);return stop
 def compile(self):
  headings=[n for n,row in enumerate(self.rows) if re.match(r'^#{1,2} SC\d\d｜',row)]
  for i,first in enumerate(headings,1):
   self.start(i);last=headings[i] if i<5 else next(n for n in range(first+1,len(self.rows)) if self.rows[n].startswith('# 本幕演出') or self.rows[n].startswith('## 選項統計'))
   cursor=first+1
   while cursor<last:
    row=self.rows[cursor]
    if re.match(r'^### C\d\d_FLAVOR|^\*\*CHOICE F',row):cursor=self.flavor(cursor);continue
    if row.startswith(('## C03_PACT','**CHOICE M01')):cursor=self.major(cursor);continue
    # One authored report contains three distinct delivered illustrations.
    if self.route=='SACRED' and row.startswith('第一份報告說'):
     for text in re.split(r'(?<=[。；])',row):
      if text:self.prose(cursor,text=text)
    else:self.prose(cursor)
    cursor+=1
   if i<5:self.finish(next=self.id(i+1))
   else:
    done=declare('EP09_'+self.route[0]+'_ACT01_COMPLETE');self.node['completionFlags']={done:True}
    self.finish(kind='end',completion=dict(title='第一幕完 · '+TITLES[self.route],scope='ACT',nextChapterId='EP09',pendingLabel='第二幕〈裂谷兩岸〉· 敬請期待',policy='NO_SCORING'))
  assert self.choice_count==(9 if self.route=='SACRED' else 7),self.choice_count
  assert self.used==set(self.images),(self.route,set(self.images)-self.used)
def main():
 for r in TITLES:Act(r).compile()
 write(ROOT/'content/episodes/ep09/chapter.json',dict(schemaVersion=1,id='EP09',version='1.1.0',status='DRAFT',source='使用者提供神聖線 v1.1、世界線 v1.0 完整劇本及 56 張 CG。',scenes=SCENES))
 p=ROOT/'content/episodes/ep08/chapter.json';pack=read(p)
 for s in pack['scenes']:
  if s['act']=='ACT05' and s.get('completion'):
   r='SACRED' if s['id'].startswith('EP08_ACT05_SC05_S') else 'WORLD'
   end=s['completion'];end.pop('pendingLabel',None);end.update(nextSceneId=f'EP09_ACT01_SC01_{r[0]}',nextChapterId='EP09',nextLabel='第九章〈誰在統治安度因〉',continueLabel='進入第九章')
 write(p,pack)
 p=ROOT/'content/manifests/story.json';m=read(p);m['version']='0.25.0-ep09-act01';m['flags'].update(FLAGS)
 next(c for c in m['chapters'] if c['id']=='EP09').update(status='DRAFT_AVAILABLE',file='episodes/ep09/chapter.json',entry='EP09_ACT01_SC01_S');write(p,m)
 p=ROOT/'content/manifests/assets.json';write(p,[a for a in read(p) if not a['id'].startswith('EP09-ACT01-')]+ASSETS)
 p=ROOT/'content/characters/index.json';chars=read(p)
 for ident,name in core.ROLES.values():chars.setdefault(ident,name)
 write(p,chars)
 print(len(SCENES),'nodes',sum(len(s['segments']) for s in SCENES),'segments',len(ASSETS),'CGs')
if __name__=='__main__':main()
