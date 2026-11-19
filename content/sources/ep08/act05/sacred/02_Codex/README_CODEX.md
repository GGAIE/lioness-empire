# Codex handoff — EP08 Sacred ACT05

## Goal
Implement exactly five playable scenes with a working negotiation graph, choice-conditioned dialogue, result scene, F5 unlock, and 32 CG asset hooks. Do not reconstruct missing earlier-episode text from this package. The `scene_data/SCxx.json` files carry **the complete text** in `script_markdown`, including all variation lines; the MD in `01_Story` is the authoritative readable text.

## Inputs and namespaces

- External route gate: `ROUTE_06 == SACRED`; must *not* infer `STAR` until EP09 reinforcement decision.
- Story prefix: `EP08_SACRED_ACT05_`. Scene identifiers `SC01` to `SC05`.
- F5: `F5_A`, `F5_B`, `F5_C`. The event awards +1 FINLEY CLEAR at most once if A or B. Neither the research acquisition nor political authority transfer happens instantly without relevant parties.
- Flavor: `FL01`–`FL10`, three options each. No flags, inventory changes, standings, score deltas, or hidden accumulation.
- Political P01: entry `A/B/C/D` maps to base `0/1/2/4`.
- Political P02: `LIMIT/BOUND/EXPAND` adds `−1/0/+1`.
- Political P03: `CASE/OPEN/STANDING` adds `−1/0/+1`.
- Clamp computed tier into `[0,6]`, show `T{tier}` narrative, select CG25–CG31, then common epilogue CG32.
- Complete political deltas **only once** at SC05: tier `0..6` => points `[30,20,10,0,-10,-25,-40]`, unrest `[15,10,5,-5,-10,-20,-30]`.
- Clamp unrest `[0,100]`, but **do not invent** a political points floor, cap, bankruptcy/instant game-over rule. Defer to host governance, which is still undergoing calibration.
- The next-episode (EP09) unrest threshold deduction belongs solely to the EP09 opener; do not run it a second time at EP08 ending. Provisional EP09 rule: unrest 60–79 -> −10, 80–100 -> −40, else 0, not stacked.

## Runtime implementation plan

1. Import five scene JSON files. Use the `script_markdown` content verbatim for the narrative text and parse the anchored block markup or manually convert each block into your engine's dialogue nodes.
2. SC01: add `F5` choice; apply F5 once and show corresponding result dialogue. If already applied due to load/replay, do not award again.
3. SC02: after Mier greeting, display P01 (4 options). Save opening string. Use its branch-specific dialogue. Offer FL choices at their placement without effects.
4. SC03: render `entry`-conditioned proposal/response. Display P02 (3 options) and record middle string. No political changes yet.
5. SC04: render technical dispute plus `middle`-conditioned response. Display P03 (3 options). No political changes yet.
6. SC05: compute seven-tier result, save tier/result key, play one T0–T6 scene, then the common farewell/EP09 dispatch. Apply points/unrest exactly once. F5 status remains independent.
7. Link all referenced CG ids to art manifest `CG_Asset_Manifest.json`; gracefully fall back to available current backgrounds while the art team generates the promised event CGs. Do not assign placeholder art as if finished.
8. Validate/inspect dialogues using two routes into same tier (e.g. P01 A vs B) to verify proposal text changes even if final tier matches.

## Canon and agency

- Only Olivia owns **player** Choice; Mier, Alicia, Finley are non-player participants with independent reactions and interests.
- No signed new legal agreement. Mier may secure trial assistance, administrative tolerance, or perceived precedents without a new binding legal treaty.
- Mier's relief work is legitimate; this is a political institutional boundary dispute, not proof the church is universally malign.
- Alicia is **not** Elia; Elia does not return in book 1. Alicia re-sealed an *already manifested* Eye of Ice.
- If ACT04 Shalia aid status differs by save, avoid claiming all charitable donations were already delivered. Only reference genuine on-site aid and whether promises are approved if a prior flag actually confirms it.

## Validation

```bash
python 02_Codex/tools/validate_act05.py
```

Compare results against `tests/all_36_political_combinations.json`; seven tiers all reachable; unique −40 path must be `D+EXPAND+STANDING`. Test replay/idempotency, save/reload at all choices, unrest near 0 and 100, no role choice except Olivia, F5 clear award once, and no route lock until EP09. Imported UI/engine is not included here: this is a production handoff, not a claimed full game build.
