import { test, expect, type Page } from '@playwright/test';
import { openActFromDirectory } from '../helpers/directory';
import { readFile } from 'node:fs/promises';
import { loadContent } from '../../scripts/load-content';
import { act02Options } from '../../scripts/ep01-act02-parser';
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await openActFromDirectory(page, 2);
}
async function storeAndRestore(page: Page, name = '存檔 01') {
  const text = await page.getByTestId('dialogue-text').textContent();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const slot = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await slot.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('進度已儲存');
  await slot.getByRole('button', { name: '讀取', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(text!);
}
test('ACT II reads all twenty CGs, pauses at the real choice, restores both sides and finishes at ACT III', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const story = await loadContent();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  const ids = ['01', '02', '03', '03_A', '03_COMMON', '04', '05'].map((id) => `EP01_ACT02_SC${id}`);
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
        const asset = story.assets.find((a) => a.id === segment.cg)!;
        const bytes = await readFile(asset.src);
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
            path: `docs/screenshots/${info.project.name}-ep01-act02-opening.png`,
            fullPage: true,
          });
        }
      }
      if (id === 'EP01_ACT02_SC03_A' && i === 0) await storeAndRestore(page, '存檔 02');
      const last = i === scene.segments.length - 1;
      if (last && scene.kind === 'choice') {
        await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
        await storeAndRestore(page);
        await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `docs/screenshots/${info.project.name}-ep01-act02-choice.png`,
          fullPage: true,
        });
        await page.getByRole('button', { name: new RegExp(act02Options[0].text) }).click();
      } else if (!(last && scene.kind === 'end')) {
        await expect(page.getByLabel('劇情選項')).toHaveCount(0);
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
      }
    }
  }
  expect(images).toBe(20);
  expect(paragraphs).toBe(161);
  const finish = page.getByRole('region', { name: '章節完成' });
  await expect(finish).toContainText('第二幕完 · 離開學院');
  await expect(finish).toContainText('ACT III〈重返王都〉');
  await expect(finish).toContainText('整章尚未結算');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act02-finish.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(20);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP01 第三幕' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT03_SC01');
  await expect(page.locator('.scene-heading')).toContainText('第三幕');
  expect(errors).toEqual([]);
});
test('the other two source options show only their selected response before merging', async ({
  page,
}) => {
  const story = await loadContent();
  for (const option of act02Options.slice(1)) {
    await start(page);
    await page.getByRole('button', { name: '開發', exact: true }).click();
    await page.getByLabel('開發場景跳轉').selectOption('EP01_ACT02_SC03');
    const choice = story.scenes.EP01_ACT02_SC03;
    for (let i = 0; i < choice.segments.length - 1; i++)
      await page.getByRole('button', { name: '推進對話', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(option.text) }).click();
    const branch = story.scenes[`EP01_ACT02_SC03_${option.id}`];
    for (const segment of branch.segments) {
      await expect(page.getByTestId('dialogue-text')).toHaveText(segment.text);
      await expect(page.getByLabel('劇情選項')).toHaveCount(0);
      await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      'EP01_ACT02_SC03_COMMON'
    );
    await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /SC03_04_v0.2.png$/);
    await expect(page.getByTestId('dialogue-text')).toHaveText(
      story.scenes.EP01_ACT02_SC03_COMMON.segments[0].text
    );
  }
});
