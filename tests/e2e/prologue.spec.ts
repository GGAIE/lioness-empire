import { restoreScene } from '../helpers/restore-scene';
import { test, expect, type Page } from '@playwright/test';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '開始遊戲' }).click();
}
test('plays source CG scenes, saves/restores correctly, ends at flashback, and never shows a choice or charge', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const story = await loadContent();
  await start(page);
  await expect(page.getByTestId('dialogue-text')).toHaveText('安度因的鐘聲，總是準時響起。');
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-prologue-opening.png`,
    fullPage: true,
  });
  for (let i = 1; i <= 8; i++) {
    const id = `PRO-SC${String(i).padStart(2, '0')}`;
    if (i > 1) {
      await restoreScene(page, id);
    }
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', id);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`PRO-CG${String(i).padStart(2, '0')}_v1.png$`)
    );
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty('complete', true);
    await expect(page.getByLabel('劇情選項')).toHaveCount(0);
    await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
      '50'
    );
    await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
      '30 / 100'
    );
    if (i === 4) {
      await page.getByRole('button', { name: '推進對話', exact: true }).click();
      const savedText = await page.getByTestId('dialogue-text').textContent();
      await page.getByRole('button', { name: '存讀檔', exact: true }).click();
      const slot = page
        .getByRole('article')
        .filter({ has: page.getByRole('heading', { name: '存檔 01', exact: true }) });
      await slot.getByRole('button', { name: '儲存', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('進度已儲存');
      await slot.getByRole('button', { name: '讀取', exact: true }).click();
      await expect(page.getByTestId('dialogue-text')).toHaveText(savedText!);
      await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /PRO-CG04_v1.png$/);
    }
  }
  const final = story.scenes['PRO-SC08'];
  for (let i = 0; i < final.segments.length - 1; i++)
    await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await expect(page.locator('.stage')).toHaveClass(/stage-black/);
  await expect(page.getByRole('region', { name: '章節完成', exact: true })).toContainText('序幕完');
  await expect(page.getByRole('region', { name: '章節完成', exact: true })).toContainText(
    'EP01〈王冠之前〉· ACT I〈平靜被打破〉'
  );
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByLabel('劇情選項')).toHaveCount(0);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-prologue-finish.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(8);
  expect(errors).toEqual([]);
});
test('reads all 346 paragraphs in order with no developer jumps', async ({ page }, info) => {
  test.skip(
    info.project.name !== 'desktop',
    'Full text traversal is covered on desktop; all CG and end-state tests run on all engines.'
  );
  test.setTimeout(180000);
  const story = await loadContent();
  await start(page);
  const scenes = Object.values(story.scenes).filter((s) => s.chapter === 'PROLOGUE');
  for (const scene of scenes) {
    for (let i = 0; i < scene.segments.length; i++) {
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', scene.id);
      await expect(page.locator('.game-frame')).toHaveAttribute(
        'data-segment-id',
        scene.segments[i].id
      );
      await expect(page.getByTestId('dialogue-text')).toHaveText(scene.segments[i].text);
      if (scene.id === 'PRO-SC08' && i === scene.segments.length - 1) break;
      await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
  }
  await expect(page.getByRole('region', { name: '章節完成' })).toBeVisible();
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
  await page.getByRole('button', { name: '進入 EP01 第一幕' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT01_SC01');
  await expect(page.getByTestId('dialogue-text')).toHaveText(
    '晨鐘響過第三聲，皇家魔法學院的庭院便漸漸熱鬧起來。'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
});
