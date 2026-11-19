import { expect, test } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';
test('interrupts an exact-zero choice with a silent pure-black VI, advances manually and records the ending', async ({
  page,
}, info) => {
  const story = await loadReaderContent();
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const scene = story.scenes.EP04_ACT02_SC06;
  const state = initialState({ ...story, manifest: { ...story.manifest, start: scene.id } });
  state.campaign!.politicalPoints = 10;
  state.currentSegmentIndex = visibleSegments(story, state).length - 1;
  await importPlayerState(page, state);
  await page.getByRole('button', { name: '背景音樂', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('BGM_LEDGER');
  const play = page.getByRole('button', { name: '播放背景音樂', exact: true });
  if (await play.isEnabled()) await play.click();
  await expect
    .poll(() => page.getByTestId('background-music').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: scene.choices[0].text }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'ENDING-VI-TREATY');
  await expect(page.locator('.speaker-line')).toContainText('芬利');
  await expect(page.locator('.shell > .resource-hud')).toBeHidden();
  await expect(page.getByTestId('scene-cg')).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(page.locator('.stage-blackout')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  const lines = story.scenes['ENDING-VI-TREATY'].segments.map((p) => p.text);
  for (let i = 0; i < lines.length; i++) {
    await expect(page.locator('.dialogue')).toContainText(lines[i]);
    if (i === 0)
      await page.screenshot({
        path: `test-results/bad-end-vi-${info.project.name}.png`,
        animations: 'disabled',
      });
    if (i < 5) await page.getByRole('button', { name: '繼續 →', exact: true }).click();
  }
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((a: HTMLAudioElement) => a.paused)
    )
    .toBe(true);
  await expect(page.getByRole('button', { name: '返回主畫面 →', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回主畫面 →', exact: true }).click();
  await expect(page.getByRole('navigation', { name: '主選單' })).toBeVisible();
  await page.getByRole('button', { name: '結局', exact: true }).click();
  const entry = page.getByRole('dialog').locator('.ending').filter({ hasText: '被寫回條約' });
  await expect(entry).toBeVisible();
  await expect(entry).not.toHaveClass(/locked/);
  await expect(entry).toContainText('VI · 戀人');
});
