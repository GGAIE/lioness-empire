# Lioness Empire — EP08 Sacred ACT05 | Codex + Art Production Package v1.0

**Title:** 《母獅帝國》EP08 神聖線 ACT05〈善意的限度〉  
**Package status:** `DRAFT_FOR_REVIEW` for newly written dialogue and CG plans. The latest user-accepted scene outline, F5 condition, negotiation topology and seven numeric outcomes are the design baseline; full lines and character-turnaround render still require individual approval.

## Two workflows in one ZIP

**FOR CODEX — import narrative/flags/choices:**
1. Read `04_Canon_and_QA/Current_Canon_and_Delta.md`.
2. Read `01_Story/ACT05_Sacred_Full_Script_v1.0.md` (full Traditional-Chinese script).
3. Read `02_Codex/README_CODEX.md`, `ACT05_Choice_Graph.json`, and five `scene_data/SCxx.json` (each embeds corresponding complete script).
4. Use `02_Codex/src/act05Resolver.ts` for deterministic result calculation, not as a claim of completed integration. Import using existing engine scene APIs, then test all 36 combinations.
5. Do not rewrite earlier locked acts. Do not apply EP09 unrest tax within ACT05.

**FOR ART PROJECT — create CG assets:**
1. Read `03_Art_Project/README_ART.md` and `Character_Locks_and_Turnarounds.md`.
2. Use `03_Art_Project/Character_References/Mier_Three_View_v1.0_CANDIDATE.png` and `Alicia_Three_View_v1.0_USER_REFERENCE.png` as reference.
3. Follow `03_Art_Project/CG_Prompts/ACT05_32_CG_Prompts_v1.0.md`, `CG_Shot_List.csv`, and `CG_Asset_Manifest.json`.
4. Produce 32 **separate** cinematic 16:9 scene CGs and QA each for anatomy/character consistency. **Those 32 scene images are not included; only prompts are included.**
5. Mier's standalone sheet is newly rendered **candidate**, not a preexisting approved canonical reference. Alicia's three-view is converted from the user's supplied exact image, and the original JPG is preserved.

## Directory tree

```text
01_Story/
  ACT05_Sacred_Full_Script_v1.0.md                 Complete five-scene script and branches
02_Codex/
  README_CODEX.md                                   Codex integration contract
  ACT05_Choice_Graph.json                           All choice definitions and results
  scene_data/SC01.json ... SC05.json                Full dialogue per scene + anchors
  src/act05Resolver.ts                              Reference TypeScript resolver
  tests/all_36_political_combinations.{json,csv}     Exhaustive combo vectors
  tools/validate_act05.py                           Offline QA (Python stdlib)
03_Art_Project/
  README_ART.md                                     CG art handoff rules
  Character_Locks_and_Turnarounds.md                Exact character appearance locks
  Character_References/                             Two full turnaround sheets, sources and crops
  CG_Prompts/ACT05_32_CG_Prompts_v1.0.md            32 distinct English prompts
  CG_Asset_Manifest.json                           CG list/status; no fake CGs
  CG_Shot_List.csv                                 Scene/outcome index
04_Canon_and_QA/
  Current_Canon_and_Delta.md                        Replaces conflicting historical ACT05 plans
  QA_and_Acceptance.md                              Manual and automated QA
05_Source_References/                               Prior EP08 startup files, HISTORICAL ONLY
PACKAGE_MANIFEST.json                               File inventory + SHA-256 hashes
```

## Core decisions frozen in this package

- **Opening:** Olivia, Alicia and Finley chatting in the **Northeast Tower** in the royal capital. Mier comes to them, representing Saraphenia. They **do not** travel to Saint Annugas in ACT05.
- **F5:** Finley asks to access Alicia's research held at **非爾斯敦**. F5 A/B: CLEAR +1; F5 C (“我這邊很忙”) no CLEAR. It is independent from political points.
- **Politics:** P01 opens 4 routes (A/B/C/D); P02 and P03 have 3 responses each. 4×3×3 = 36 combinations, resolved to 7 outcomes: +30,+20,+10,0,−10,−25,−40 political points, paired with +15,+10,+5,−5,−10,−20,−30 unrest respectively.
- **Not zero-sum morality:** Ceding institutional influence allows church relief/social mediation to decrease unrest. Keeping executive autonomy increases political points but requires more royal responsibility and unrest management.
- **Fixed closing:** no new formally signed agreement, no overt schism. Mier returns to Saraphenia; future administrative implications depend on result tier. A front-line dispatch leads into EP09, where the actual reinforcement choice is still open.

## Media audit

- User source #1: an outdoor two-character scene; Mier is the **blonde woman on the left**. Included as `Mier_Original_Look_USER_REFERENCE.jpg` for visual grounding, **not** as an ACT05 event CG.
- User source #2: **Alicia original front/side/back**. Included unmodified as `Alicia_Three_View_USER_REFERENCE.jpg`; also provided as losslessly re-encoded `.png`.
- Mier's requested standalone front/side/back was generated and included as a single 1536×1024 PNG; the three view crops are optional conveniences, not extra independent generations.
- Art output: **32 CG PROMPTS**, **0 finished ACT05 event CG images**. There is no dummy CG image falsely named as completed.

## Version governance

Current user decisions override the older `EP08_Production_Startup_v1.0.md` (which had an obsolete ACT05 trip to Saint Annugas) and the older generic F5 'contract/missing page' placement. The archived originals are retained in `05_Source_References` for provenance, not runtime instructions. Do not mark this newly written script `APPROVED` until human review.
