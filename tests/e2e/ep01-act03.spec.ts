import { restoreScene } from '../helpers/restore-scene';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { Story } from '../../packages/narrative-core/schema';
import { act03CompletionFlags } from '../../scripts/ep01-act03-parser';

async function start(page: Page, story: Story) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT03_SC01' },
  });
  state.flags.EP01_ACT02_PRIORITY = 'EASTERN_FRONT';
  state.decisionLog = ['EP01_ACT02_SC03:B'];
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'act03-start.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'test-entry',
          title: 'ACT III entry',
          savedAt: '2026-10-30',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
}
async function storeAndRestore(page: Page, name: string) {
  const text = await page.getByTestId('dialogue-text').textContent();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await card.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('進度已儲存');
  await card.getByRole('button', { name: '讀取', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(text!);
}
test('ACT III reads twenty CGs and three dialogue decisions, persists their answers, and grants no regency or numerical rewards', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const story = await loadContent();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page, story);
  const ids = [
    '01',
    '02',
    '02_A',
    '02_COMMON',
    '03',
    '03_A',
    '03_COMMON',
    '04',
    '04_A',
    '04_COMMON',
    '05',
  ].map((id) => `EP01_ACT03_SC${id}`);
  let images = 0,
    paragraphs = 0;
  for (const id of ids) {
    const scene = story.scenes[id];
    for (let i = 0; i < scene.segments.length; i++) {
      const segment = scene.segments[i];
      paragraphs++;
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', id);
      await expect(page.getByTestId('dialogue-text')).toHaveText(segment.text);
      if (segment.cg) {
        images++;
        const asset = story.assets.find((a) => a.id === segment.cg)!,
          bytes = await readFile(asset.src);
        await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
        await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
          'naturalWidth',
          bytes.readUInt32BE(16)
        );
        await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
          'naturalHeight',
          bytes.readUInt32BE(20)
        );
        if (images === 1) {
          await expect(page.locator('.outgoing-cg')).toHaveCount(0);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `docs/screenshots/${info.project.name}-ep01-act03-opening.png`,
            fullPage: true,
          });
        }
      }
      if (id === 'EP01_ACT03_SC03_A' && i === 0) await storeAndRestore(page, '存檔 02');
      const last = i === scene.segments.length - 1;
      if (last && scene.kind === 'choice') {
        await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
        if (id === 'EP01_ACT03_SC02') await storeAndRestore(page, '存檔 01');
        if (id === 'EP01_ACT03_SC04') {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `docs/screenshots/${info.project.name}-ep01-act03-choice.png`,
            fullPage: true,
          });
        }
        await page.getByRole('button', { name: new RegExp(scene.choices[0].text) }).click();
      } else if (!(last && scene.kind === 'end'))
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
  }
  expect(images).toBe(20);
  expect(paragraphs).toBe(160);
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第三幕完 · 重返王都');
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('ACT IV');
  await expect
    .poll(async () => {
      const completedBounds = await page.getByRole('region', { name: '章節完成' }).boundingBox();
      const subtitleBounds = await page.locator('.dialogue-wrap').boundingBox();
      return subtitleBounds!.y - (completedBounds!.y + completedBounds!.height);
    })
    .toBeGreaterThanOrEqual(12);
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act03-finish.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(20);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '存檔 03', exact: true }) });
  await card.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('進度已儲存');
  const exported = page.waitForEvent('download');
  await card.getByRole('button', { name: '匯出', exact: true }).click();
  const downloadedPath = await (await exported).path();
  const saved = JSON.parse(await readFile(downloadedPath!, 'utf8')).record.state;
  for (const [key, value] of Object.entries(act03CompletionFlags))
    expect(saved.flags[key]).toBe(value);
  expect(saved.flags.EP01_ACT02_PRIORITY).toBe('EASTERN_FRONT');
  expect(saved.decisionLog).toEqual([
    'EP01_ACT02_SC03:B',
    ...['02', '03', '04'].map((n) => `EP01_ACT03_SC${n}:A`),
  ]);
  expect(saved.readChapters).not.toContain('EP01');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP01 第四幕' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT04_SC01');
  await expect(page.locator('.stage')).toHaveClass(/stage-black/);
  expect(errors).toEqual([]);
});
test('all six alternative dialogue responses use the same third CG and merge to the same fourth CG', async ({
  page,
}) => {
  test.setTimeout(120000);
  const story = await loadContent();
  for (const option of ['B', 'C']) {
    await start(page, story);
    for (const num of ['02', '03', '04']) {
      const id = `EP01_ACT03_SC${num}`,
        scene = story.scenes[id];
      await restoreScene(page, id);
      for (let i = 0; i < scene.segments.length - 1; i++)
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
      const choice = scene.choices.find((c) => c.id === option)!;
      await page.getByRole('button', { name: new RegExp(choice.text) }).click();
      await expect(page.getByTestId('scene-cg')).toHaveAttribute(
        'src',
        new RegExp(`SC${num}_CG03_v0.3.png$`)
      );
      for (const segment of story.scenes[choice.next].segments) {
        await expect(page.getByTestId('dialogue-text')).toHaveText(segment.text);
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
      }
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', `${id}_COMMON`);
      await expect(page.getByTestId('scene-cg')).toHaveAttribute(
        'src',
        new RegExp(`SC${num}_CG04_v0.3.png$`)
      );
    }
  }
});
