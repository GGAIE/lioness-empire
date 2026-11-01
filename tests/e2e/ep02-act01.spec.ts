import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { Story } from '../../packages/narrative-core/schema';
async function start(page: Page, story: Story, points = 50, unrest = 30) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT05_SC01' },
  });
  state.currentSceneId = 'EP01_ACT05_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.flags.EP01_ACT02_PRIORITY = 'EASTERN_FRONT';
  state.decisionLog = [
    'EP01_ACT02_SC03:B',
    ...['02', '03', '04'].map((n) => `EP01_ACT03_SC${n}:A`),
    ...['01', '02', '03', '04', '05'].flatMap((n) => [
      `EP01_ACT04_SC${n}:B`,
      `EP01_ACT05_SC${n}:C`,
    ]),
  ];
  state.campaign!.politicalPoints = points;
  state.campaign!.unrest = unrest;
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep01-end.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'test-entry',
          title: 'EP01 end',
          savedAt: '2026-10-31',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章末結算');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect
    .poll(async () => {
      const card = await page.getByRole('region', { name: '章節完成' }).boundingBox(),
        heading = await page.locator('.scene-heading').boundingBox();
      return card!.y - heading!.y - heading!.height;
    })
    .toBeGreaterThanOrEqual(10);
  await page.getByRole('button', { name: '進入 EP02 第一幕' }).click();
  if (points >= (unrest >= 71 ? 40 : 0)) {
    await expect(page.getByRole('alertdialog')).toContainText('章初結算通知');
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  }
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
test('EP02 reads 270 paragraphs, all twenty original CGs and five choices with complete speaker headers', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const story = await loadContent(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page, story);
  let count = 0,
    images = 0,
    choices = 0;
  const ids = ['01', '02', '03', '04', '05'].flatMap((n) =>
    ['', '_A', '_COMMON'].map((suffix) => `EP02_ACT01_SC${n}${suffix}`)
  );
  for (const id of ids) {
    const scene = story.scenes[id];
    for (let i = 0; i < scene.segments.length; i++) {
      const segment = scene.segments[i];
      count++;
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', id);
      await expect(page.getByTestId('dialogue-text')).toHaveText(segment.text);
      if (segment.speaker)
        await expect(page.locator('.dialogue-wrap .speaker-line > span')).toHaveText(
          segment.speakerLabel ?? story.characters[segment.speaker]
        );
      else await expect(page.locator('.dialogue-wrap .speaker-line')).toHaveCount(0);
      if (segment.cg) {
        images++;
        const asset = story.assets.find((a) => a.id === segment.cg)!,
          png = await readFile(asset.src);
        await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
        await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
          'naturalWidth',
          png.readUInt32BE(16)
        );
        await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
          'naturalHeight',
          png.readUInt32BE(20)
        );
        if (segment.cg === 'EP02-ACT01-CG03-01') {
          await expect(page.getByTestId('scene-cg')).toHaveCSS('opacity', '1');
          await page.screenshot({
            path: `docs/screenshots/${info.project.name}-ep02-act01-alinda.png`,
            fullPage: true,
          });
        }
      }
      if (id === 'EP02_ACT01_SC03_A' && i === 0) await saveRestore(page, '存檔 02');
      const last = i === scene.segments.length - 1;
      if (last && scene.kind === 'choice') {
        choices++;
        if (id === 'EP02_ACT01_SC02') await saveRestore(page, '存檔 01');
        await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
        await page.getByRole('button', { name: new RegExp(scene.choices[0].text) }).click();
      } else if (!(last && scene.kind === 'end'))
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
  }
  expect(count).toBe(270);
  expect(images).toBe(20);
  expect(choices).toBe(5);
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
    '第一幕完 · 重新升起的王旗'
  );
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
    'ACT II〈王冠之外的責任〉'
  );
  await expect(page.locator('.stage-blackout')).toHaveCSS('opacity', '1');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect
    .poll(async () => {
      const a = await page.getByRole('region', { name: '章節完成' }).boundingBox(),
        b = await page.locator('.dialogue-wrap').boundingBox();
      return b!.y - a!.y - a!.height;
    })
    .toBeGreaterThanOrEqual(12);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep02-act01-finish.png`,
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
  const downloaded = page.waitForEvent('download');
  await slot.getByRole('button', { name: '匯出', exact: true }).click();
  const path = await (await downloaded).path(),
    saved = JSON.parse(await readFile(path!, 'utf8')).record.state;
  expect(saved.campaign.politicalPoints).toBe(50);
  expect(saved.campaign.unrest).toBe(30);
  expect(saved.campaign.upkeep).toEqual([{ chapter: 'EP02', unrest: 30, cost: 0 }]);
  expect(saved.flags.EP01_ACT02_PRIORITY).toBe('EASTERN_FRONT');
  expect(saved.flags.OLIVIA_REGENCY_AUTHORITY).toBe(false);
  expect(saved.readChapters).toContain('EP01');
  expect(saved.readChapters).not.toContain('EP02');
  expect(saved.decisionLog.slice(-5)).toEqual(
    ['01', '02', '03', '04', '05'].map((n) => `EP02_ACT01_SC${n}:A`)
  );
  expect(errors).toEqual([]);
});
test('ten alternative responses keep their CG and merge without permanent information flags', async ({
  page,
}) => {
  test.setTimeout(240000);
  const story = await loadContent();
  for (const answer of ['B', 'C']) {
    await start(page, story);
    for (const num of ['01', '02', '03', '04', '05']) {
      const id = `EP02_ACT01_SC${num}`,
        scene = story.scenes[id];
      await page.getByRole('button', { name: '開發', exact: true }).click();
      await page.getByLabel('開發場景跳轉').selectOption(id);
      for (let i = 0; i < scene.segments.length - 1; i++)
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
      const choice = scene.choices.find((c) => c.id === answer)!;
      await page.getByRole('button', { name: new RegExp(choice.text) }).click();
      for (const p of story.scenes[choice.next].segments) {
        await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
        if (p.speaker)
          await expect(page.locator('.speaker-line > span')).toHaveText(p.speakerLabel!);
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
      }
      await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', `${id}_COMMON`);
    }
  }
});
test('chapter entry charges once, directory replay preserves the receipt, and insufficient funds preserve EP01', async ({
  page,
}, info) => {
  const story = await loadContent();
  await start(page, story, 100, 80);
  await expect(page.locator('.page-footer')).toContainText('EP02 第一幕 v0.9 · 草稿試演');
  await expect(page.locator('.right-rail span').last()).toHaveText('二');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep02-entry.png`,
    fullPage: true,
  });
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '60'
  );
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  const ep01 = page
    .locator('.directory-chapter')
    .filter({ has: page.getByRole('heading', { name: '王冠之前', exact: true }) });
  await ep01.getByRole('button', { name: /學院的早晨/ }).click();
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  const ep02 = page
    .locator('.directory-chapter')
    .filter({ has: page.getByRole('heading', { name: '留下來的人', exact: true }) });
  await expect(ep02).toContainText('已提供 5 / 5 幕');
  await ep02.getByRole('button', { name: /晨鐘再響/ }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP02_ACT01_SC01');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '60'
  );
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await start(page, story, 5, 80);
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-scene-id',
    'EP01_ACT05_SC05_COMMON'
  );
  await expect(page.getByRole('status')).toContainText('點數不足');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '5'
  );
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep02-entry-blocked.png`,
    fullPage: true,
  });
});
