import { restoreScene } from '../helpers/restore-scene';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { Story } from '../../packages/narrative-core/schema';
import { act03CompletionFlags } from '../../scripts/ep01-act03-parser';
import { act04CompletionFlags } from '../../scripts/ep01-act04-parser';
async function start(page: Page, story: Story) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT04_SC01' },
  });
  Object.assign(state.flags, act03CompletionFlags, { EP01_ACT02_PRIORITY: 'EASTERN_FRONT' });
  state.decisionLog = [
    'EP01_ACT02_SC03:B',
    ...['02', '03', '04'].map((n) => `EP01_ACT03_SC${n}:A`),
  ];
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'act04-start.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'test-entry',
          title: 'ACT IV entry',
          savedAt: '2026-10-30',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
}
async function saveAndRestore(page: Page, name: string) {
  const text = await page.getByTestId('dialogue-text').textContent();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const slot = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await slot.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('進度已儲存');
  await slot.getByRole('button', { name: '讀取', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(text!);
}
test('ACT IV starts black, reveals twenty corrected CGs, reads five choices and ends without audience or regency', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const story = await loadContent(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page, story);
  await expect(page.locator('.stage')).toHaveClass(/stage-black/);
  await expect(page.getByTestId('scene-cg')).toHaveCount(0);
  await expect(page.getByTestId('dialogue-text')).toHaveText('「……大公主。」');
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(0);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await saveAndRestore(page, '存檔 01');
  await page.getByRole('button', { name: '關閉通知', exact: true }).click();
  await expect(page.getByTestId('scene-cg')).toHaveCount(0);
  await expect(page.locator('.stage-blackout')).toHaveCSS('opacity', '1');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act04-black-opening.png`,
    fullPage: true,
  });
  const ids = ['01', '02', '03', '04', '05'].flatMap((num) =>
    ['', '_A', '_COMMON'].map((suffix) => `EP01_ACT04_SC${num}${suffix}`)
  );
  let paragraphs = 0,
    images = 0,
    decisions = 0;
  for (const id of ids) {
    const scene = story.scenes[id];
    for (let i = 0; i < scene.segments.length; i++) {
      const segment = scene.segments[i];
      paragraphs++;
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', id);
      await expect(page.getByTestId('dialogue-text')).toHaveText(segment.text);
      if (segment.kind === 'narration')
        await expect(page.locator('.dialogue-wrap .speaker-line')).toHaveCount(0);
      if (segment.cg) {
        images++;
        const asset = story.assets.find((a) => a.id === segment.cg)!,
          bytes = await readFile(asset.src);
        await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
        await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
          'naturalWidth',
          bytes.readUInt32BE(16)
        );
        await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
          'naturalHeight',
          bytes.readUInt32BE(20)
        );
        if (images === 1) {
          await expect(page.locator('.stage')).not.toHaveClass(/stage-black/);
          await expect(page.locator('.outgoing-cg')).toHaveCount(0);
          await expect(page.locator('.stage-blackout')).toHaveCSS('opacity', '0');
          await expect(page.getByTestId('scene-cg')).toHaveCSS('opacity', '1');
          await page.screenshot({
            path: `docs/screenshots/${info.project.name}-ep01-act04-waking-pov.png`,
            fullPage: true,
          });
        }
      }
      if (id === 'EP01_ACT04_SC04_A' && i === 0) await saveAndRestore(page, '存檔 03');
      const last = i === scene.segments.length - 1;
      if (last && scene.kind === 'choice') {
        decisions++;
        await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
        if (id === 'EP01_ACT04_SC03') await saveAndRestore(page, '存檔 02');
        await page.getByRole('button', { name: new RegExp(scene.choices[0].text) }).click();
      } else if (!(last && scene.kind === 'end'))
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
  }
  expect(paragraphs).toBe(140);
  expect(images).toBe(20);
  expect(decisions).toBe(5);
  await expect(page.locator('.stage')).toHaveClass(/stage-black/);
  await expect(page.locator('.stage-blackout')).toHaveCSS('opacity', '1');
  if (await page.getByRole('button', { name: '關閉通知', exact: true }).isVisible())
    await page.getByRole('button', { name: '關閉通知', exact: true }).click();
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
    '第四幕完 · 王女的職責'
  );
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
    'ACT V〈暫時留下的人〉'
  );
  await expect
    .poll(async () => {
      const card = await page.getByRole('region', { name: '章節完成' }).boundingBox(),
        text = await page.locator('.dialogue-wrap').boundingBox();
      return text!.y - card!.y - card!.height;
    })
    .toBeGreaterThanOrEqual(12);
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act04-finish.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(20);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const slot = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '存檔 04', exact: true }) });
  await slot.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('進度已儲存');
  const exported = page.waitForEvent('download');
  await slot.getByRole('button', { name: '匯出', exact: true }).click();
  const path = await (await exported).path(),
    saved = JSON.parse(await readFile(path!, 'utf8')).record.state;
  for (const [key, value] of Object.entries(act04CompletionFlags))
    expect(saved.flags[key]).toBe(value);
  expect(saved.decisionLog.slice(-5)).toEqual(
    ['01', '02', '03', '04', '05'].map((n) => `EP01_ACT04_SC${n}:A`)
  );
  expect(saved.flags.EP01_ACT02_PRIORITY).toBe('EASTERN_FRONT');
  expect(saved.readChapters).not.toContain('EP01');
  expect(errors).toEqual([]);
});
test('all ten alternative responses retain the choice CG and merge into the same common paragraphs', async ({
  page,
}) => {
  test.setTimeout(180000);
  const story = await loadContent();
  for (const answer of ['B', 'C']) {
    await start(page, story);
    for (const num of ['01', '02', '03', '04', '05']) {
      const id = `EP01_ACT04_SC${num}`,
        scene = story.scenes[id];
      await restoreScene(page, id);
      for (let i = 0; i < scene.segments.length - 1; i++)
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
      const choice = scene.choices.find((c) => c.id === answer)!;
      await page.getByRole('button', { name: new RegExp(choice.text) }).click();
      for (const segment of story.scenes[choice.next].segments) {
        await expect(page.getByTestId('dialogue-text')).toHaveText(segment.text);
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
      }
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', `${id}_COMMON`);
      await expect(page.getByTestId('dialogue-text')).toHaveText(
        story.scenes[`${id}_COMMON`].segments[0].text
      );
    }
  }
});
