# Scene index / choices / continuity / version deltas

| ID | Name | Location | CG IDs | Choice | Result |
|---|---|---|---|---|---|
| EP08_SACRED_ACT02_SC01 | 新議會大堂與空著的椅子 | 新議會大堂 | 01–04 | flavor C01, C02 | Parliament hall inauguration; Olivia announces 50-seat parliament and guarantees representation sources; Holy Light receives 1 seat |
| EP08_SACRED_ACT02_SC02 | 五十張椅子的名冊 | 籌備室 | 05–06 | major M01 | Implementation method for nominations and seat-preparation chosen |
| EP08_SACRED_ACT02_SC03 | 一席的聖光會 | 側廊 | 07–08 | flavor C03 | Saraphenia fully realizes Olivia is serious about diluting church influence |
| EP08_SACRED_ACT02_SC04 | 空席位與臨時議事 | 書記室／議場 | 09–11 | major M02 | Transitional operating rule chosen before full representation is complete |
| EP08_SACRED_ACT02_SC05 | 第一份議程 | 新議會大堂 | 12–15 | flavor C04 | Theocracy fugitive/embezzlement case formally accepted and registered |

## Canon-status and route continuity

- Route remains Sacred.
- ACT01 continuity preserved: Olivia previously warned Saraphenia and left by chalk teleport; no treaty or formal reconciliation was achieved.
- ACT02 **overrides** the original startup assumption that Sacred would primarily continue a church/royal renegotiation. In this updated version, Olivia answers the church issue by institutional design: the new parliament hall and 50-seat reform.
- The Holy Light Church retains a **single formal seat** in the new parliament. This is a deliberate political symbol and is not an accidental placeholder.
- Nominations are **not complete** in this act. The hall opens before full occupancy.
- The theocracy fugitive/embezzlement case begins here only as intake and registration. Specific culprit details, stolen-fund provenance, treaty terms, arrest status, and final jurisdiction remain `SOURCE_REQUIRED` / open.

## Major choice implementation (hidden from UI)

### M01 — How are the new seats prepared?

Visible choices shown to player:
1. 各方自行提出人選與名冊。
2. 由王室先建立資格審查程序。
3. 接受聖光會協助地方協調與舉薦。

Hidden production effects:
- `M01_A_SELF_NOMINATION` → Political resource / score **+10**. Suggested narrative cost: more local competition and friction.
- `M01_B_ROYAL_REVIEW` → Political resource / score **-20**. Suggested narrative cost: royal administration bears heavy review burden.
- `M01_C_CHURCH_COORDINATION` → Political resource / score **-35**. Suggested narrative cost: church begins to ask for funding, consultative power, and procedural footholds.

Locked shared results after any M01 option:
- New parliament remains 50 seats.
- Holy Light Church remains 1 seat.
- Representation sources include lords, autonomous cities, registered guilds, Royal Magic Academy, and other recognized governance communities.
- Nominations remain incomplete.

### M02 — How does the chamber operate before full representation is complete?

Visible choices shown to player:
1. 先讓現任與已核准代表處理緊急議程。
2. 優先完成最低代表資格後，再表決長期議案。
3. 接受聖光會的過渡保障方案。

Hidden production effects:
- `M02_A_URGENT_WITH_CURRENT` → Political resource / score **+5**. Suggested narrative cost: old forces keep stronger interim voice.
- `M02_B_MIN_REP_FIRST` → Political resource / score **-15**. Suggested narrative cost: slower deliberation and higher royal administrative burden.
- `M02_C_CHURCH_TRANSITION` → Political resource / score **-30**. Suggested narrative cost: church gains transitional procedural access and asks for funding / liaison privileges.

Locked shared results after any M02 option:
- The first formal agenda still occurs in this act.
- The theocracy case is still formally accepted and recorded.
- The chamber is still far from fully occupied.

## Flavor-choice rules (no impact)

- `C01` SC01: Olivia’s private remark about the new hall with Finley. 3 options, immediate convergence.
- `C02` SC01: Olivia’s tone when clarifying the church’s one seat. 3 options, immediate convergence.
- `C03` SC03: Olivia’s reply to Saraphenia’s “one” remark. 3 options, immediate convergence.
- `C04` SC05: Olivia’s first spoken reaction to the theocracy case. 3 options, immediate convergence.
- All `C01–C04` write no hidden flags, no political score changes, no relationship changes, and no branch carryover.

## Proposed factual / narrative flags

- `EP08_SACRED_NEW_HALL_OPENED = true`
- `EP08_SACRED_PARLIAMENT_EXPANDED_50 = true`
- `EP08_SACRED_HOLYLIGHT_ONE_SEAT = true`
- `EP08_SACRED_REPRESENTATION_SOURCES_DECLARED = true`
- `EP08_SACRED_NOMINATIONS_INCOMPLETE = true`
- `EP08_SACRED_THEOCRACY_CASE_ACCEPTED = true`
- Major choice record flags:
  - `EP08_SACRED_M01_SELF_NOMINATION` / `EP08_SACRED_M01_ROYAL_REVIEW` / `EP08_SACRED_M01_CHURCH_COORDINATION`
  - `EP08_SACRED_M02_URGENT_WITH_CURRENT` / `EP08_SACRED_M02_MIN_REP_FIRST` / `EP08_SACRED_M02_CHURCH_TRANSITION`
- Suggested narrative tension flag:
  - `EP08_SACRED_CHURCH_ASKS_MORE = true` if either C-option of M01 or M02 is taken.
  - `EP08_SACRED_CHURCH_DOUBLE_DEMAND = true` if **both** M01-C and M02-C are taken. This indicates the church has begun to “ask for everything,” and can be referenced in later acts. This is a proposed production marker, not a locked public reveal.

## Version delta vs startup v1.0

- Original startup Sacred ACT02 described ongoing talks on church/royal authority and parliament restart. Latest user discussion redirects the dramatic center to the **opening ceremony of the new parliament hall** and Olivia’s countermeasure of **expanding the chamber to 50 seats**.
- The new design intentionally dilutes prior concentration by granting only **one formal seat** to the Holy Light Church.
- The hall opens before nominations are complete; empty seats are a deliberate visual motif.
- Two major choices now define play:
  1. how the expanded chamber is prepared;
  2. how it operates before full occupancy.
- A third “yield to church help” option exists in **both** major choices and always costs at least -20, representing the dangerous convenience of letting the church become increasingly demanding.
- The act now opens with ceremony and symbolism, not private follow-up negotiation.

## QA / guardrails

- Only Olivia receives player choices.
- UI must not display score values or hidden effects.
- Do not claim all legal details of representation are settled; precise nomination law remains partly open.
- Do not state or imply that every single individual lord or guild already physically holds a seat in this act; what is fixed is the **representation framework / seat-source guarantee**, while concrete occupancy remains in progress.
- Do not turn the church into cartoon villains; the danger is institutional overreach through convenience and dependence.
- Do not resolve the theocracy case in this act.
