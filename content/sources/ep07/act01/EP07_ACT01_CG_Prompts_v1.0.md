# Lioness Empire — EP07 ACT01 CG Production Prompts

**Production draft v1.0** | Total: **20 CG prompts** | 12 COMMON + 4 SACRED + 4 WORLD | 16:9 premium Japanese visual novel event CG | No images are included in this ZIP.

## Global visual bible / rules

- Art style: dark political fantasy, elegant high-end hand-painted Japanese visual novel illustration, nuanced cinematic lighting, historically inspired fantasy architecture, believable fabrics, restrained expressions, 16:9 landscape composition, no split-screen unless explicitly described.
- No readable text on papers, signs, ledgers, maps, seals or walls; no UI overlays, captions, speech bubbles, watermarks, logos, extra limbs, malformed fingers, rotated heads, merged bodies or floating objects. Hands anatomically accurate, five fingers when visible, natural limb placement. No character clones in crowd.
- **Olivia:** adult regent, waist-length straight blue-black hair, amber-gold eyes, pale skin, deep navy / antique gold / ivory court dress, lion signet ring, Ogan pendant, NO crown. She is not the reigning queen yet.
- **Finley:** slight and androgynous scholarly/administrative companion, fully human appearance (no horns, scales, dragon eyes, pointed ears, wings or tail); match existing reference sheets for face and hair, dark/navy administrative attire. Permanent secretary seal only if `FINLEY_SECRETARY_SEAL` state is true; do not imply it is held in default no-seal shots.
- **Tamara:** mature female commander of Second Knight Order, indigo and silver military outfit, practical short cloak and guard accessories; match existing character references. Name aliases 塔馬拉／塔瑪拉／塔娜拉 refer to same character.
- **Alinda:** adult 26-year-old female Sixth Knight Order commander, low ash-blonde ponytail, steel blue eyes, navy traveling light armor with Shield of Split Light insignia; no debilitating injuries invented; previous local disaster involves partial landslide, not annihilation.
- **Shalia:** adult Third Knight Order female commander and territorial lord, distinctive forest-green military attire, braided low bun; dignity, pragmatic care, no automatic fealty.
- **Miyel:** Sacred route: blonde woman associated with Holy Light Church; use user's existing blonde-woman reference if available, avoid inventing definitive costume features over reference. Church delegation in ivory/gold restrained vestments.
- **Ayla Gravitz:** World route: adult red-haired witch/scholar/political broker; preserve the reference red-haired woman's exact facial appearance from existing art where available, elegant academic-political dress, not a generic priestess. NOT present in Sacred-exclusive images.
- **Northeast Tower:** an established lived-in regal magic-research tower. Its magical access wards were created from Finley's older individual research; magical guardians were adapted from Olivia and Finley's joint research. Preserve existing ward/guardian colors from earlier approved project CG references; **do not invent a new canonical hue** where source art is unavailable. Wards operate independently of Tamara's office and block her while owner is absent.
- **Royal Palace Grand Hall != council chamber.** The Grand Hall's original public passage/reception function is restored. Do not stage a sitting parliament, assembly debate or formal council session in the Grand Hall.
- Use existing official character and location visual references when generating actual images. These prompts are text-only; precise faces, clothing and magic hues must be matched to existing visuals rather than derived from prose alone.

## Prompt index

| ID | Scene | Route | Composition | Story beat |
|---|---|---|---|---|
| C01 | SC01 introduction | COMMON | Wide architectural | Palace morning and reforms |
| S01 | SC01 | SACRED | Two-shot | Olivia and Miyel short meeting |
| W01 | SC01 | WORLD | Two-shot | Olivia and Ayla short meeting |
| C02 | SC02 | COMMON | Wide | Clear Grand Hall, old marks |
| C03 | SC02 | COMMON | Hero wide | Olivia ends redundant offices |
| S02 | SC02 | SACRED | Medium wide | Church witness |
| W02 | SC02 | WORLD | Medium wide | Ayla and transfer lists |
| S03 | SC03 | SACRED | Crowd wide | Officials protest, church comforts |
| S04 | SC03 | SACRED | Character wide | Calming protest, no restored office |
| W03 | SC03 | WORLD | Crowd wide | Political bargaining chaos |
| W04 | SC03 | WORLD | Still life / two-shot | Compromise lists remain |
| C04 | SC03 ending | COMMON | Wide | Empty hall, political aftermath |
| C05 | SC04 | COMMON | Wide | Alinda and medical road |
| C06 | SC04 | COMMON | Wide | Shalia and refugees |
| C07 | SC04 | COMMON | Medium | Finley's two reports |
| C08 | SC04 conditional | COMMON / SEAL ONLY | Detail | Secretary seal and records |
| C09 | SC05 | COMMON | Wide | Tamara waiting outside tower |
| C10 | SC05 | COMMON | Wide | Olivia arriving, wards open |
| C11 | SC05 | COMMON | Medium | Incomplete aid letter |
| C12 | SC05 | COMMON | Detail wide | Unfinished ledger, night end |

**Count validation:** C01–C12 = 12; S01–S04 = 4; W01–W04 = 4. Note C08 only plays when the permanent seal is held; without it reuse C07 or insert a neutral paper closeup rather than falsely showing the seal.

---

### CG C01 — Morning of Reform
**Route:** COMMON · **Scene:** SC01 intro · **Format:** 16:9

**Prompt (EN):** Wide establishing shot of the royal palace interior corridor at morning, warm pale sunlight falling onto carved arches and lion motifs, attendants carrying closed document boxes away from the grand hall, no readable markings, in the midground adult regent Olivia with waist-length straight blue-black hair, amber gold eyes, elegant deep navy and muted antique gold attire, lion signet ring, Ogan pendant, no crown, walking with a slim administrative ledger; quiet atmosphere of bureaucratic change rather than triumph, realistic palace scale, sophisticated dark political fantasy, premium Japanese visual novel event CG, painterly cinematic lighting, detailed believable anatomy, 16:9, no readable text, no watermark.

### CG S01 — Sacred: Last Confirmation
**Route:** SACRED ONLY · **Scene:** SC01

**Prompt (EN):** Intimate yet formal morning conversation in a small royal palace audience room, adult blue-black-haired regent Olivia seated opposite Miyel, a blonde Holy Light Church-affiliated woman matched to supplied reference, Miyel holds a thin folder of non-legible administrative papers, a modest church scribe in the distant background, clear spatial hierarchy with Olivia as authorized regent, soft daylight and subtle gold/ivory church colors, not a coronation, sophisticated political tension, high-end hand-painted anime visual novel CG, cinematic 16:9, no readable text or extra fingers.

### CG W01 — World: Short Negotiation
**Route:** WORLD ONLY · **Scene:** SC01

**Prompt (EN):** Adult regent Olivia in blue-black hair and navy-gold attire holding a short consultation with Ayla Gravitz, distinctive adult red-haired woman matching provided reference portrait, scholarly political broker wearing sophisticated non-religious fantasy academic clothes, a few overlapping anonymous staff-transfer sheets on the table, Ayla's expression clever but measured, warm light on copper-red hair, no priestess and no Holy Light Church delegation, nuanced character acting, premium Japanese visual novel 16:9 cinematic painted CG, no readable words or deformities.

### CG C02 — The Grand Hall Revealed
**Route:** COMMON · **Scene:** SC02

**Prompt (EN):** Epic spacious royal palace GRAND HALL newly freed from improvised redundant office cubicles, tall carved stone columns and high windows revealed for the first time in years, pale scuff marks where desks and partitions once stood, one attendant carrying away the last sealed file box, grand empty reception and passage space, not a council chamber and no parliamentary benches, quiet sense of institutional restoration, soft sun rays and fine dust, architectural visual storytelling, dark political fantasy Japanese visual novel event art, 16:9, no readable text.

### CG C03 — Formal End of Redundant Offices
**Route:** COMMON · **Scene:** SC02

**Prompt (EN):** Regal wide interior of an open royal palace grand hall, Olivia standing at a modest central point before a restrained group of palace clerks, attendants and guards, announcing the definitive termination of previously suspended redundant administrative offices, she is a regent with no crown, people listen with mixed expressions, documents blank or abstract marks, grand hall remains a public circulation and reception space rather than a council hall, golden shafts of daylight, composed high-end cinematic painted Japanese VN event illustration, 16:9, correct hands and limbs.

### CG S02 — Sacred Witnesses the Announcement
**Route:** SACRED ONLY · **Scene:** SC02

**Prompt (EN):** In the newly cleared royal palace grand hall, Miyel in blonde hair and understated Holy Light Church ivory-gold vestments stands to one side with a small relief aide recording displaced workers, Olivia visible at a respectful distance as the official authority, worried former clerks listening, no parliamentary meeting, restrained humanitarian politics, warm gold and desaturated stone palette, detailed hand-painted Japanese visual novel CG 16:9, no readable text, no signs or logos.

### CG W02 — World Transfer Lists
**Route:** WORLD ONLY · **Scene:** SC02

**Prompt (EN):** In the newly cleared palace grand hall, red-haired Ayla Gravitz matching reference appearance hands abstract personnel transfer documents to clerks, several officials scrutinize anonymized sheets with skeptical facial expressions, no readable text or labels, Olivia visible in the scene as regent, polished professional but tense mood, no Holy Light Church delegation, court bureaucracy restructured without restoring offices, cinematic high-end fantasy anime VN CG 16:9, accurate anatomy.

### CG S03 — Sacred Protest and Relief
**Route:** SACRED ONLY · **Scene:** SC03

**Prompt (EN):** Outside the grand hall, small but emotionally credible gathering of displaced bureaucrats and families, a middle-aged former clerk holds a folded blank termination sheet, blonde Miyel and discreet Holy Light Church relief staff listen to concerns, Olivia observes with responsibility instead of contempt, peaceful protest without violence or armed crackdown, diverse individual expressions, politically nuanced dark fantasy Japanese VN scene, 16:9, no readable protest slogans, no distorted hands.

### CG S04 — The Crowd Subsides
**Route:** SACRED ONLY · **Scene:** SC03 result

**Prompt (EN):** Documentary-feeling medium wide view of displaced officials entering an orderly temporary aid or appeal queue outside the palace grand hall, Miyel discussing transparent handover with royal staff, Olivia watches as anxious crowd gradually thins without instant happiness, the closed redundant offices stay closed, humane restrained relief atmosphere, elegant painted Japanese visual novel illustration, cinematic 16:9, indistinct markings on papers, no readable text.

### CG W03 — World Negotiations in Disorder
**Route:** WORLD ONLY · **Scene:** SC03

**Prompt (EN):** Organized chaos at the entrance to the newly cleared palace hall, groups of former bureaucrats, administrators and petitioners arguing over personnel transfers and benefits, red-haired political broker Ayla Gravitz in center trying to coordinate overlapping demands, Olivia nearby listens carefully, many scattered abstract papers and strained emotions but no violence, different people not cloned, no church delegation, visual theme political deal-making spinning out of control, premium cinematic Japanese fantasy VN CG 16:9, correct human anatomy.

### CG W04 — The Price of Compromise
**Route:** WORLD ONLY · **Scene:** SC03 result

**Prompt (EN):** Close two-shot of regent Olivia and red-haired Ayla in a palace antechamber beside neat but numerous administrative agreement sheets with blank scribble-like marks, conflicting people departing through background doors, Ayla tired but alert, Olivia contemplative, show that political cooperation has been secured at the cost of future obligations, retain grand hall reform completed, no readable text, nuanced high-end painterly Japanese VN CG, 16:9, correct hands.

### CG C04 — Reform Aftermath
**Route:** COMMON · **Scene:** SC03 ending

**Prompt (EN):** Quiet contemplative wide view of restored royal palace grand hall after an eventful afternoon, late sunlight across exposed old columns and polished floors, Olivia standing at side in deep navy court clothing, her back partially to camera, a few people moving off-frame in the distance, no route-specific religious or academic delegation, visual motif that empty spaces do not erase political debts, premium dark political fantasy VN event CG, cinematic 16:9, no readable markings.

### CG C05 — Alinda at the End of the Road
**Route:** COMMON · **Scene:** SC04 Alinda POV NO CHOICE

**Prompt (EN):** Outside a makeshift Sixth Knight Order medical station in Cabagand after a LOCALIZED landslide, Alinda Valeria Valken adult 26 female officer with ash-blonde low ponytail, steel-blue eyes, naval blue light armor with shield insignia, watching medics carefully transfer patients across a narrow repaired muddy road, damaged slope in background not an entire destroyed province, rain-damp earth and modest medical tents, compassion and grit rather than gore or heroic posturing, premium Japanese dark fantasy visual novel illustration, cinematic 16:9, no readable text, anatomical accuracy.

### CG C06 — Shalia's Shelter Burden
**Route:** COMMON · **Scene:** SC04 Shalia POV NO CHOICE

**Prompt (EN):** Third Knight Order territorial refugee lodging and supply distribution, mature noble commander Shalia with forest-green attire and braided low bun studying abstract supply records alongside a local quartermaster, refugees including Rouenne exiles quietly sorting belongings and waiting for bread and shelter, scene respectful and realistic, do not depict forced repatriation or guarantee shelter in all save states, nuanced responsibility of a local lord, high-end painted anime fantasy VN CG 16:9, no readable text.

### CG C07 — Finley's Two Reports
**Route:** COMMON · **Scene:** SC04 palace study

**Prompt (EN):** Inside Olivia's private royal palace study, fully human androgynous administrator Finley wearing understated dark navy attire arranges two different abstract reports on a table, one with medical-road sketches and one with lodging inventories, Olivia with amber eyes and blue-black long hair studies both, practical candles and late afternoon light, do not show a permanent royal secretary seal in this base image, emphasis on incomplete but responsible evidence, dark political fantasy premium Japanese VN 16:9, no legible writing or watermarks.

### CG C08 — Conditional Secretary Seal
**Route:** COMMON but **ONLY IF FINLEY_SECRETARY_SEAL = TRUE** · **Scene:** SC04

**Prompt (EN):** Close detail shot of fully human Finley's hand using an already authorized permanent royal secretary seal beside two abstract administrative dossiers in Olivia's study, seal design matched to the prior approved in-project reference, document contents indecipherable, Olivia's lion signet hand visible at opposite edge without confusing it with the secretary seal, warm lamp and crisp paper textures, credible exactly-two-people hand positions and five fingers, premium painterly dark political fantasy VN cinematic 16:9, no readable letters, no watermark. DO NOT USE in no-seal branch.

### CG C09 — Tamara Waits at the Northeast Tower
**Route:** COMMON · **Scene:** SC05

**Prompt (EN):** Northeast Tower entrance near sunset, Tamara mature female Second Knight Order commander in indigo and silver garments and functional short cloak waiting respectfully outside a securely shut magical doorway, two calm duty guards refuse unauthorized entry without hostility, subtle pre-existing ward sigils emitting the SAME COLOR AS EARLIER PROJECT APPROVED MAGIC DOOR ART, no invented fixed hue, Olivia absent from this shot, quiet windy stone walkway, premium cinematic hand-painted Japanese visual novel CG 16:9, no readable inscriptions.

### CG C10 — The Owner Returns
**Route:** COMMON · **Scene:** SC05

**Prompt (EN):** Adult Olivia blue-black long hair and navy-gold regent clothes arrives at the Northeast Tower and greets Tamara, guards maintain disciplined posts, old established magical ward begins to allow authorized passage only after Olivia's return, same existing art reference ward color and arcane geometric language, mood warm familiar but professional, no forceful entry, no renewed politics of the grand hall, high-end cinematic Japanese fantasy visual novel CG 16:9, anatomically correct bodies, no text.

### CG C11 — The Incomplete Appeal
**Route:** COMMON · **Scene:** SC05 tower ground-floor meeting area

**Prompt (EN):** Ground-floor consultation area inside Northeast Tower, Olivia, Tamara, and fully human Finley examining a sparse incomplete border transport distress report spread on a round or modest meeting table, blank portions and torn chain-of-custody edges but NO legible writing, Tamara points at an uncertain handover spot and Finley compares abstract received-copy marks, no contraband visible, no magical goods or smuggler revealed, no Ayla, dim evening atmosphere, elegant dark political fantasy Japanese VN event painting, cinematic 16:9, hands correctly placed.

### CG C12 — The Empty Spaces in the Ledger
**Route:** COMMON · **Scene:** SC05 ending

**Prompt (EN):** Cinematic quiet detail of an unfinished palace tower receipt ledger on a wood desk after nightfall, empty spaces and anonymous wax seals, a folded incomplete distress paper, distant silhouette of Olivia looking toward the tower's dark window, faint approved-color magical ward light in background, no actual smuggled magical items and no identity revealed, suggest investigation only beginning, moody premium Japanese dark fantasy visual novel event CG, 16:9, no readable text, no watermark.

---

## CG QA and route-delivery checklist

1. Set `ROUTE_06` before loading images. Sacred only receives S01–S04 plus common images; World only receives W01–W04 plus common images.
2. C08 is conditional on existing `FINLEY_SECRETARY_SEAL`; otherwise reuse C07 and do not show a seal on Finley.
3. S01, S02, S03, S04 require verified Miyel reference; W01–W04 require the user's red-haired Ayla reference. Do not silently substitute a newly invented face and call it canonical.
4. C09/C10 ward colors must be pulled from existing project CGs at actual generation time. This prompt file intentionally does not invent the hue.
5. No image should show an actual smuggled object, a named culprit or a magical academy provenance. T2/F4 are only opened, not solved, in ACT01.
6. In C05 local landslide aftermath is bounded; in C06 shelter details reflect actual S1 save-state, not forced universal canon.
7. Check all visible hands, fingers, number of arms, face orientation, neck rotation, crowd duplicates, costume continuity, eye colors, and absence of readable text.
8. Reuse C02/C03 across routes where possible; render branch-exclusive CG only for chosen route in-game.
