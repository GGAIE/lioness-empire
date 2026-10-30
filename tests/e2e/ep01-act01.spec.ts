import { test, expect } from '@playwright/test';
import { openActFromDirectory } from '../helpers/directory';
import { loadContent } from '../../scripts/load-content';
import { readFile } from 'node:fs/promises';
import { currentCg, initialState } from '../../packages/narrative-core/engine';

test('EP01 ACT I reads every paragraph, loads all eleven CGs, saves mid-scene and ends without chapter settlement', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const story = await loadContent();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await openActFromDirectory(page, 1);
  const scenes = Object.values(story.scenes).filter(
    (s) => s.chapter === 'EP01' && s.act === 'ACT01'
  );
  let imageCount = 0;
  for (const scene of scenes) {
    for (let i = 0; i < scene.segments.length; i++) {
      const s = scene.segments[i];
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', scene.id);
      await expect(page.getByTestId('dialogue-text')).toHaveText(s.text);
      await expect(page.getByLabel('劇情選項')).toHaveCount(0);
      if (s.cg) {
        imageCount++;
        const state = { ...initialState(story), currentSceneId: scene.id, currentSegmentIndex: i };
        const asset = story.assets.find((a) => a.id === currentCg(story, state))!;
        await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
        const bytes = await readFile(asset.src);
        await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
          'naturalWidth',
          bytes.readUInt32BE(16)
        );
        await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
          'naturalHeight',
          bytes.readUInt32BE(20)
        );
        await expect(page.getByTestId('scene-cg')).toBeVisible();
        await expect(page.locator('.outgoing-cg')).toHaveCount(0);
        if (imageCount === 1 || imageCount === 9)
          await page.screenshot({
            path: `docs/screenshots/${info.project.name}-ep01-act01-cg${imageCount}.png`,
            fullPage: true,
          });
      }
      if (scene.id === 'EP01_ACT01_SC04' && s.cg === 'EP01-ACT01-CG04-03') {
        await page.getByRole('button', { name: '存讀檔', exact: true }).click();
        const slot = page
          .getByRole('article')
          .filter({ has: page.getByRole('heading', { name: '存檔 01', exact: true }) });
        await slot.getByRole('button', { name: '儲存', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('進度已儲存');
        await slot.getByRole('button', { name: '讀取', exact: true }).click();
        await expect(page.getByTestId('dialogue-text')).toHaveText(s.text);
        await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /SC04_IMG03_v0.3.png$/);
      }
      if (scene.id === scenes.at(-1)!.id && i === scene.segments.length - 1) break;
      await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
  }
  expect(imageCount).toBe(11);
  const finish = page.getByRole('region', { name: '章節完成' });
  await expect(finish).toContainText('第一幕完 · 平靜被打破');
  await expect(finish).toContainText('ACT II〈離開學院〉');
  await expect(finish).toContainText('整章尚未結算');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act01-finish.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(11);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await expect(
    page.getByRole('article').filter({ has: page.getByRole('heading', { name: /王冠之前/ }) })
  ).toContainText('已提供 3 / 5 幕');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP01 第二幕' }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText('清晨的研究室，比平常更早亮起了燈。');
  expect(errors).toEqual([]);
});
