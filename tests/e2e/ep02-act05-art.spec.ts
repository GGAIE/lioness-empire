import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadContent } from '../../scripts/load-content';
import { initialState, markRead } from '../../packages/narrative-core/engine';
test('the complete ACT05 pack displays all 25 original images and restores collection at old missing CGs', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const story = await loadContent(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const anchors = Object.values(story.scenes)
    .filter((s) => s.chapter === 'EP02' && s.act === 'ACT05')
    .flatMap((s) =>
      s.segments.flatMap((p, index) => (p.cg ? [{ scene: s, paragraph: p, index }] : []))
    );
  expect(anchors).toHaveLength(25);
  for (const { scene, paragraph, index } of anchors) {
    let state = initialState({
      ...story,
      manifest: { ...story.manifest, start: 'EP02_ACT05_SC01' },
    });
    state.currentSceneId = scene.id;
    state.currentSegmentIndex = index;
    state.flags.AIVIS_DEPARTED_EASTERN_FRONT = (scene.sceneNumber ?? 0) > 3;
    state.campaign!.politicalPoints = 83;
    state.campaign!.unrest = 42;
    state.campaign!.upkeep = [{ chapter: 'EP02', unrest: 42, cost: 10 }];
    state.readChapters = ['EP01'];
    state = markRead(story, state);
    state.contentVersion = '0.10.0-ep02-act03-act05-1031';
    await page.getByRole('button', { name: '存讀檔', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'old-act05-cg.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'lioness-empire-save',
          exportVersion: 1,
          record: {
            slot: 'entry',
            title: 'Old ACT05 read position',
            savedAt: '2026-10-31',
            thumbnail: null,
            state,
          },
        })
      ),
    });
    await page.getByRole('button', { name: '確認並載入', exact: true }).click();
    const asset = story.assets.find((a) => a.id === paragraph.cg)!,
      png = await readFile(asset.src);
    expect(asset.status).toBe('APPROVED');
    expect(asset.src).toContain('/complete-v0.2/');
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', scene.id);
    await expect(page.getByTestId('dialogue-text')).toHaveText(paragraph.text);
    await expect(page.locator('.stage .missing')).toHaveCount(0);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
      'naturalWidth',
      png.readUInt32BE(16)
    );
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
      'naturalHeight',
      png.readUInt32BE(20)
    );
    await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
      '83'
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    if (paragraph.cg === 'EP02-ACT05-CG05-25') {
      const notice = page.getByRole('button', { name: '關閉通知', exact: true });
      if (await notice.isVisible()) await notice.click();
      await page.getByTestId('scene-cg').evaluate(async (el: HTMLImageElement) => {
        await el.decode();
      });
      await expect(page.getByTestId('scene-cg')).toHaveCSS('opacity', '1');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: 'docs/screenshots/' + info.project.name + '-act05-complete-cg25.png',
        fullPage: true,
      });
    }
  }
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(25);
  expect(errors).toEqual([]);
});
