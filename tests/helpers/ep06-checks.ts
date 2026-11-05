import { test, expect } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from './import-player-state';

export function ep06Checks() {
  test('plays the prologue fade and the hospital CG transition as visual cues', async ({
    page,
  }) => {
    const story = await loadReaderContent();
    await page.goto('/');
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();

    async function loadBeforeCue(id: string, cueId: string) {
      const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
      state.currentSegmentIndex =
        visibleSegments(story, state).findIndex((segment) => segment.id === cueId) - 1;
      expect(state.currentSegmentIndex).toBeGreaterThanOrEqual(0);
      await importPlayerState(page, state);
    }

    const next = page.getByRole('button', { name: '推進對話', exact: true });
    const text = page.getByTestId('dialogue-text');
    const cg = page.getByTestId('scene-cg');
    const overlay = page.locator('.stage-blackout');
    await loadBeforeCue('PRO-SC08', 'L046');
    await expect(cg).toHaveJSProperty('naturalWidth', 1672);
    await next.click();
    await expect(text).toBeEmpty();
    await expect(cg).toHaveAttribute('src', /PRO-CG08/);
    await expect(overlay).toHaveCSS('transition-duration', '1.2s');
    await expect(overlay).toHaveCSS('opacity', '1');
    await next.click();
    await expect(text).toHaveText('最後，只留下遠處的鐘聲。');
    await expect(overlay).toHaveCSS('opacity', '1');

    await loadBeforeCue('EP06_ACT02_SC02', 'L075');
    await next.click();
    await expect(text).toBeEmpty();
    await expect(cg).toHaveAttribute('src', /CG11/);
    await expect(cg).toHaveJSProperty('naturalWidth', 1672);
    await next.click();
    await expect(cg).toHaveAttribute('src', /CG12/);
    await expect(text).toContainText('第六團的倉庫');
  });

  test('cuts to black without dialogue and waits for the next CG to load', async ({ page }) => {
    const story = await loadReaderContent();
    const id = 'EP06_ACT02_SC01';
    const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.currentSegmentIndex = visibleSegments(story, state).length - 2;
    state.contentVersion = '0.14.0-ep05-complete-ep06-act01-act02.reader-v1';
    state.history = [{ sceneId: id, segmentId: 'L035', text: 'CUT TO BLACK。' }];

    let releaseNextCg!: () => void;
    const nextCgReady = new Promise<void>((resolve) => {
      releaseNextCg = resolve;
    });
    await page.route(/LE_EP06_ACT02_CG07_v1\.0\.(png|webp)$/, async (route) => {
      await nextCgReady;
      await route.continue();
    });

    await page.goto('/');
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    await importPlayerState(page, state);
    const cg = page.getByTestId('scene-cg');
    const advance = page.getByRole('button', { name: '推進對話', exact: true });
    const blackout = page.locator('.stage-blackout');
    await expect(cg).toHaveAttribute('src', /CG06/);
    await advance.click();
    await expect(page.getByTestId('dialogue-text')).toBeEmpty();
    await expect(cg).toHaveCount(0);
    await expect(blackout).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(blackout).toHaveCSS('opacity', '1');
    await advance.click();
    await expect(cg).toHaveAttribute('src', /CG07/);
    await expect(blackout).toHaveCSS('opacity', '1');
    releaseNextCg();
    await expect(cg).toHaveJSProperty('naturalWidth', 1672);
    await expect(blackout).toHaveCSS('opacity', '0');
    await page.getByRole('button', { name: '回顧', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toContainText('CUT TO BLACK');
  });

  test('new chapters preserve old saves, display exclusive CGs and apply each decision once', async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    const story = await loadReaderContent();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    function at(id: string, last = false, flags: Record<string, string | boolean> = {}) {
      const s = initialState({ ...story, manifest: { ...story.manifest, start: id } });
      s.campaign!.politicalPoints = 100;
      Object.assign(s.flags, flags);
      if (last) s.currentSegmentIndex = visibleSegments(story, s).length - 1;
      return s;
    }
    const hud = (id: string) => page.locator('.shell > .resource-hud').getByTestId(id);
    const old = at('EP05_ACT04_SC05', true);
    old.contentVersion = '0.13.1-ep05-act04-cg-complete.reader-v1';
    for (const key of Object.keys(old.flags))
      if (key.startsWith('EP06_') || key === 'T1_STATUS') delete old.flags[key];
    await importPlayerState(page, old);
    await page.getByRole('button', { name: /進入第五幕/ }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP05_ACT05_SC01');
    await expect(hud('political-points')).toHaveText('100');
    const fifthEnd = at('EP05_ACT05_SC05', true);
    fifthEnd.campaign!.unrest = 65;
    await importPlayerState(page, fifthEnd);
    await expect(page.getByRole('alertdialog')).toContainText('章末');
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
    await page.getByRole('button', { name: /進入第六章/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('章初');
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
    await expect(hud('political-points')).toHaveText('90');
    for (const transfer of [true, false]) {
      const s = at('EP06_ACT01_SC01', false, { ROUENNE_TRANSFER_APPROVED: transfer });
      const parts = visibleSegments(story, s);
      s.currentSegmentIndex = parts.findIndex(
        (p) => p.cg === `EP06-ACT01-CG04${transfer ? 'A' : 'B'}`
      );
      expect(s.currentSegmentIndex).toBeGreaterThanOrEqual(0);
      await importPlayerState(page, s);
      await expect(page.getByTestId('scene-cg')).toHaveAttribute(
        'src',
        new RegExp(`CG04${transfer ? 'A' : 'B'}`)
      );
      await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
    }
    await importPlayerState(page, at('EP06_ACT01_SC04', true));
    await page
      .getByRole('button', { name: new RegExp(story.scenes.EP06_ACT01_SC04.choices[0].text) })
      .click();
    await expect(hud('political-points')).toHaveText('105');
    for (const [letter, points, unrest] of [
      ['A', '90', '25 / 100'],
      ['B', '110', '30 / 100'],
      ['C', '100', '40 / 100'],
    ]) {
      const s = at('EP06_ACT02_SC04', true);
      await importPlayerState(page, s);
      const choice = story.scenes.EP06_ACT02_SC04.choices.find((c) => c.id === letter)!;
      await page.getByRole('button', { name: new RegExp(choice.text) }).click();
      await expect(hud('political-points')).toHaveText(points);
      await expect(hud('unrest-value')).toHaveText(unrest);
      await page.getByRole('button', { name: '返回標題', exact: true }).click();
      await expect(page.getByRole('navigation', { name: '主選單' })).toBeVisible();
      await page.reload();
      await page.getByRole('button', { name: '繼續遊戲', exact: true }).click();
      await expect(hud('political-points')).toHaveText(points);
      await expect(hud('unrest-value')).toHaveText(unrest);
    }
    const end = at('EP06_ACT02_SC05', true, {
      EP06_ACT02_CH01: 'C',
      EP06_ACT02_CH02: 'C',
      EP06_ACT02_CH03: 'C',
    });
    await importPlayerState(page, end);
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText('盤根錯節');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-ep06-act02.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
