import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadReaderContent, root } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';
import { coverPreferences } from '../helpers/cover-preferences';

for (const prefix of ['/', '/lioness-empire/']) {
  test(`the complete game loads under ${prefix} with working cover, CG, music and old saves`, async ({
    page,
  }, info) => {
    test.setTimeout(60000);
    const failures: string[] = [],
      errors: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failures.push(r.url());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(prefix, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('title-cover')).toHaveJSProperty('naturalWidth', 1672);
    await expect(page.getByTestId('title-cover')).toHaveAttribute(
      'src',
      './assets/covers/default-palace.webp'
    );
    await expect(page.getByRole('navigation', { name: '主選單' }).getByRole('button')).toHaveCount(
      8
    );
    await page.getByRole('button', { name: '背景音樂', exact: true }).click();
    const musicSelect = page.getByLabel('選擇背景音樂');
    await musicSelect.selectOption(
      (await musicSelect.locator('option').nth(1).getAttribute('value'))!
    );
    await expect(page.getByRole('status', { name: '背景音樂播放狀態' })).toHaveText('播放中');
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    await page.getByRole('button', { name: '開始遊戲', exact: true }).click();
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /\.webp$/);
    await page.getByRole('button', { name: '返回標題', exact: true }).click();
    const story = await loadReaderContent(),
      id = 'EP05_ACT04_SC05';
    const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.currentSegmentIndex = visibleSegments(story, state).findIndex(
      (p) => p.cg === 'EP05-ACT04-CG23'
    );
    await importPlayerState(page, state);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /LE_CG_EP05_ACT04_23\.webp$/);
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
    await page.getByRole('button', { name: '返回標題', exact: true }).click();
    await coverPreferences(page, ['STAR'], 'star-character');
    await expect(page.getByTestId('title-cover')).toHaveJSProperty(
      'naturalWidth',
      info.project.name.endsWith('desktop') ? 1920 : 1080
    );
    expect(
      await page.getByTestId('title-cover').evaluate((i: HTMLImageElement) => i.currentSrc)
    ).toContain(
      prefix +
        (info.project.metadata.rootEntry ? 'github-pages/' : '') +
        'assets/covers/release-20261104/star-character-'
    );
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-${prefix === '/' ? 'root' : 'project'}-hosting.png`,
    });
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test('published asset references stay inside the compact bundle and retain the original music', async ({
  request,
}, info) => {
  const report = JSON.parse(
    await readFile(root + '/docs/github-pages-package-report.json', 'utf8')
  );
  expect(report.totalBytes).toBeLessThan(1_000_000_000);
  for (const item of report.assets) {
    const response = await request.get(
      '/lioness-empire/' + (info.project.metadata.rootEntry ? 'github-pages/' : '') + item.output
    );
    expect(response.status(), item.output).toBe(200);
    expect(
      createHash('sha256')
        .update(await response.body())
        .digest('hex')
    ).toBe(item.sha256);
    if (item.source.endsWith('.mp3')) expect(item.sha256).toBe(item.sourceSha256);
    await response.dispose();
  }
});
