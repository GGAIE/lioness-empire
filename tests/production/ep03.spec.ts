import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import audit from '../../content/sources/ep03/asset-audit.json' with { type: 'json' };

test('production ships all 135 byte-identical EP03 PNGs and exposes all five acts', async ({
  request,
}) => {
  test.setTimeout(120000);
  const manifest = await (await request.get('/content/manifests/story.json')).json();
  expect(manifest.version).toBe('0.11.1-ep03-act02-cg-fixed');
  const chapter = manifest.chapters.find((c: { id: string }) => c.id === 'EP03');
  expect(chapter.entry).toBe('EP03_ACT01_SC01');
  const body = await (await request.get('/content/' + chapter.file)).json();
  expect(body.scenes).toHaveLength(105);
  for (const image of audit.images) {
    const response = await request.get('/' + image.path);
    expect(response.status(), image.id).toBe(200);
    expect(
      createHash('sha256')
        .update(await response.body())
        .digest('hex')
    ).toBe(image.sha256);
    await response.dispose();
  }
});

test('an old second-chapter ending opens EP03 and charges its chapter cost once', async ({
  page,
}) => {
  const story = await loadContent(),
    state = initialState({
      ...story,
      manifest: { ...story.manifest, start: 'EP02_ACT05_SC05_COMMON' },
    });
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.contentVersion = '0.10.1-ep02-act05-cg-v0.2';
  state.readChapters = ['EP01'];
  state.flags.AIVIS_DEPARTED_EASTERN_FRONT = true;
  state.campaign!.politicalPoints = 75;
  state.campaign!.unrest = 80;
  state.campaign!.upkeep = [{ chapter: 'EP02', unrest: 80, cost: 40 }];
  await page.goto('/');
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'old-ep02.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'old ending fixture',
          savedAt: '2026-11-01',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章末結算');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP03 第三章 →', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章初');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP03_ACT01_SC01');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '35'
  );
  await expect(page.getByTestId('scene-cg')).toHaveAttribute(
    'src',
    './assets/cg/ep03/act01/EP03-ACT01-CG01-01.png'
  );
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
    'naturalWidth',
    audit.images[0].width
  );
});
