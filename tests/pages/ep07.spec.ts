import { test, expect } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';
import { readFile } from 'node:fs/promises';
import { root } from '../../scripts/load-content';

test('uploaded EP06 text matches local content and all 79 new CG files exist', async ({
  request,
}) => {
  const story = await loadReaderContent();
  const response = await request.get('/github-pages/content/episodes/ep06/chapter.json');
  expect(response.ok()).toBe(true);
  const uploaded = await response.json();
  for (const scene of uploaded.scenes) {
    expect(scene.title).toBe(story.scenes[scene.id].title);
    expect(scene.segments).toEqual(story.scenes[scene.id].segments);
    expect(scene.choices).toEqual(story.scenes[scene.id].choices);
  }
  expect(uploaded.scenes.filter((s: { interlude?: boolean }) => !s.interlude)).toHaveLength(153);
  const assets = JSON.parse(
    await readFile(`${root}/github-pages/content/manifests/assets.json`, 'utf8')
  );
  const added = assets.filter((a: { id: string }) => a.id.startsWith('EP07-'));
  expect(added).toHaveLength(79);
  for (const asset of added) {
    const image = await request.get('/github-pages/' + asset.src);
    expect(image.status(), asset.id).toBe(200);
    expect((await image.body()).subarray(0, 4).toString()).toBe('RIFF');
    await image.dispose();
  }
});

test('interlude cancellation resumes music and special ending preserves the story save', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const story = await loadReaderContent();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP06_ACT06_SC07' },
  });
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  state.campaign!.politicalPoints = 100;
  state.readChapters = ['EP06'];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await importPlayerState(page, state);
  await page.getByRole('button', { name: '背景音樂', exact: true }).click();
  await page.getByRole('combobox', { name: '選擇背景音樂' }).selectOption({ index: 1 });
  await expect(page.getByRole('status', { name: '背景音樂播放狀態' })).toHaveText('播放中');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const dialogue = page.getByRole('button', { name: '推進對話', exact: true });
  const frame = page.locator('.game-frame');
  async function untilChoice(label: RegExp) {
    for (let i = 0; i < 30 && !(await page.getByRole('button', { name: label }).count()); i++) {
      await dialogue.click();
    }
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
  await page.getByRole('button', { name: /算了，我不想玩了/ }).click();
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /CG32\.webp/);
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((a: HTMLAudioElement) => a.paused)
    )
    .toBe(true);
  await untilChoice(/取消，繼續遊戲/);
  await page.getByRole('button', { name: /取消，繼續遊戲/ }).click();
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /CG27\.webp/);
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((a: HTMLAudioElement) => a.paused)
    )
    .toBe(false);
  await untilChoice(/我明天去找米耶爾/);
  await expect(page.getByRole('button', { name: /算了，我不想玩了/ })).toHaveCount(0);
  await importPlayerState(page, state);
  await page.getByRole('button', { name: /算了，我不想玩了/ }).click();
  await untilChoice(/確定，我不玩了/);
  await page.getByRole('button', { name: /確定，我不玩了/ }).click();
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /CG34\.webp/);
  for (let i = 0; i < 3; i++) await dialogue.click();
  await expect(page.getByRole('button', { name: '開始遊戲', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('結局已達成〈回主畫面〉');
  await page.getByRole('button', { name: '繼續遊戲', exact: true }).click();
  await expect(frame).toHaveAttribute('data-scene-id', 'EP06_ACT06_SC07');
  await expect(page.getByRole('button', { name: /算了，我不想玩了/ })).toBeVisible();
  await page.screenshot({ path: `test-results/ep07-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('EP07 route-exclusive art and titles load from the root publishing folder', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await page.goto('/');
  for (const route of ['SACRED', 'WORLD'] as const) {
    const id = `EP07_ACT02_SC05_${route[0]}`;
    const scene = Object.values(story.scenes).find(
      (s) => s.id.startsWith(id) && s.segments.some((p) => p.cg === `EP07-ACT02-23${route[0]}`)
    )!;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.currentSegmentIndex = visibleSegments(story, state).findIndex(
      (p) => p.cg === `EP07-ACT02-23${route[0]}`
    );
    await importPlayerState(page, state);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`CG23${route[0]}\\.webp`)
    );
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty('complete', true);
    await expect(page.locator('.dialogue-wrap')).toBeVisible();
  }
});
