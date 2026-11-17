# EP08 Sacred ACT03 v1.1 — scene and flag / CG production index

## Scope / canon status
- Based on previous ACT03 draft, this conversation's latest user decisions, and the included EP08 startup source documents.
- `DRAFT`: all dialogue and precise ritual details are proposed original writing for review, not APPROVED established canon.
- Fixed decisions: Lava Cat crisis in **卡巴剛得 / Valken territory**; a native tribe venerates Lava Cat; old covenant has no active bearer; **奧瑞亞** voluntarily takes over; **艾琳達 and her companions** solve field crisis; Holy Light attempts organized "感化" to gain local influence; Olivia chooses whether to protect local lord's jurisdiction.
- Older startup detail "Lava Cat deceived" is *not overdefined*: identity and content of historical deception remain OPEN. This script allows rumors of mismatched promises, without confirming who deceived whom or precise cost.
- Holy Light in this act is an institution with genuine relief services but inappropriate political ambitions, not uniformly malicious or magically incompetent people.
- **All player choices belong to Olivia.** Alinda and Aurea may act and speak but never present player controls.

## Scene mapping
| Scene | Function | Common CG | Variable CG | Choices |
|---|---|---|---|---|
| SC01 | Urgent report, Holy Light proposes guidance | CG01, 02, 13 | — | Flavor C01, C02 |
| SC02 | Alinda protests church intervention; first authorization | CG03, 14 | — | Major M01; flavor C03, C04 |
| SC03 | Tribe, Aurea, incomplete covenant; investigation authority | CG04, 05, 06, 15 | — | Major M02; flavor C05 |
| SC04 | Sanctuary, Aurea chooses to inherit; Lava Cat calmed | CG07–10, 16, 21 | — | Flavor C06 |
| SC05 | Post-crisis authority decision and four outcomes; return to tower | CG11, 12, 22–24 | CG17/18/19/20 (exactly one) | Major M03; flavor C07–C11 |

## Effect matrix
**Important:** M01/M02/M03 scores are **not** charged individually. They are inputs to a single result resolver at the end of SC05, to prevent double counting.

M01: A = church and Valken negotiate; B = Olivia explicitly bars unilateral church intervention; C = permits church guidance (overreach incurred).  
M02: A = local-led inquiry; B = church witness only; C = church may guide inheritance (overreach incurred).  
M03: A = final negotiated boundary; B = final royal formal boundary; C = permanent church guidance/outpost.

Resolver priority:
1. M03=C ⇒ **BIG_FAILURE**.
2. Else if M01=C or M02=C: M03=B ⇒ **SMALL_FAILURE** (late rescission); M03=A ⇒ **BIG_FAILURE** (no adequate cure).
3. Else (M01 and M02 are A/B): (M01=B and M02=A and M03=B) ⇒ **BIG_SUCCESS**; any other combination ⇒ **SMALL_SUCCESS**.

| Outcome | Political delta | Alinda CLEAR | Narrative |
|---|---:|---:|---|
| BIG_SUCCESS | +10 | +1 | Local authority clearly protected throughout, kingdom-level boundary issued |
| SMALL_SUCCESS | 0 | +1 | No substantial overreach, working negotiation or limited witnesses |
| SMALL_FAILURE | -10 | 0 | Earlier church overreach formally rescinded but trust damaged |
| BIG_FAILURE | -30 | 0 | Church empowered or prior intrusion left inadequately remedied |

- `Choice_Resolver_v1.1.json` enumerates **all 27 combinations** and their result CG, preventing unreachable or arbitrary results.
- `ALINDA_CLEAR` refers to this act's single new character milestone; it does **not** erase old CLEAR and must **not be counted again** if EP08 A3 is independently awarded later. For exact A3 gate and point cap, check episode/character system integration.
- Political resource +10 must have a cost-bearer (Valken local administration shoulders ongoing jurisdictional and mediation work). The resulting unrest delta is not locked, so marked `UNREST_DELTA_TBD` for systems integrators.
- If political-resource balance is insufficient for -30/-10, the failure/resolution mechanic is `SYSTEM_RULE_OPEN`, not automatically game over.

## Story flags (proposed)
- `EP08_SACRED_LAVACAT_RESOLVED = true` (all outcomes)
- `EP08_SACRED_AUREA_COVENANT_BEARER = true` (all outcomes)
- `EP08_SACRED_ALINDA_FIELD_RESPONSE = true` (all outcomes)
- `EP08_SACRED_CHURCH_GUIDANCE_ATTEMPT = true` (all outcomes)
- `EP08_SACRED_CHURCH_OVERREACH_EARLY = (M01=='C' or M02=='C')`
- `EP08_SACRED_FORMAL_LOCAL_BOUNDARY = (M03=='B')`
- `EP08_SACRED_RESULT = BIG_SUCCESS|SMALL_SUCCESS|SMALL_FAILURE|BIG_FAILURE`
- `EP08_SACRED_VALKEN_DISSATISFACTION = result in (SMALL_FAILURE,BIG_FAILURE)`
- `EP08_SACRED_ALINDA_EVENT_CLEAR_GRANTED = result in (BIG_SUCCESS,SMALL_SUCCESS)`

## 11 flavor choices: C01–C11
Each is voiced by **Olivia** and immediately rejoins the same dialogue and plot state, no counters or hidden character tendencies. C04/M02/C06/C07/C08 are distributed between major decisions so major choices do not appear as the only selectable prompts. In scenes where Alinda has independent POV, her dialogue is **not selectable**; Olivia options appear via properly staged messages / report decisions.

## ACT01–ACT05 continuity
- ACT01: Olivia confronted Saraphenia over ambiguous dual dealings; no treaty, then chalk-teleported back to northeast tower.
- ACT02: newly built fifty-seat parliament was inaugurated; Holy Light one statutory seat; nominations incomplete, at least one representational seat per source category including lords/cities/guilds/academy; the theocracy fugitive case was registered, **not resolved**.
- ACT03: events demonstrate a new jurisdictional conflict; regardless of player route, Alinda and her companions and Aurea solve the Lava Cat crisis, not the Holy Light or academy.
- ACT04 Sacred: cold/ice guardian successfully manifests after completed summoning; **Alicia** (艾莉西亞), in capital, saves the situation. Do not conflate with absent Elia (艾莉).
- ACT05 Sacred: Olivia and Alicia return to Holy Light capital and argue with Saraphenia over actual disaster response capability. ACT03 result must change what Olivia may credibly accuse the Church of; if she herself authorized church overreach, do not let her pretend she never authorized it.

## CG pack
- 24 English standalone prompts, including 4 alternative Result Scene CGs (17–20); one **generated** Aurea three-view sheet.
- 24 prompts do **not** mean 24 generated event CG files.
- Characters need consistent independent references in actual generation. Only Aurea's three-view is included here.
- All story CGs 16:9, no legible text in documents, no modern objects, no crown on Olivia.
