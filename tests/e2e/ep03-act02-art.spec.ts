import { test, expect } from '@playwright/test';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
import { initialState, markRead } from '../../packages/narrative-core/engine';
import audit from '../../content/sources/ep03/asset-audit.json' with { type: 'json' };

test('all 27 fixed ACT02 CGs display and collect from old already-read saves', async ({
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
    .filter((s) => s.chapter === 'EP03' && s.act === 'ACT02')
    .flatMap((scene) => scene.segments.flatMap((p, index) => (p.cg ? [{ scene, p, index }] : [])));
  expect(anchors).toHaveLength(27);
  for (const { scene, p, index } of anchors) {
    let state = initialState({
      ...story,
      manifest: { ...story.manifest, start: 'EP03_ACT02_SC01' },
    });
    state.currentSceneId = scene.id;
    state.currentSegmentIndex = index;
    state.readChapters = ['EP01', 'EP02'];
    state.flags.AIVIS_DEPARTED_EASTERN_FRONT = true;
    state.campaign!.upkeep = [
      { chapter: 'EP02', unrest: 30, cost: 0 },
      { chapter: 'EP03', unrest: 30, cost: 0 },
    ];
    state = markRead(story, state);
    state.contentVersion = '0.11.0-ep03-act01-act05';
    await page.getByRole('button', { name: '存讀檔', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'old-ep03-read.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'lioness-empire-save',
          exportVersion: 1,
          record: {
            slot: 'entry',
            title: 'old read CG fixture',
            savedAt: '2026-11-01',
            thumbnail: null,
            state,
          },
        })
      ),
    });
    await page.getByRole('button', { name: '確認並載入', exact: true }).click();
    const image = audit.images.find((a) => a.id === p.cg)!;
    expect(image.path).toContain('/fixed-v1.0/');
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', scene.id);
    await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
    await expect(page.locator('.stage .missing')).toHaveCount(0);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + image.path);
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', image.width);
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalHeight', image.height);
    await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
      '50'
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    if (p.cg === 'EP03-ACT02-CG05-06') {
      await expect(page.locator('.outgoing-cg')).toHaveCount(0);
      await expect(page.getByTestId('scene-cg')).toHaveCSS('opacity', '1');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `docs/screenshots/${info.project.name}-ep03-act02-complete.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(27);
  expect(errors).toEqual([]);
});
