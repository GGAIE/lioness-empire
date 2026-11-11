import { beforeAll, expect, it } from 'vitest';
import { loadReaderContent } from '../../scripts/load-content';
import {
  advance,
  choose,
  continueChapter,
  currentCg,
  initialState,
  markRead,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import { restoreSave } from '../../apps/web-vn/src/storage/saves';

let story: Awaited<ReturnType<typeof loadReaderContent>>;
beforeAll(async () => {
  story = await loadReaderContent();
});

function play(route: 'SACRED' | 'WORLD', answer: string, s3 = true) {
  const end = Object.values(story.scenes).find(
    (scene) =>
      scene.chapter === 'EP07' &&
      scene.act === 'ACT04' &&
      scene.completion &&
      scene.availableWhen &&
      'value' in scene.availableWhen &&
      scene.availableWhen.value === route
  )!;
  let state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
  state.politicalRoute = route;
  state.campaign!.politicalRoute = route;
  state.flags.ALINDA_A2_CLEAR = route === 'SACRED';
  state.flags.S3_CLEAR = s3;
  state.flags.EP07_SACRED_NEGOTIATION_RESULT = 'FULL';
  if (route === 'SACRED') state.clear.alinda = 2;
  state.contentVersion = '0.18.0-ep07-act04.reader-v1';
  delete state.flags.T2_CLEAR;
  delete state.flags.F4_CLEAR;
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  state = continueChapter(story, restoreSave(state, story).state);
  expect(state.currentSceneId).toBe(`EP07_ACT05_SC01_${route[0]}`);
  const images = new Set<string>();
  const text: string[] = [];
  for (let i = 0; i < 100; i++) {
    const scene = story.scenes[state.currentSceneId];
    expect(scene.availableWhen).toEqual({ path: 'politicalRoute', op: 'eq', value: route });
    const segments = visibleSegments(story, state);
    segments.forEach((segment, index) => {
      const image = currentCg(story, { ...state, currentSegmentIndex: index });
      if (image) images.add(image);
      text.push(segment.text);
    });
    state = markRead(story, { ...state, currentSegmentIndex: segments.length - 1 });
    const again = markRead(story, state);
    expect(again.clear).toEqual(state.clear);
    if (scene.kind === 'end') {
      expect(scene.completion).toMatchObject({ scope: 'CHAPTER', nextChapterId: 'EP08' });
      expect(scene.completion?.nextSceneId).toBeUndefined();
      expect(state.readChapters).toContain('EP07');
      expect(state.campaign!.politicalPoints).toBe(50);
      expect(state.campaign!.unrest).toBe(30);
      expect(state.flags.S3_CLEAR).toBe(s3);
      expect(restoreSave(state, story).state.clear).toEqual(state.clear);
      expect([...images].every((id) => id.startsWith(`EP07-ACT05-${route}-`))).toBe(true);
      expect(text.join('\n')).not.toMatch(/ACT0|下一章|本章|^##|\*\*/m);
      return { state, images, text: text.join('\n') };
    }
    if (scene.kind === 'choice') {
      if (scene.choiceMode === 'DIALOGUE_FLAVOR') {
        expect(scene.choices.every((choice) => choice.effects.length === 0)).toBe(true);
        state = choose(story, state, 'A');
      } else state = choose(story, state, answer);
    } else state = advance(story, state);
    state.history = [];
    state.readSegments = [];
  }
  throw Error('No fifth-act ending reached');
}

it('resolves the Sacred joint investigation only after transferring the crystals to Alyssia', () => {
  for (const answer of ['A', 'B', 'C']) {
    const { state, images } = play('SACRED', answer);
    expect(state.flags.T2_CLEAR).toBe(answer === 'C');
    expect(state.flags.F4_CLEAR).toBe(answer === 'C');
    expect(state.clear.tamara).toBe(answer === 'C' ? 2 : 1);
    expect(state.clear.finley).toBe(answer === 'C' ? 2 : 1);
    expect(state.clear.alinda).toBe(2);
    expect(state.flags.ALINDA_A2_CLEAR).toBe(true);
    for (const cg of ['20', '21', '22'])
      expect(images.has('EP07-ACT05-SACRED-' + cg)).toBe(answer === 'C');
    expect(state.flags.EP07_W5_CRYSTALS_SUBLIMATED).toBe(false);
  }
});

it('makes the World visit optional and keeps the successful warehouse investigation independent', () => {
  for (const answer of ['A', 'B', 'C']) {
    const { state, images, text } = play('WORLD', answer, answer !== 'C');
    expect(state.flags.ALINDA_A2_CLEAR).toBe(answer === 'A');
    expect(state.clear.alinda).toBe(answer === 'A' ? 2 : 1);
    expect(state.flags.T2_CLEAR).toBe(true);
    expect(state.flags.F4_CLEAR).toBe(true);
    expect(state.clear.tamara).toBe(2);
    expect(state.clear.finley).toBe(2);
    expect(state.flags.EP07_W5_CRYSTALS_SUBLIMATED).toBe(true);
    for (const n of ['03', '04', '05', '06', '07'])
      expect(images.has('EP07-ACT05-WORLD-' + n)).toBe(answer === 'A');
    expect(images.has('EP07-ACT05-WORLD-08')).toBe(answer === 'B');
    expect(text.includes('我很高興，您今天願意特地過來')).toBe(answer === 'A');
    expect(text.includes('之前的安排還有缺口')).toBe(answer === 'C');
    expect(state.flags.EP07_S5_CRYSTAL_HANDLING).toBe('UNSET');
  }
});
