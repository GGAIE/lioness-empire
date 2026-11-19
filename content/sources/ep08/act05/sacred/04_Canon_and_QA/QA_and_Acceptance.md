# Production QA and acceptance gate

## Completed checks in package creation

- [x] Five scenes present in complete traditional-Chinese VN script; ten flavor choices (FL01–FL10), each with three reaction options
- [x] Finley F5 A/B +1, C +0, no reset of prior F status
- [x] P01 4-entry, P02 3-way, P03 3-way: exactly 36 unique choice triplets
- [x] All seven tiers reachable, one and only one T6 major failure path
- [x] 32 numbered separate CG prompts, mapped by scene/outcome in JSON and CSV
- [x] Mier independent front/side/back sheet present; Alicia user's own three-view source and PNG copy present
- [x] Source originals available; clear distinction source/turnaround/prompt vs finished event CG
- [x] Zip and file hashes checked upon packaging

## Codex import acceptance (NOT done by this package)

- [ ] Implement five scenes in actual target engine with player choices restricted to Olivia
- [ ] P01 branches alter SC03 proposal language; P02 alters SC04 follow-up language
- [ ] F5 awarded once after save/load and never added twice via replay
- [ ] P01/P02/P03 political totals committed once at end of SC05
- [ ] Unrest clamped 0..100, EP09 opening charge not applied at ACT05 ending
- [ ] Political points low-resource behavior defers to current approved global rules
- [ ] All 36 test vectors return expected result; do not accidentally grant +30 on wrong routes
- [ ] T6 uniquely occurs with D + EXPAND + STANDING
- [ ] No actual signed treaty and no early Star/Tower lock

## Art project acceptance (NOT done by this package)

- [ ] User visually approves new Mier turnaround and any differences from blonde reference
- [ ] All 32 scene CGs generated as independent 16:9 files and named correctly
- [ ] Eye/hair/ribbon/robe identity consistent for Mier and Alicia
- [ ] Characters with visible hands and head positions physically correct
- [ ] Olivia never crowned; Finley all-human; Alicia never swapped with Elia
- [ ] Map/paper glyphs are illegible, no watermark or text
- [ ] CG25–CG31 exactly represent distinct outcome tiers
- [ ] Asset manifest marked approved only after art is created and human-reviewed

## Known limitations

- Story dialogue is a **new complete draft** written from latest outline, not already-approved official lines.
- Original Mier source picture is an outdoor scene and NOT part of ACT05 narrative CG set.
- Source first image is not a usable official Olivia turnaround.
- All 32 event CGs remain **PROMPT_ONLY**. No hidden placeholder duplicates.
