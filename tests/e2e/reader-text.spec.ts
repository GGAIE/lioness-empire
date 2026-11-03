import { test, expect } from '@playwright/test';
import { loadContent, loadReaderContent } from '../../scripts/load-content';
import { readerTextEdits } from '../../packages/narrative-core/reader-text';
import { initialState } from '../../packages/narrative-core/engine';

test('all reviewed prose, choices and transitions use immersive text and old history refreshes', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const original = await loadContent(),
    reader = await loadReaderContent(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  for (const edit of readerTextEdits) {
    const scene = original.scenes[edit.sceneId];
    const state = initialState({
      ...original,
      manifest: { ...original.manifest, start: scene.id },
    });
    state.currentSegmentIndex = edit.choiceId
      ? scene.segments.length - 1
      : scene.segments.findIndex((p) => p.id === edit.segmentId);
    state.readChapters = ['EP01', 'EP02'];
    state.campaign!.upkeep = [
      { chapter: 'EP02', unrest: 30, cost: 0 },
      { chapter: 'EP03', unrest: 30, cost: 0 },
    ];
    if (edit.segmentId) {
      const p = scene.segments[state.currentSegmentIndex];
      state.history = [
        {
          sceneId: scene.id,
          segmentId: p.id,
          text: p.text,
          speaker: p.speaker,
          speakerLabel: p.speakerLabel,
        },
      ];
    }
    await page.getByRole('button', { name: '存讀檔', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'before-reader-edit.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'lioness-empire-save',
          exportVersion: 1,
          record: {
            slot: 'entry',
            title: 'old narrative fixture',
            savedAt: '2026-11-02',
            thumbnail: null,
            state,
          },
        })
      ),
    });
    await page.getByRole('button', { name: '確認並載入', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', scene.id);
    const settle = page.getByRole('button', { name: '確認結算資訊', exact: true });
    if (
      scene.completion?.scope === 'CHAPTER' &&
      state.currentSegmentIndex === scene.segments.length - 1
    ) {
      await expect(settle).toBeVisible();
      await settle.click();
    }
    if (edit.choiceId) {
      await expect(
        page.getByLabel('劇情選項').getByRole('button').filter({ hasText: edit.to })
      ).toBeVisible();
      await expect(page.getByLabel('劇情選項')).not.toContainText('ACT01');
      await page.getByLabel('劇情選項').getByRole('button').filter({ hasText: edit.to }).click();
      const next = reader.scenes[scene.choices.find((c) => c.id === edit.choiceId)!.next];
      await expect(page.getByTestId('dialogue-text')).toHaveText(next.segments[0].text);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `docs/screenshots/${info.project.name}-immersive-choice.png`,
        fullPage: true,
      });
    } else {
      await expect(page.getByTestId('dialogue-text')).toHaveText(edit.to);
      await page.getByRole('button', { name: '回顧', exact: true }).click();
      await expect(page.locator('.history article').last()).toContainText(edit.to);
      await expect(page.locator('.history article').last().locator('small')).toHaveText(
        scene.title
      );
      await expect(page.locator('.history')).not.toContainText(scene.id);
      await expect(page.locator('.history')).not.toContainText(edit.from);
      await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    }
    await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
      '50'
    );
  }
  expect(errors).toEqual([]);
});
