import { expect, test, type Page } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import {
  initialState,
  visibleSegments,
  markRead,
  currentCg,
} from '../../packages/narrative-core/engine';
import { openingCost } from '../../packages/narrative-core/campaign';
import { importPlayerState } from '../helpers/import-player-state';
test.setTimeout(60000);
async function prepare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
test('continues old EP08 saves on each worldline, charges once, and displays the new release and 56-image gallery', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await prepare(page);
  await page.getByRole('button', { name: /更新日誌 FINLEY2026\.11\.19/ }).click();
  await expect(page.getByRole('dialog')).toContainText('56 張 CG');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const route of ['SACRED', 'WORLD'] as const) {
    const end = Object.values(story.scenes).find(
      (s) =>
        s.chapter === 'EP08' &&
        s.act === 'ACT05' &&
        s.completion?.nextSceneId === `EP09_ACT01_SC01_${route[0]}`
    )!;
    let state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.campaign!.politicalPoints = 100;
    state.campaign!.chapter = 'EP08';
    state.contentVersion = '0.24.0-ep08-act05.reader-v1';
    if (route === 'SACRED') {
      state.flags.EP08_S5_F5 = 'A';
      state.flags.EP08_S5_P01 = 'A';
      state.flags.EP08_S5_P02 = 'LIMIT';
      state.flags.EP08_S5_P03 = 'CASE';
      state.flags.EP08_SACRED_ACT05_POLITICS_RESOLVED = true;
    } else state.flags.EP08_WORLD_ACT05_F5_CHOICE = 'B';
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    state = markRead(story, state);
    for (const k of Object.keys(state.flags)) if (k.startsWith('EP09_')) delete state.flags[k];
    await importPlayerState(page, state);
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
    await page.getByRole('button', { name: '進入第九章 →', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP09_ACT01_SC01_${route[0]}`
    );
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      String(100 - openingCost(story.plan!, 'EP09', 30)!)
    );
    const cg = page.getByTestId('scene-cg');
    await expect(cg).toHaveAttribute('src', new RegExp(`/ep09/act01/${route.toLowerCase()}/`));
    await expect
      .poll(() => cg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    await page.screenshot({
      path: `test-results/ep09-act01-${route}-${info.project.name}.png`,
      animations: 'disabled',
    });
  }
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('章節', { exact: true }).selectOption('EP09');
  await dialog.getByLabel('幕', { exact: true }).selectOption('ACT01');
  for (const route of ['SACRED', 'WORLD']) {
    await dialog.getByLabel('路線', { exact: true }).selectOption(route);
    await expect(dialog.getByRole('status').filter({ hasText: /^共/ })).toContainText('共 28 張');
  }
});
test('shows authored trap decisions without numeric spoilers, settles the cost once and preserves dialogue headers', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await prepare(page);
  for (const [route, id, pick, points, speaker] of [
    ['SACRED', 'EP09_ACT01_SC03_S_C03_FLAVOR_01_COMMON', 'B', 70, '奧莉薇雅'],
    ['WORLD', 'EP09_ACT01_SC03_W_F03_COMMON', 'D', 85, '艾琳達'],
  ] as const) {
    const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.campaign!.politicalPoints = 100;
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    const choice = story.scenes[id].choices.find((c) => c.id === pick)!;
    const button = page.getByRole('button', { name: choice.text });
    await expect(button).toBeEnabled();
    await expect(button).not.toContainText(/點數|30|15|陷阱/);
    await button.click();
    await expect(page.locator('.speaker-line')).toContainText(speaker);
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      String(points)
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<number | null>((resolve, reject) => {
              const request = indexedDB.open('lioness-empire-html5-v1', 1);
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const db = request.result;
                const get = db.transaction('saves').objectStore('saves').get('auto');
                get.onsuccess = () => {
                  const points = get.result?.state?.campaign?.politicalPoints ?? null;
                  db.close();
                  resolve(points);
                };
                get.onerror = () => {
                  db.close();
                  reject(get.error);
                };
              };
            })
        )
      )
      .toBe(points);
    await page.reload();
    await page.getByRole('button', { name: /繼續遊戲/ }).click();
    await expect(page.locator('.shell > .resource-hud').getByTestId('political-points')).toHaveText(
      String(points)
    );
  }
});
test('allows an underfunded narrative mistake and immediately enters the existing pure-black ending', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await prepare(page);
  for (const [route, id, pick] of [
    ['SACRED', 'EP09_ACT01_SC03_S_C03_FLAVOR_01_COMMON', 'B'],
    ['WORLD', 'EP09_ACT01_SC03_W_F03_COMMON', 'D'],
  ] as const) {
    const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.campaign!.politicalPoints = 1;
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page
      .getByRole('button', { name: story.scenes[id].choices.find((c) => c.id === pick)!.text })
      .click();
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'ENDING-VI-TREATY');
    await expect(page.getByTestId('scene-cg')).toHaveCount(0);
    await expect(page.locator('.speaker-line')).toContainText('芬利');
    await expect(page.locator('.dialogue')).toContainText('停一下。你是不是玩錯了？');
    for (let line = 0; line < 5; line++)
      await page.getByRole('button', { name: '繼續 →', exact: true }).click();
    await page.getByRole('button', { name: '返回主畫面 →', exact: true }).click();
    await expect(page.getByRole('navigation', { name: '主選單' })).toBeVisible();
  }
});
