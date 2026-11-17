import { expect, test } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';
import type { Page } from '@playwright/test';

async function prepare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}

test('continues both old first-act saves, loads the matching CG and lists the November 14 release', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await prepare(page);
  await page.getByRole('button', { name: /更新日誌 FINLEY2026\.11\.17/ }).click();
  await expect(page.getByRole('dialog')).toContainText('第八章第二幕');
  await expect(page.getByRole('dialog')).toContainText('42 張 CG');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const end = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP08' &&
        s.act === 'ACT01' &&
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
    state.contentVersion = '0.20.0-ep08-act01.reader-v1';
    for (const key of Object.keys(state.flags))
      if (key.startsWith('EP08_')) delete state.flags[key];
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page.getByRole('button', { name: '進入第二幕 →', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP08_ACT02_SC01_${route[0]}`
    );
    const cg = page.getByTestId('scene-cg');
    await expect(cg).toHaveAttribute(
      'src',
      new RegExp(`/ep08/act02/${route.toLowerCase()}/cg01\\.webp`)
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
    await page.screenshot({ path: `test-results/ep08-act02-${route}-${info.project.name}.png` });
  }
});

test('shows the selected World political response and updates the permanent HUD once', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await prepare(page);
  const question = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP08' &&
      s.act === 'ACT02' &&
      s.choices.some((c) => c.effects.some((e) => e.type === 'points' && e.delta === 20))
  )!;
  for (const [i, points, unrest, key] of [
    [0, '70', '40 / 100', '16A'],
    [1, '35', '25 / 100', '16B'],
  ] as const) {
    const state = initialState({ ...story, manifest: { ...story.manifest, start: question.id } });
    state.politicalRoute = 'WORLD';
    state.campaign!.politicalRoute = 'WORLD';
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page.getByRole('button', { name: question.choices[i].text }).click();
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`/world/cg${key}\\.webp`)
    );
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      points
    );
    await expect(page.locator('.shell > .resource-hud').getByTestId('unrest-value')).toHaveText(
      unrest
    );
    await expect(page.locator('.speaker-line')).toContainText('奧莉維亞');
  }
});

test('displays Hebe with a speaker label, blocks unaffordable Sacred choices and keeps act three pending', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await prepare(page);
  const hebe = Object.values(story.scenes).find(
    (s) => s.chapter === 'EP08' && s.act === 'ACT02' && s.segments.some((p) => p.speaker === 'HEBE')
  )!;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: hebe.id } });
  state.politicalRoute = 'WORLD';
  state.campaign!.politicalRoute = 'WORLD';
  state.currentSegmentIndex = hebe.segments.findIndex((p) => p.speaker === 'HEBE');
  await importPlayerState(page, state);
  await expect(page.locator('.speaker-line')).toContainText('赫碧');
  const question = Object.values(story.scenes).find(
    (s) =>
      s.chapter === 'EP08' &&
      s.act === 'ACT02' &&
      s.choices.some((c) => c.effects.some((e) => e.type === 'points' && e.delta === -35))
  )!;
  const poor = {
    ...state,
    politicalRoute: 'SACRED' as const,
    campaign: { ...state.campaign!, politicalRoute: 'SACRED' as const, politicalPoints: 19 },
    currentSceneId: question.id,
    currentSegmentIndex: question.segments.length - 1,
  };
  await importPlayerState(page, poor);
  await expect(page.getByRole('button', { name: question.choices[0].text })).toBeEnabled();
  await expect(page.getByRole('button', { name: question.choices[1].text })).toBeDisabled();
  await expect(page.getByRole('button', { name: question.choices[2].text })).toBeDisabled();
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
    const final = {
      ...state,
      politicalRoute: route,
      campaign: { ...state.campaign!, politicalRoute: route },
      currentSceneId: end.id,
      currentSegmentIndex: end.segments.length - 1,
    };
    await importPlayerState(page, final);
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第二幕完');
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
      route === 'SACRED' ? '第三幕〈無人承接的契約〉' : '第三幕〈山火記得的名字〉'
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  }
});
