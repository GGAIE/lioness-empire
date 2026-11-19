"""Offline QA for script/graph/outcomes/CG manifest; stdlib only.
Run from any working directory: python 02_Codex/tools/validate_act05.py
"""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[2]
G=json.loads((ROOT/'02_Codex/ACT05_Choice_Graph.json').read_text(encoding='utf-8'))
V=json.loads((ROOT/'02_Codex/tests/all_36_political_combinations.json').read_text(encoding='utf-8'))
C=json.loads((ROOT/'03_Art_Project/CG_Asset_Manifest.json').read_text(encoding='utf-8'))
S=(ROOT/'01_Story/ACT05_Sacred_Full_Script_v1.0.md').read_text(encoding='utf-8')
assert len(V)==36, f'bad count: {len(V)}'
assert len(C['assets'])==32, f"bad CG count: {len(C['assets'])}"
assert {x['tier'] for x in V}==set(range(7)), 'some tier unreachable'
assert sum(x['tier']==6 for x in V)==1, 'big failure must have unique path'
assert [x for x in V if x['tier']==6][0]['entry']=='D'
assert [x for x in V if x['tier']==6][0]['middle']=='EXPAND'
assert [x for x in V if x['tier']==6][0]['closing']=='STANDING'
for x in V:
 expected=max(0,min(6,G['political_choices']['P01']['options'][x['entry']]['base']+G['political_choices']['P02']['options'][x['middle']]['delta']+G['political_choices']['P03']['options'][x['closing']]['delta']))
 assert x['tier']==expected
 assert x['political_delta']==G['result_table'][str(expected)]['political_delta']
 assert x['unrest_delta']==G['result_table'][str(expected)]['unrest_delta']
for num in range(1,11):
 assert f'FL{num:02d} 無影響選項' in S,f'FL{num:02d} missing'
for num in range(1,6):
 assert f'# SC{num:02d}｜' in S
 assert (ROOT/'02_Codex/scene_data'/f'SC{num:02d}.json').is_file()
for c in C['assets']:
 assert c['status']=='PROMPT_ONLY'
 assert re.match(r'^CG\d{2}$',c['cg_id'])
 assert c['filename']==f"LE_CG_EP08_ACT05_{c['cg_id']}_v1.0.png"
 assert '2D Japanese' in c['prompt']
for f in ['Mier_Three_View_v1.0_CANDIDATE.png','Alicia_Three_View_v1.0_USER_REFERENCE.png']:
 assert (ROOT/'03_Art_Project/Character_References'/f).is_file()
print('PASS: 5 scenes, 10 flavor choices, 36 paths, seven tiers, unique -40 path, 32 prompts, two three-view sheets.')
