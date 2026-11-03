import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import audit from '../../content/sources/ep04/act01-asset-audit.json' with { type: 'json' };

test('EP04 production ships all 25 selected originals and continues an old EP03 ending', async ({
  page,
  request,
}) => {
  const story = await loadReaderContent();
  for (const image of audit.images) {
    const response = await request.get('/' + image.path);
    expect(response.status()).toBe(200);
    expect(
      createHash('sha256')
        .update(await response.body())
        .digest('hex')
    ).toBe(image.sha256);
    await response.dispose();
  }
  const scene = story.scenes.EP03_ACT05_SC05_CH01_COMMON;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
  state.currentSegmentIndex = scene.segments.length - 1;
  state.readChapters = ['EP01', 'EP02'];
  state.contentVersion = '0.11.1-ep03-act02-cg-fixed.reader-v1';
  state.campaign!.politicalPoints = 75;
  state.campaign!.unrest = 80;
  state.campaign!.upkeep = [{ chapter: 'EP03', unrest: 80, cost: 40 }];
  await page.goto('/');
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep03-previous-ending.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'entry test',
          savedAt: '2026-11-03',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章末結算');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP04 第四章' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章初結算');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP04_ACT01_SC01');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '35'
  );
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', './' + audit.images[0].path);
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
    'naturalWidth',
    audit.images[0].width
  );
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});
