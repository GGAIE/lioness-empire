# Implementation Notes — Interlude Route Lock and Fourth-Wall Ending

## Scene structure
- `SC01` through `SC06` are all shared narrative content. All flavor choices return to the current scene's next shared beat.
- `SC07` is the only route fork. There is no numerical gain or loss from deciding Sacred or World in the interlude itself.
- Existing characters and flags from earlier chapters should be preserved; do not auto-generate or reset CLEAR values.

## Pseudocode for route decision

```js
const interlude = { abandonCancelled: false };

function chooseMainPath(option) {
  if (option === 'SACRED') return play('SC07_A');
  if (option === 'WORLD') return play('SC07_B');
  if (option === 'ABANDON' && !interlude.abandonCancelled) return play('SC07_C_WALL_BREAK');
}

function onAbandonConfirmation(confirmed) {
  if (confirmed) {
    unlockSpecialEnding('RETURN_TO_TITLE');
    showToast('結局已達成：回主畫面', 'top-right');
    fadeToTitle();
    return;
  }
  interlude.abandonCancelled = true;
  restoreCG('CG27');
  restoreBackgroundMusic();
  play('SC07_C_CANCEL_DIALOGUE');
  showChoices(['SACRED','WORLD']);
}

function onSacredEnd() {
  setRoute('ROUTE_06', 'SACRED');
  playNextChapter('EP07_SACRED');
}

function onWorldEnd() {
  setRoute('ROUTE_06', 'WORLD');
  playNextChapter('EP07_WORLD');
}
```

This is **illustrative pseudocode**, not a drop-in implementation for a specific engine. Avoid auto-saving the special ending over the story save. `abandonCancelled` is local to this scene; do not make it a permanent story flag.

## CG and text synchronization
- CG01–04 SC01; 05–09 SC02; 10–14 SC03; 15–19 SC04; 20–24 SC05; 25–27 SC06; 28–34 SC07 branch alternatives.
- CG32 is displayed IMMEDIATELY upon clicking Abandon; music stops simultaneously.
- CG33 is displayed for the warning/confirmation dialogue.
- CG34 is reserved for the confirmed special ending. Overlay a brief top-right UI toast separately.
- If cancellation is chosen, display CG27 FIRST, then normal dialogue. Finally show only Sacred and World choices.
- Sacred: use CG28–29. World: use CG30–31. Abandon: use CG32–34 as appropriate.
- Characters in historical montage CG15–24 should not imply they were physically present centuries earlier.

## Wording and continuity
- The older project files may use variant spellings of Olivia / Miyel. This script follows the most recent conversation standard for dialogue and makes no change to character identities.
- Route 'World' is a governing coalition choice, NOT the separate later Tower crisis/route.
- There is no true third shared lead; unselected group still exists and participates in the world.
