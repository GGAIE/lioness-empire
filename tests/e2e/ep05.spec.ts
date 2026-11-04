import { test, expect } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';
import type { Story } from '../../packages/narrative-core/schema';
let story: Story;
test.beforeAll(async () => {
  story = await loadReaderContent();
});
async function settings(page: any) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
function at(id: string, flags: Record<string, string | boolean> = {}, last = false) {
  const s = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  Object.assign(s.flags, flags);
  if (last) s.currentSegmentIndex = visibleSegments(story, s).length - 1;
  return s;
}
const hud = (page: any, testId: string) =>
  page.locator('.shell > .resource-hud').getByTestId(testId);
test('an old EP04 ending continues into EP05 and exposes four new acts without offering ACT05', async ({
  page,
}, info) => {
  await settings(page);
  const id = 'EP04_ACT05_SC05_COMMON';
  const s = at(id, {}, true);
  s.contentVersion = 'old-ep04';
  s.campaign!.politicalPoints = 100;
  s.campaign!.unrest = 65;
  await importPlayerState(page, s);
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: /進入第五章/ }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章初');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP05_ACT01_SC01');
  await expect(hud(page, 'political-points')).toHaveText('90');
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /act01.*SC01_IMG01/);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep05-opening.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('陛下不見客');
  await expect(page.getByRole('dialog')).toContainText('尚未結束的夜晚');
});
test('nomination defers both separate ledgers until verified delivery, persists the receipts and never loads other nomination art', async ({
  page,
}) => {
  await settings(page);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const flags = { EP05_PORT_METHOD: 'RIVER', EP05_UNION_ATTITUDE: 'SOOTHE' };
  await importPlayerState(page, at('EP05_ACT02_SC03_C1_COMMON', flags, true));
  await page.getByRole('button', { name: /就由尤里斯會長擔任/ }).click();
  await expect(hud(page, 'political-points')).toHaveText('50');
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /IMG09A/);
  expect(requests.some((r) => /IMG09[BC]/.test(r))).toBe(false);
  const result = at(
    'EP05_ACT02_SC05',
    { ...flags, EP05_OSINM_REPRESENTATION: 'YURIS_APPOINTED' },
    true
  );
  await importPlayerState(page, result);
  await expect(hud(page, 'political-points')).toHaveText('50');
  await expect(hud(page, 'unrest-value')).toHaveText('20 / 100');
  await page.getByRole('button', { name: '返回標題', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '繼續遊戲', exact: true }).click();
  await expect(hud(page, 'political-points')).toHaveText('50');
  await expect(hud(page, 'unrest-value')).toHaveText('20 / 100');
});
test('Tamara costs 8 at the decision, grants 15 only after arriving, and keeps exclusive relief CGs separate', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await settings(page);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await importPlayerState(page, at('EP05_ACT03_SC04_C1_COMMON', {}, true));
  await page.getByRole('button', { name: /請塔馬拉協調第二騎士團的人手/ }).click();
  await expect(hud(page, 'political-points')).toHaveText('42');
  const result = at('EP05_ACT03_SC05', { EP05_ACT03_STAFF_SOURCE: 'TAMARA' });
  result.campaign!.politicalPoints = 42;
  await importPlayerState(page, result);
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /ACT03_23/);
  await expect(hud(page, 'political-points')).toHaveText('42');
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep05-tamara.png`,
    fullPage: true,
  });
  for (let i = 0; i < 80; i++) {
    if ((await page.locator('.game-frame').getAttribute('data-scene-id')) === 'EP05_ACT03_SC05_Q1')
      break;
    await page.getByRole('button', { name: '推進對話', exact: true }).click();
  }
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP05_ACT03_SC05_Q1');
  await expect(hud(page, 'political-points')).toHaveText('57');
  expect(requests.some((r) => /ACT03_2[12]_/.test(r))).toBe(false);
  await importPlayerState(page, at('EP05_ACT04_SC05', {}, true));
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('庇護的代價');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
