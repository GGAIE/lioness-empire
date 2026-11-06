# Act 04 QA and implementation notes

## Confirmed values

| EP05 Rouenne noble transfer | S2 this Act | Political points | Unrest delta |
| --- | --- | ---: | --- |
| True | Success | +5 | unchanged / not newly specified |
| True | Failure | -2 | +5 |
| False | Success | -5 | unchanged / not newly specified |
| False | Failure | -10 | +15 |

These point deltas are once per S2 decision, NOT once per SC02 branch dialog/CG and NOT in the separate SC03 gate outcome. Successful-case unrest was not specified in the user decision and should not be silently filled in.

## Choice coverage and effect boundaries

| Scene | Flavor groups per run | Additional major selection |
| --- | --- | --- |
| SC01 | FLAVOR-01 / FLAVOR-02 | None |
| SC02 | FLAVOR-03 / FLAVOR-04-T or 04-F | MAJOR-S2-T or MAJOR-S2-F |
| SC03 | FLAVOR-05 / FLAVOR-06 | MAJOR-T2-1 |
| SC04 | FLAVOR-07 / FLAVOR-08-N or 08-S | MAJOR-F3-N ONLY when no seal |
| SC05 | FLAVOR-09 / FLAVOR-10 | None |

All flavor options are simple line variants that merge without state changes.

## Branch sequence
1. EP05 flag `ROUENNE_TRANSFER_APPROVED` is READ ONLY, controls first look and SC02 option texts.
2. SC02 produces `S2_REFUGEE_OUTCOME=SUCCESS/FAILURE`.
3. SC03 combines these into four non-identical actual situations and a context-dependent choice presentation.
4. ACT03 `FINLEY_SECRETARY_SEAL=true` makes F3 automatically pass: NEVER repeat the ring grant, never ask Olivia to authorize again.
5. Miyel visits at night with ceremony notice; chosen saint, deal details, negotiators and later Sacred/World route are NOT disclosed here.

## Cross-source conflicts resolved by current user decisions
- Older package ACT03 assumed success/failure under a different approach. Latest ACT03 A/B/C always solves Ottodan case, A only permanent signet, A F2 +5; this Act only reads ACT03 completed state.
- Older project files placed route decision in ACT03; current EP06 starter moved it to the interlude after ACT05. Do not write ROUTE_06 here.
- Official standard name spellings have variant aliases: script uses 奧莉薇雅, 莎莉雅, 塔馬拉; follow latest reviewed production canon for UI later.

## Pending approval before engineering
- S2-success unrest change, if any, is not set by the conversation.
- Additional political/unrest deltas for T2 upper half and F3 without seal remain TBD.
- Exact final saint and pre-agreement details are deliberately withheld until ACT05 travel.
- T2 lower half's final CLEAR to be resolved in later chapter, not in ACT04.
- Miyel face/attire must use ACT02 approved CG character reference; no existing image binary included here.

## CG mapping
28 unique CG ids in the script with 28 unique English prompts. Not all are viewable in one playthrough due to mutually exclusive routes. All background documents must have illegible marks. No mature character anatomy errors, no crown on Olivia, no dragon traits on Finley.
