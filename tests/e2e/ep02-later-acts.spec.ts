import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { GameState, Story } from '../../packages/narrative-core/schema';
async function importState(page: Page, state: GameState) {
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep02-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'EP02 source continuation',
          savedAt: '2026-10-31',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
}
async function prepare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
function seed(story: Story, id = 'EP02_ACT02_SC05_COMMON') {
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP02_ACT02_SC01' },
  });
  state.currentSceneId = id;
  state.currentSegmentIndex = story.scenes[id].segments.length - 1;
  state.readChapters = ['EP01'];
  state.campaign!.upkeep = [{ chapter: 'EP02', unrest: 30, cost: 0 }];
  state.contentVersion = '0.9.0-ep02-act02-script-v1.1-art-v1.2';
  delete state.flags.AIVIS_DEPARTED_EASTERN_FRONT;
  return state;
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
test('reads all three later acts, 844 A-route paragraphs and 73 real CGs through chapter settlement', async ({
  page,
}, info) => {
  test.setTimeout(600000);
  const story = await loadContent(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await prepare(page);
  await page.getByRole('button', { name: '背景音樂', exact: true }).click();
  await page.getByLabel('選擇背景音樂').selectOption('BGM_MOTIF');
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
    '播放中'
  );
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await importState(page, seed(story));
  await page.getByRole('button', { name: '進入 EP02 第三幕' }).click();
  let count = 0,
    real = 0,
    missing = 0,
    choices = 0;
  for (const a of [3, 4, 5]) {
    for (let n = 1; n <= 5; n++)
      for (const suffix of ['', '_A', '_COMMON']) {
        const id = 'EP02_ACT0' + a + '_SC0' + n + suffix,
          scene = story.scenes[id];
        for (let i = 0; i < scene.segments.length; i++) {
          const p = scene.segments[i];
          count++;
          await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', id);
          await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
          if (p.speaker)
            await expect(page.locator('.dialogue-wrap .speaker-line > span')).toHaveText(
              p.speakerLabel ?? story.characters[p.speaker]
            );
          else await expect(page.locator('.dialogue-wrap .speaker-line')).toHaveCount(0);
          if (p.cg) {
            const asset = story.assets.find((x) => x.id === p.cg)!;
            if (asset.status === 'PLACEHOLDER') {
              missing++;
              await expect(page.getByTestId('scene-cg')).toHaveCount(0);
              await expect(page.locator('.stage .missing')).toContainText('此張插圖待補');
            } else {
              real++;
              const bytes = await readFile(asset.src);
              await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
              await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
                'naturalWidth',
                bytes.readUInt32BE(16)
              );
            }
          }
          if (id === 'EP02_ACT04_SC04_A' && i === 0) await saveRestore(page, '存檔 01');
          if (a === 5 && p.cg === 'EP02-ACT05-CG04-18') await saveRestore(page, '存檔 02');
          const last = i === scene.segments.length - 1;
          if (last && scene.kind === 'choice') {
            choices++;
            await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(
              a === 3 && n === 1 ? 2 : 3
            );
            await page.getByRole('button', { name: new RegExp(scene.choices[0].text) }).click();
          } else if (!(last && scene.kind === 'end'))
            await page.getByRole('button', { name: '推進對話', exact: true }).click();
        }
      }
    if (a < 5) {
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(page.getByTestId('background-music')).toHaveJSProperty('paused', false);
      await page
        .getByRole('button', { name: '進入 EP02 第' + (a === 3 ? '四' : '五') + '幕' })
        .click();
    }
  }
  expect([count, real, missing, choices]).toEqual([844, 73, 0, 15]);
  await expect(page.getByRole('alertdialog')).toContainText('章末結算');
  await expect(page.getByRole('alertdialog').getByTestId('political-points')).toHaveText('50');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
    '第二章完 · 留下來的人'
  );
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('EP03');
  await expect
    .poll(async () => {
      const c = await page.getByRole('region', { name: '章節完成' }).boundingBox(),
        d = await page.locator('.dialogue-wrap').boundingBox();
      return d!.y - c!.y - c!.height;
    })
    .toBeGreaterThanOrEqual(12);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'docs/screenshots/' + info.project.name + '-ep02-complete.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(73);
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
  expect(saved.flags.AIVIS_DEPARTED_EASTERN_FRONT).toBe(true);
  expect(saved.flags.OLIVIA_REGENCY_AUTHORITY).toBe(false);
  expect(saved.campaign.politicalPoints).toBe(50);
  expect(saved.campaign.unrest).toBe(30);
  expect(saved.campaign.upkeep).toHaveLength(1);
  expect(saved.readChapters).toContain('EP02');
  expect(saved.decisionLog).toHaveLength(15);
  expect(errors).toEqual([]);
});
test('all 29 alternative answers render and merge on the source CG without claiming a whole chapter', async ({
  page,
}) => {
  test.setTimeout(300000);
  const story = await loadContent();
  await prepare(page);
  let tested = 0;
  for (const a of [3, 4, 5])
    for (let n = 1; n <= 5; n++) {
      const id = 'EP02_ACT0' + a + '_SC0' + n,
        scene = story.scenes[id];
      for (const answer of scene.choices.slice(1)) {
        const state = seed(story, id);
        state.contentVersion = story.manifest.version;
        await importState(page, state);
        await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(
          scene.choices.length
        );
        await page.getByRole('button', { name: new RegExp(answer.text) }).click();
        const branch = story.scenes[answer.next];
        for (let i = 0; i < branch.segments.length; i++) {
          await expect(page.getByTestId('dialogue-text')).toHaveText(branch.segments[i].text);
          await page.getByRole('button', { name: '推進對話', exact: true }).click();
        }
        await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', id + '_COMMON');
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        tested++;
      }
    }
  expect(tested).toBe(29);
});
