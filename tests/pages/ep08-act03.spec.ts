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

async function prepare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}

test('continues both second-act saves and shows the first Finley release with 52 CGs', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await prepare(page);
  await page.getByRole('button', { name: /更新日誌 FINLEY2026\.11\.17/ }).click();
  await expect(page.getByRole('dialog')).toContainText('第八章第三幕');
  await expect(page.getByRole('dialog')).toContainText('52 張 CG');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const end = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP08' &&
        s.act === 'ACT02' &&
        s.completion &&
        s.availableWhen &&
        'value' in s.availableWhen &&
        s.availableWhen.value === route
    )!;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.campaign!.politicalPoints = 100;
    state.campaign!.upkeep = [{ chapter: 'EP08', unrest: 70, cost: 10 }];
    state.contentVersion = '0.21.0-ep08-act02.reader-v1';
    for (const [key, def] of Object.entries(story.manifest.flags))
      if (def.description?.includes('第八章第三幕')) delete state.flags[key];
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page.getByRole('button', { name: '進入第三幕 →', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP08_ACT03_SC01_${route[0]}`
    );
    const cg = page.getByTestId('scene-cg');
    await expect(cg).toHaveAttribute(
      'src',
      new RegExp(`/act03/${route.toLowerCase()}/cg01\\.webp`)
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
    await page.screenshot({ path: `test-results/ep08-act03-${route}-${info.project.name}.png` });
  }
});

test('renders all four Sacred outcome images and never settles twice after a load', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await prepare(page);
  for (const [outcome, picks, image, points] of [
    ['BIG_SUCCESS', ['B', 'A', 'B'], '17', 110],
    ['SMALL_SUCCESS', ['A', 'A', 'A'], '18', 100],
    ['SMALL_FAILURE', ['C', 'A', 'B'], '19', 90],
    ['BIG_FAILURE', ['A', 'A', 'C'], '20', 70],
  ] as const) {
    const id = `EP08_ACT03_SC05_S_RESULT_${outcome}`;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.politicalRoute = 'SACRED';
    state.campaign!.politicalRoute = 'SACRED';
    state.campaign!.politicalPoints = 100;
    state.clear.alinda = 3;
    picks.forEach((pick, i) => {
      state.flags[`EP08_S3_M0${i + 1}`] = pick;
    });
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`/sacred/cg${image}\\.webp`)
    );
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      String(points)
    );
    const settled = {
      ...state,
      flags: { ...state.flags, EP08_S3_SETTLED: true, EP08_SACRED_RESULT: outcome },
      campaign: { ...state.campaign!, politicalPoints: points },
    };
    await importPlayerState(page, settled);
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      String(points)
    );
  }
});

test('keeps the notice image through flavor replies and leaves only act four pending', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await prepare(page);
  for (const notice of ['A', 'B']) {
    const id = 'EP08_ACT03_SC01_W';
    let state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.politicalRoute = 'WORLD';
    state.campaign!.politicalRoute = 'WORLD';
    state.campaign!.politicalPoints = 100;
    for (let turn = 0; turn < 100; turn++) {
      const scene = story.scenes[state.currentSceneId];
      state = markRead(story, {
        ...state,
        currentSegmentIndex: visibleSegments(story, state).length - 1,
      });
      if (scene.choices.some((c) => c.next.endsWith('_F07_A'))) break;
      if (scene.kind === 'choice') {
        const answer = scene.choices.some((c) =>
          c.effects.some((e) => e.type === 'flag' && e.key === 'EP08_WORLD_NOTICE_EIRINDA')
        )
          ? notice
          : 'B';
        state = choose(story, state, answer);
      } else state = advance(story, state);
      state.history = [];
      state.readSegments = [];
    }
    expect(state.flags.EP08_WORLD_EIRINDA_SURVEY_RESULT).toBe(
      notice === 'A' ? 'SUCCESS' : 'FAILURE'
    );
    await importPlayerState(page, state);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`/world/cg15${notice}\\.webp`)
    );
    await page
      .getByRole('button', { name: story.scenes[state.currentSceneId].choices[2].text })
      .click();
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`/world/cg15${notice}\\.webp`)
    );
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      '85'
    );
  }
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
    state.flags.EP08_S3_M01 = 'A';
    state.flags.EP08_S3_M02 = 'A';
    state.flags.EP08_S3_M03 = 'A';
    state.flags.EP08_WORLD_ACT03_LOCAL_SUPPORT = 'DAILY_RECOVERY';
    state.flags.EP08_WORLD_ACT03_HISTORY_RELEASE = 'LOCAL_FIRST';
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第三幕完');
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
      '第四幕〈寒冰提前甦醒〉· 敬請期待'
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  }
});
