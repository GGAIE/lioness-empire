import { restoreScene } from '../helpers/restore-scene';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { Story } from '../../packages/narrative-core/schema';
import { act03CompletionFlags } from '../../scripts/ep01-act03-parser';
import { act04CompletionFlags } from '../../scripts/ep01-act04-parser';
import { act05CompletionFlags } from '../../scripts/ep01-act05-parser';
async function start(page: Page, story: Story, end = false) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT04_SC01' },
  });
  Object.assign(state.flags, act03CompletionFlags, act04CompletionFlags, {
    EP01_ACT02_PRIORITY: 'EASTERN_FRONT',
  });
  state.decisionLog = [
    'EP01_ACT02_SC03:B',
    ...['02', '03', '04'].map((n) => `EP01_ACT03_SC${n}:A`),
    ...['01', '02', '03', '04', '05'].map((n) => `EP01_ACT04_SC${n}:C`),
  ];
  state.currentSceneId = end ? 'EP01_ACT05_SC05_COMMON' : 'EP01_ACT04_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  if (end) {
    state.campaign!.unrest = 80;
    state.campaign!.politicalPoints = 5;
  }
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'act04-end.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'test-entry',
          title: 'ACT IV end',
          savedAt: '2026-10-30',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  if (!end) await page.getByRole('button', { name: '進入 EP01 第五幕' }).click();
}
async function saveRestore(page: Page, name: string) {
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
test('ACT V continues the prior act, reads twenty original CGs and five choices, and closes EP01 with a resource notice', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const story = await loadContent(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page, story);
  const ids = ['01', '02', '03', '04', '05'].flatMap((n) =>
    ['', '_A', '_COMMON'].map((suffix) => `EP01_ACT05_SC${n}${suffix}`)
  );
  let paragraphs = 0,
    images = 0,
    choices = 0;
  for (const id of ids) {
    const scene = story.scenes[id];
    for (let i = 0; i < scene.segments.length; i++) {
      const segment = scene.segments[i];
      paragraphs++;
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', id);
      await expect(page.getByTestId('dialogue-text')).toHaveText(segment.text);
      if (segment.kind === 'narration')
        await expect(page.locator('.dialogue-wrap .speaker-line')).toHaveCount(0);
      if (segment.kind === 'dialogue' || segment.kind === 'thought')
        await expect(page.locator('.dialogue-wrap .speaker-line > span')).toHaveText(
          segment.speakerLabel ?? story.characters[segment.speaker!]
        );
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
        if (segment.cg === 'EP01-ACT05-CG03-01') {
          await expect(page.getByTestId('scene-cg')).toHaveCSS('opacity', '1');
          if (await page.getByRole('button', { name: '關閉通知', exact: true }).isVisible())
            await page.getByRole('button', { name: '關閉通知', exact: true }).click();
          await page.screenshot({
            path: `docs/screenshots/${info.project.name}-ep01-act05-father.png`,
            fullPage: true,
          });
        }
      }
      if (id === 'EP01_ACT05_SC03_A' && i === 0) await saveRestore(page, '存檔 02');
      const last = i === scene.segments.length - 1;
      if (last && scene.kind === 'choice') {
        choices++;
        await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
        if (id === 'EP01_ACT05_SC02') await saveRestore(page, '存檔 01');
        await page.getByRole('button', { name: new RegExp(scene.choices[0].text) }).click();
      } else if (!(last && scene.kind === 'end'))
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
  }
  expect(paragraphs).toBe(279);
  expect(images).toBe(20);
  expect(choices).toBe(5);
  const notice = page.getByRole('alertdialog');
  await expect(notice).toContainText('章末結算提醒');
  await expect(notice).toContainText('下一章 EP02 開局');
  await expect(notice).toContainText('此處僅預告');
  await expect(notice.getByTestId('political-points')).toHaveText('50');
  await expect(notice.getByTestId('unrest-value')).toHaveText('30 / 100');
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act05-settlement.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第一章完 · 王冠之前');
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('EP02〈留下來的人〉');
  await expect(page.locator('.stage-blackout')).toHaveCSS('opacity', '1');
  await expect
    .poll(async () => {
      const card = await page.getByRole('region', { name: '章節完成' }).boundingBox(),
        text = await page.locator('.dialogue-wrap').boundingBox();
      return text!.y - card!.y - card!.height;
    })
    .toBeGreaterThanOrEqual(12);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act05-finish.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '查看章末結算提醒' }).click();
  await expect(notice).toContainText('政治點數：50');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(20);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const slot = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '存檔 04', exact: true }) });
  await slot.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('進度已儲存');
  const download = page.waitForEvent('download');
  await slot.getByRole('button', { name: '匯出', exact: true }).click();
  const path = await (await download).path(),
    saved = JSON.parse(await readFile(path!, 'utf8')).record.state;
  expect(saved.readChapters).toContain('EP01');
  expect(saved.campaign.politicalPoints).toBe(50);
  expect(saved.campaign.unrest).toBe(30);
  expect(saved.campaign.upkeep).toEqual([]);
  for (const [key, value] of Object.entries(act05CompletionFlags))
    expect(saved.flags[key]).toBe(value);
  expect(saved.flags.EP01_ACT02_PRIORITY).toBe('EASTERN_FRONT');
  expect(saved.decisionLog.slice(-5)).toEqual(
    ['01', '02', '03', '04', '05'].map((n) => `EP01_ACT05_SC${n}:A`)
  );
  expect(errors).toEqual([]);
});
test('all ten alternate replies merge with the same CG, and the chapter ending warns about insufficient points without charging', async ({
  page,
}) => {
  test.setTimeout(240000);
  const story = await loadContent();
  for (const answer of ['B', 'C']) {
    await start(page, story);
    for (const num of ['01', '02', '03', '04', '05']) {
      const id = `EP01_ACT05_SC${num}`,
        scene = story.scenes[id];
      await restoreScene(page, id);
      for (let i = 0; i < scene.segments.length - 1; i++)
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
      const held = scene.segments.filter((s) => s.cg).at(-1)!.cg!,
        asset = story.assets.find((a) => a.id === held)!;
      const choice = scene.choices.find((c) => c.id === answer)!;
      await page.getByRole('button', { name: new RegExp(choice.text) }).click();
      await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
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
  await start(page, story, true);
  const notice = page.getByRole('alertdialog');
  await expect(notice).toContainText('章末結算警告');
  await expect(notice).toContainText('政治點數不足');
  await expect(notice).toContainText('此處僅預告，尚未扣點');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '查看章末結算提醒' }).click();
  await expect(notice.getByTestId('political-points')).toHaveText('5');
  await expect(notice.getByTestId('unrest-value')).toHaveText('80 / 100');
});

test('chapter completion uses the authored title and keeps its reminder, caption and controls separated', async ({
  page,
}, info) => {
  const story = await loadContent();
  await start(page, story, true);
  const notice = page.getByRole('alertdialog');
  await expect(notice).toContainText('本章：EP01 王冠之前');
  await expect(notice).toContainText('政治點數不足');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  const card = page.getByRole('region', { name: '章節完成' });
  await expect(card).toContainText('第一章完 · 王冠之前');
  await expect(page.locator('.stage-blackout')).toHaveCSS('opacity', '1');
  await expect
    .poll(async () => {
      const a = await card.locator('small').boundingBox(),
        b = await card.getByRole('button', { name: '查看章末結算提醒' }).boundingBox();
      return b!.y - a!.y - a!.height;
    })
    .toBeGreaterThanOrEqual(11);
  await expect
    .poll(async () => {
      const a = await card.boundingBox(),
        b = await page.locator('.dialogue-wrap').boundingBox();
      return b!.y - a!.y - a!.height;
    })
    .toBeGreaterThanOrEqual(12);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act05-completion-layout.png`,
    fullPage: true,
  });
  await card.getByRole('button', { name: '查看章末結算提醒' }).click();
  await expect(notice).toContainText('本章：EP01 王冠之前');
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep01-act05-warning.png`,
    fullPage: true,
  });
  await expect(notice.getByTestId('political-points')).toHaveText('5');
});
