import { expect, test, type Page } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import {
  advance,
  choose,
  initialState,
  markRead,
  visibleSegments,
} from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';
test.setTimeout(90000);
async function prepare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
test('continues old fourth-act saves, loads both image editions and lists the November 18 changes', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await prepare(page);
  await page.getByRole('button', { name: /更新日誌 FINLEY2026\.11\.19/ }).click();
  await expect(page.getByRole('dialog')).toContainText('56 張 CG');
  await expect(page.getByRole('dialog')).toContainText('82 段');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const end = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP08' &&
        s.act === 'ACT04' &&
        s.completion &&
        s.id.startsWith(`EP08_ACT04_SC05_${route[0]}`)
    )!;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.campaign!.politicalPoints = 100;
    for (const code of ['M01', 'M02', 'M03', 'M04']) state.flags['EP08_S4_' + code] = 'A';
    for (const code of ['N01', 'N02', 'P01', 'P02']) state.flags['EP08_W4_' + code] = 'A';
    state.contentVersion = '0.23.0-ep08-act04.reader-v1';
    for (const [key, def] of Object.entries(story.manifest.flags))
      if (def.description?.includes('第八章第五幕')) delete state.flags[key];
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page.getByRole('button', { name: '進入第五幕 →', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP08_ACT05_SC01_${route[0]}`
    );
    const cg = page.getByTestId('scene-cg');
    await expect(cg).toHaveAttribute(
      'src',
      new RegExp(`/act05/${route.toLowerCase()}/cg01\\.webp`)
    );
    await expect
      .poll(() => cg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      '100'
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.screenshot({
      path: `test-results/ep08-act05-${route}-${info.project.name}.png`,
      animations: 'disabled',
    });
  }
});
test('shows seven Sacred outcomes and preserves the same settlement after reloading', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await prepare(page);
  for (const [tier, picks, pp, unrest] of [
    [0, ['A', 'A', 'A', 'A'], 130, 45],
    [1, ['A', 'B', 'B', 'B'], 120, 40],
    [2, ['A', 'C', 'B', 'B'], 110, 35],
    [3, ['A', 'C', 'C', 'B'], 100, 25],
    [4, ['A', 'D', 'B', 'B'], 90, 20],
    [5, ['A', 'D', 'C', 'B'], 75, 10],
    [6, ['A', 'D', 'C', 'C'], 60, 0],
  ] as const) {
    let state = initialState({
      ...story,
      manifest: { ...story.manifest, start: 'EP08_ACT05_SC01_S' },
    });
    state.politicalRoute = 'SACRED';
    state.campaign!.politicalRoute = 'SACRED';
    state.campaign!.politicalPoints = 100;
    let index = 0;
    for (let turn = 0; turn < 180; turn++) {
      const scene = story.scenes[state.currentSceneId];
      state.currentSegmentIndex = visibleSegments(story, state).length - 1;
      if (scene.id.endsWith('_RESULT_T' + tier)) break;
      state = markRead(story, state);
      state =
        scene.kind === 'choice'
          ? choose(story, state, scene.choiceMode === 'DIALOGUE_FLAVOR' ? 'A' : picks[index++])
          : advance(story, state);
      state.history = [];
      state.readSegments = [];
    }
    expect(index).toBe(4);
    await importPlayerState(page, state);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`/sacred/cg${22 + tier}\\.webp`)
    );
    const hud = page.locator('.shell > .resource-hud');
    await expect(hud.getByTestId('political-points')).toHaveText(String(pp));
    await expect(hud.getByTestId('unrest-value')).toHaveText(`${unrest} / 100`);
    await importPlayerState(page, markRead(story, state));
    await expect(hud.getByTestId('political-points')).toHaveText(String(pp));
  }
});
test('keeps World travel branches exclusive, completes the chapter and indexes 30 plus 17 CGs', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await prepare(page);
  for (const answer of ['A', 'B']) {
    let state = initialState({
      ...story,
      manifest: { ...story.manifest, start: 'EP08_ACT05_SC01_W' },
    });
    state.politicalRoute = 'WORLD';
    state.campaign!.politicalRoute = 'WORLD';
    state.campaign!.politicalPoints = 100;
    let seenBranch = false;
    for (let turn = 0; turn < 160; turn++) {
      const scene = story.scenes[state.currentSceneId];
      if (!seenBranch && scene.sceneNumber === 4) {
        await importPlayerState(page, state);
        await expect(page.getByTestId('scene-cg')).toHaveAttribute(
          'src',
          new RegExp(`/world/cg06${answer}\\.webp`)
        );
        seenBranch = true;
      }
      state = markRead(story, {
        ...state,
        currentSegmentIndex: visibleSegments(story, state).length - 1,
      });
      if (scene.kind === 'end') break;
      state =
        scene.kind === 'choice'
          ? choose(
              story,
              state,
              scene.choiceMode === 'DIALOGUE_FLAVOR'
                ? 'A'
                : scene.id.includes('SC03')
                  ? answer
                  : 'B'
            )
          : advance(story, state);
      state.history = [];
      state.readSegments = [];
    }
    expect(seenBranch).toBe(true);
    await importPlayerState(page, state);
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
      '第八章完 · People Have the Power'
    );
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
      '第九章〈Waiting for the End〉'
    );
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      '100'
    );
  }
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('章節', { exact: true }).selectOption('EP08');
  await dialog.getByLabel('幕', { exact: true }).selectOption('ACT05');
  for (const [route, count] of [
    ['SACRED', 30],
    ['WORLD', 17],
  ] as const) {
    await dialog.getByLabel('路線', { exact: true }).selectOption(route);
    await expect(dialog.getByRole('status').filter({ hasText: /^共/ })).toContainText(
      `共 ${count} 張`
    );
  }
  await page.screenshot({
    path: `test-results/ep08-act05-gallery-${info.project.name}.png`,
    animations: 'disabled',
  });
});
