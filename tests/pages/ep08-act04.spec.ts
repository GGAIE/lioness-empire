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
test('continues both old third-act saves with the matching fourth act and no extra upkeep', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await prepare(page);
  await page.getByRole('button', { name: /更新日誌 FINLEY2026\.11\.19/ }).click();
  await expect(page.getByRole('dialog')).toContainText('70 張 CG');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const end = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP08' &&
        s.act === 'ACT03' &&
        s.completion &&
        s.id.startsWith(`EP08_ACT03_SC05_${route[0]}`)
    )!;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.campaign!.politicalPoints = 100;
    state.campaign!.upkeep = [{ chapter: 'EP08', unrest: 70, cost: 10 }];
    state.flags.EP08_S3_M01 = 'A';
    state.flags.EP08_S3_M02 = 'A';
    state.flags.EP08_S3_M03 = 'A';
    state.flags.EP08_WORLD_ACT03_LOCAL_SUPPORT = 'DAILY_RECOVERY';
    state.flags.EP08_WORLD_ACT03_HISTORY_RELEASE = 'LOCAL_FIRST';
    state.contentVersion = '0.22.0-ep08-act03.reader-v1';
    for (const [key, def] of Object.entries(story.manifest.flags))
      if (def.description?.includes('第八章第四幕')) delete state.flags[key];
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page.getByRole('button', { name: '進入第四幕 →', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP08_ACT04_SC01_${route[0]}`
    );
    const cg = page.getByTestId('scene-cg');
    await expect(cg).toHaveAttribute(
      'src',
      new RegExp(`/act04/${route.toLowerCase()}/cg01\\.webp`)
    );
    await expect
      .poll(() => cg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      '100'
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.getByRole('button', { name: '隱藏對話框', exact: true }).click();
    await page.getByRole('button', { name: '點任意處顯示對話框', exact: true }).click();
    await page.screenshot({
      path: `test-results/ep08-act04-${route}-${info.project.name}.png`,
      animations: 'disabled',
    });
  }
});
test('renders four Sacred and six World outcomes and never repeats their resource settlement', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await prepare(page);
  for (const [route, picks, result, points, unrest, image] of [
    ['SACRED', 'ABAA', 'BIG_SUCCESS', 120, 40, '31'],
    ['SACRED', 'AAAA', 'SUCCESS', 110, 35, '32'],
    ['SACRED', 'AAAB', 'SMALL_FAILURE', 90, 35, '33'],
    ['SACRED', 'BBBB', 'BIG_FAILURE', 80, 40, '34'],
    ['WORLD', 'AAAA', 'BIG_SUCCESS', 120, 0, '22A'],
    ['WORLD', 'AAAB', 'SUCCESS', 110, 10, '22A'],
    ['WORLD', 'AABB', 'SUCCESS_MINIMUM', 100, 20, '22A'],
    ['WORLD', 'BBAA', 'SMALL_FAILURE_REMEDIED', 80, 50, '22B'],
    ['WORLD', 'BBAB', 'SMALL_FAILURE', 65, 65, '22B'],
    ['WORLD', 'BBBB', 'BIG_FAILURE', 50, 80, '22B'],
  ] as const) {
    let state = initialState({
      ...story,
      manifest: { ...story.manifest, start: `EP08_ACT04_SC01_${route[0]}` },
    });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.campaign!.politicalPoints = 100;
    let index = 0;
    for (let turn = 0; turn < 200; turn++) {
      const scene = story.scenes[state.currentSceneId];
      state.currentSegmentIndex = visibleSegments(story, state).length - 1;
      if (scene.id.endsWith((route === 'SACRED' ? '_RESULT_' : '_SETTLEMENT_') + result)) break;
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
      new RegExp(`/act04/${route.toLowerCase()}/cg${image}\\.webp`)
    );
    const hud = page.locator('.shell > .resource-hud');
    await expect(hud.getByTestId('political-points')).toHaveText(String(points));
    await expect(hud.getByTestId('unrest-value')).toHaveText(`${unrest} / 100`);
    await importPlayerState(page, markRead(story, state));
    await expect(hud.getByTestId('political-points')).toHaveText(String(points));
    await expect(hud.getByTestId('unrest-value')).toHaveText(`${unrest} / 100`);
  }
});
test('labels Adin correctly, keeps only act five pending and lists all 70 CGs by route', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await prepare(page);
  const scene = Object.values(story.scenes).find(
    (s) =>
      s.act === 'ACT04' &&
      s.id.startsWith('EP08_ACT04') &&
      s.segments.some((p) => p.speaker === 'ADIN_GLEN')
  )!;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
  state.politicalRoute = 'SACRED';
  state.campaign!.politicalRoute = 'SACRED';
  state.currentSegmentIndex = scene.segments.findIndex((p) => p.speaker === 'ADIN_GLEN');
  await importPlayerState(page, state);
  await expect(page.locator('.speaker-line')).toContainText('亞丁');
  for (const route of ['SACRED', 'WORLD'] as const) {
    const end = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP08' &&
        s.act === 'ACT04' &&
        s.completion &&
        s.id.startsWith(`EP08_ACT04_SC05_${route[0]}`)
    )!;
    const ending = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
    ending.politicalRoute = route;
    ending.campaign!.politicalRoute = route;
    for (const code of ['M01', 'M02', 'M03', 'M04']) ending.flags['EP08_S4_' + code] = 'A';
    for (const code of ['N01', 'N02', 'P01', 'P02']) ending.flags['EP08_W4_' + code] = 'A';
    ending.currentSegmentIndex = visibleSegments(story, ending).length - 1;
    await importPlayerState(page, ending);
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第四幕完');
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第五幕');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  }
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('章節', { exact: true }).selectOption('EP08');
  await dialog.getByLabel('幕', { exact: true }).selectOption('ACT04');
  await expect(dialog.getByRole('status').filter({ hasText: /^共/ })).toContainText('共 70 張');
  for (const [route, count] of [
    ['SACRED', 36],
    ['WORLD', 34],
  ] as const) {
    await dialog.getByLabel('路線', { exact: true }).selectOption(route);
    await expect(dialog.getByRole('status').filter({ hasText: /^共/ })).toContainText(
      `共 ${count} 張`
    );
    await expect(dialog.locator('.gallery-grid article')).toHaveCount(24);
  }
  await page.screenshot({
    path: `test-results/ep08-act04-gallery-${info.project.name}.png`,
    animations: 'disabled',
  });
});
