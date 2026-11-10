import { test, expect } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';

test('continues each old ACT02 save into its own timeline and preserves the balance', async ({
  page,
}) => {
  const story = await loadReaderContent();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const scene = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP07' && s.act === 'ACT02' && s.completion && s.id.includes(`_${route[0]}_`)
    )!;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    state.contentVersion = '0.16.0-interlude-ep07-act01-act02.reader-v1';
    await importPlayerState(page, state);
    await page.getByRole('button', { name: '進入第三幕 →', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP07_ACT03_SC01_${route[0]}`
    );
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`/act03/${route.toLowerCase()}/CG01\\.webp`)
    );
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      '50'
    );
    await expect(page.getByTestId('dialogue-text')).toContainText(
      route === 'WORLD' ? '睡得很沉' : '東北塔'
    );
  }
  expect(errors).toEqual([]);
});

test('plays the Sacred seal negotiation with exclusive art and records the reward once', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const story = await loadReaderContent();
  const scene = Object.values(story.scenes).find(
    (s) =>
      s.act === 'ACT03' &&
      s.chapter === 'EP07' &&
      s.choices.some((c) => c.next.includes('_S_C13_D'))
  )!;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
  state.politicalRoute = 'SACRED';
  state.campaign!.politicalRoute = 'SACRED';
  state.campaign!.politicalPoints = 100;
  state.flags.FINLEY_SECRETARY_SEAL = true;
  state.flags.EP07_S3_EVIDENCE_COUNT = 12;
  for (const key of ['EXPENSE', 'RIGHTS', 'AUTHORITY', 'CAUSE', 'AGREEMENT'])
    state.flags['EP07_S3_' + key] = true;
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await importPlayerState(page, state);
  await page.getByRole('button', { name: /依完整協議加入皇家文書追蹤術式/ }).click();
  const dialogue = page.getByRole('button', { name: '推進對話', exact: true });
  const seen = new Set<string>();
  for (let i = 0; i < 35; i++) {
    seen.add((await page.getByTestId('scene-cg').getAttribute('src')) ?? '');
    if (await page.getByRole('region', { name: '章節完成' }).isVisible()) break;
    await dialogue.click();
  }
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第三幕完');
  await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
    '160'
  );
  expect([...seen].some((s) => s.includes('/sacred/CG42.webp'))).toBe(true);
  expect([...seen].some((s) => s.includes('/world/'))).toBe(false);
  await page.screenshot({ path: `test-results/ep07-act03-${info.project.name}.png` });
  await dialogue.click();
  await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
    '160'
  );
});

test('publishing includes 42 Sacred and 38 World images and isolated route nodes', async ({
  request,
}) => {
  const response = await request.get('/github-pages/content/episodes/ep07/chapter.json');
  expect(response.ok()).toBe(true);
  const chapter = await response.json();
  for (const route of ['SACRED', 'WORLD']) {
    const nodes = chapter.scenes.filter(
      (s: { act: string; id: string }) =>
        s.act === 'ACT03' && s.id.match(new RegExp(`_SC\\d\\d_${route[0]}(?:_|$)`))
    );
    expect(nodes.length).toBeGreaterThan(50);
    expect(
      nodes.every(
        (s: { availableWhen: { path: string; value: string } }) =>
          s.availableWhen.path === 'politicalRoute' && s.availableWhen.value === route
      )
    ).toBe(true);
    for (let i = 1; i <= (route === 'SACRED' ? 42 : 38); i++) {
      const image = await request.get(
        `/github-pages/assets/cg/ep07/act03/${route.toLowerCase()}/CG${String(i).padStart(2, '0')}.webp`
      );
      expect(image.status()).toBe(200);
      await image.dispose();
    }
  }
});
