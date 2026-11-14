# Scene index / routes / continuity / version deltas

| ID | Name | Location | CG IDs | Choice | Result |
|---|---|---|---|---|---|
| EP08_SACRED_ACT01_SC01 | 東北塔，舊紙與熱茶 | 東北塔 | 01–03 | flavor C01 | Historical pattern examined; no proof of individual guilt |
| EP08_SACRED_ACT01_SC02 | 兩封沒有進入同一本帳的信 | 東北塔 | 04–05 | flavor C02 | Unreported communications noted; Olivia chooses to visit |
| EP08_SACRED_ACT01_SC03 | 白袍之前的禮貌 | 聖安奴加斯 | 06–09 | flavor C03 | Saraphenia realizes Olivia cannot be brushed off; closes door and removes outer mantle |
| EP08_SACRED_ACT01_SC04 | 兩面人的方便之處 | 聖安奴加斯 | 10–12 | flavor C04 | Olivia objects to double dealing; no demands or agreement |
| EP08_SACRED_ACT01_SC05 | 一截粉筆的告別 | 聖安奴加斯→東北塔 | 13–18 | none | Olivia teleports away; Saraphenia reassesses; no new agreement |

## GameState proposal (NOT official numeric balancing)

- `ROUTE_06 = SACRED` (incoming, unchanged).
- `EP08_SACRED_FIRST_MEETING_COMPLETE = true` (new proposed factual event marker).
- `EP08_SACRED_PRIVATE_WARNING = true` (new proposed historical marker; no formal demand).
- `EP08_SACRED_SECRET_LETTERS_NOTED = true` (means only the existence of correspondence was observed, **not** full letters, proof of treachery, or motive).
- `EP08_SACRED_TALK_AGREEMENT = false` (explicit continuity constraint; **do not** instantiate new political arrangement).
- `EP08_SACRED_CHALK_EXIT = true` (action marker only, no political-point grant).
- `EP08_SACRED_TRUST_TENSION` is an **optional narrative marker**; no automatic numerical penalty, new route, or ending lock.
- No chapter start recalculation or state gain is triggered by ACT01 itself; defer to complete chapter rules. Flavor choices C01–C04 write no flags and make no conditional branches beyond local dialogue.
- `NG_PLUS_CAUSE` / hidden motive **never disclosed, seeded as dialogue, or encoded as visible speculation here**.

## Character knowledge

- Olivia knows some registration patterns and non-public communication exists; she does **not** know the contents of every letter or the underlying future reveal.
- Finley can compare archive metadata; he does **not** possess every letter or hidden knowledge of Elia.
- Saraphenia recognizes Olivia's political maturity; whether Saraphenia approved every letter and the full contents of the exchanges remains **UNRESOLVED**.
- Aivis remains legitimate crown prince and active eastern commander. Correspondence itself is not unlawful.

## Differences from original startup v1.0

- Previously the first visit aimed to renegotiate political authority; latest user conversation **overrides** its outcome: a pointed personal warning, no deal, no formal guarantees.
- Original scene map is 3 generic per-act scenes; user-approved discussion unfolds in **5 narrative scenes**, and original archive is preserved in `05_Source_Startup` rather than silently modified.
- SC01 now begins with a light private history review at northeast tower, SC02 identifies two-faced behavior and letters before travel.
- Saraphenia's shift is a reaction to being challenged, **not** a prearranged theatrical reveal: she shuts the door and removes her white outer robe.
- Olivia chalk-draws a return teleport **inside the room** rather than exiting by the main door.
- No new plot reason tied to NG+ is shown.
- ACT02 council reconstruction and ACT05 later scrutiny of actual disaster-response competence remain reserved and untouched.

## SOURCE_REQUIRED / open

- EP07 locked transcript unavailable here: exact examples of events the Holy Light Council avoided must be mapped to actual earlier events before claiming verified refusals.
- EP06 complete secret letters unavailable: only correspondence metadata and Olivia's dissatisfaction are depicted; no fabricated quotations or contents.
- Legal status, physical magic constraints and anchor use for chalk transit require world-bible review; this draft assumes a predesignated return anchor at northeast tower, not unrestricted travel.
- Finley exact visual appearance should be checked against latest approved art before rendering CG.
- Saraphenia turnaround newly generated from user visual example; final identity approval remains with user.

## QA rules

Only Olivia drives player choices; four non-impact flavor choices C01–C04 in this act. No choice changes any state. Dialogue contains no production terms, NG+, or chapter numbers. No spoilers of later catastrophe or first-part Elia return. No offscreen treaty, automatic loss of church powers, or early route lock. The saintess does not remove her inner clothing; the gesture is symbolic, not erotic. Historical examples are broad interpreted patterns, not fabricated named canon cases.

## ACT01 flavor-choice rules (v1.1 update)

- C01 SC01: nighttime banter with Finley; 3 choices, converge immediately.
- C02 SC02: complaint about communication opacity; 3 choices, converge immediately.
- C03 SC03: opening phrasing with Saraphenia; 3 choices, converge immediately.
- C04 SC04: response to accusation of distrust; 3 choices, converge immediately.
- SC05: no choice; chalk teleport is Olivia's fixed autonomous action.
- All C01–C04: no Political Points, Unrest, A/F/T/S CLEAR, route, trust, historical flag, NG+ flag, or ending-vector mutation.
- The later intense table-slamming confrontation belongs to **ACT05**, not **SC05**. Its future impactful choices and consequences remain unapproved and outside this package.
