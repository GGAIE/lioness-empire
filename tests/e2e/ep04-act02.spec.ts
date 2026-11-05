import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { GameState } from '../../packages/narrative-core/schema';
import audit from '../../content/sources/ep04/act02-asset-audit.json' with { type: 'json' };

async function importState(page: Page, state: GameState) {
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep04-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'entry fixture',
          savedAt: '2026-11-03',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
}
async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
for (const [answer, f1] of [
  ['A', '1'],
  ['C', '2'],
])
  test(`EP04 ACT02 complete screenplay, 25 final originals and F1 ${f1}`, async ({
    page,
  }, info) => {
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page);
    await page.getByRole('button', { name: '背景音樂', exact: true }).click();
    await page.getByLabel('選擇背景音樂').selectOption('BGM_SIGIL');
    await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
      '播放中'
    );
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    const story = await loadReaderContent(),
      id = 'EP04_ACT01_SC05_COMMON';
    const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.currentSegmentIndex = story.scenes[id].segments.length - 1;
    state.contentVersion = '0.12.0-ep04-act01-v1.0-art-selected-v0.1.reader-v1';
    state.readChapters = ['EP01', 'EP02', 'EP03'];
    state.campaign!.upkeep = [{ chapter: 'EP04', unrest: 30, cost: 0 }];
    delete state.flags.FINLEY_RESEARCH_F1_STATE;
    await importState(page, state);
    await expect(page.getByRole('button', { name: '進入第二幕 →', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '進入第二幕 →', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    let paragraphs = 0,
      choices = 0,
      cues = 0;
    for (let n = 1; n <= 6; n++) {
      const selected = n === 6 ? f1 : answer;
      for (const suffix of ['', '_' + selected, '_COMMON']) {
        const scene = story.scenes[`EP04_ACT02_SC0${n}${suffix}`];
        await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', scene.id);
        for (let i = 0; i < scene.segments.length; i++) {
          const p = scene.segments[i];
          paragraphs++;
          await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
          if (p.speaker)
            await expect(page.locator('.dialogue-wrap .speaker-line>span')).toHaveText(
              p.speakerLabel ?? story.characters[p.speaker]
            );
          else await expect(page.locator('.dialogue-wrap .speaker-line')).toHaveCount(0);
          if (p.cg) {
            cues++;
            const image = audit.images.find((a) => a.id === p.cg)!;
            await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + image.path);
            await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
              'naturalWidth',
              image.width
            );
            await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
              'naturalHeight',
              image.height
            );
          }
          if (n === 6 && suffix === '_' + selected && i === 0) {
            await expect(
              page.locator('.shell>.resource-hud').getByTestId('political-points')
            ).toHaveText(f1 === '1' ? '40' : '50');
            await page.getByRole('button', { name: '存讀檔', exact: true }).click();
            const slot = page
              .getByRole('article')
              .filter({ has: page.getByRole('heading', { name: '存檔 01', exact: true }) });
            await slot.getByRole('button', { name: '儲存', exact: true }).click();
            await slot.getByRole('button', { name: '讀取', exact: true }).click();
            await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
            await expect(
              page.locator('.shell>.resource-hud').getByTestId('political-points')
            ).toHaveText(f1 === '1' ? '40' : '50');
          }
          const last = i === scene.segments.length - 1;
          if (last && scene.kind === 'choice') {
            choices++;
            const buttons = page.getByLabel('劇情選項').getByRole('button');
            await expect(buttons).toHaveCount(n === 6 ? 2 : 3);
            if (n === 6) {
              await expect(buttons.nth(0)).toContainText('「我知道塔馬拉那邊好像有。」');
              await expect(buttons.nth(1)).toContainText('「裝傻。」');
              if (answer === 'A') {
                await page.screenshot({
                  path: `docs/screenshots/${info.project.name}-ep04-act02-f1.png`,
                  fullPage: true,
                });
              }
            }
            await buttons.nth(n === 6 ? Number(f1) - 1 : 'ABC'.indexOf(selected)).click();
          } else if (!(last && scene.kind === 'end'))
            await page.getByRole('button', { name: '推進對話', exact: true }).click();
        }
      }
    }
    expect(paragraphs).toBeGreaterThan(150);
    expect([choices, cues]).toEqual([6, 25]);
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
      '第三幕〈各自的難題〉'
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '查看章末結算提醒', exact: true })).toHaveCount(
      0
    );
    await expect(page.getByTestId('background-music')).toHaveJSProperty('paused', false);
    await page.getByRole('button', { name: '鑑賞', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(25);
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    await page.getByRole('button', { name: '存讀檔', exact: true }).click();
    const slot = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: '存檔 02', exact: true }) });
    await slot.getByRole('button', { name: '儲存', exact: true }).click();
    const downloaded = page.waitForEvent('download');
    await slot.getByRole('button', { name: '匯出', exact: true }).click();
    const saved = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8')).record
      .state;
    expect(saved.flags.FINLEY_RESEARCH_F1_STATE).toBe(f1 === '1' ? 'ACTIVE' : 'DECLINED');
    expect(saved.campaign.politicalPoints).toBe(f1 === '1' ? 40 : 50);
    expect(saved.campaign.unrest).toBe(30);
    expect(saved.campaign.upkeep).toHaveLength(1);
    expect(saved.readChapters).not.toContain('EP04');
    expect(saved.decisionLog).toHaveLength(6);
    expect(saved.clear).toEqual(state.clear);
    expect(saved.politicalScore).toBe(state.politicalScore);
    expect(errors).toEqual([]);
  });
test('F1 keeps exactly two answers and explains insufficient points without charging or hiding the decline', async ({
  page,
}) => {
  const story = await loadReaderContent(),
    id = 'EP04_ACT02_SC06';
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.currentSegmentIndex = story.scenes[id].segments.length - 1;
  state.campaign!.politicalPoints = 9;
  await setup(page);
  await importState(page, state);
  const buttons = page.getByLabel('劇情選項').getByRole('button');
  await expect(buttons).toHaveCount(2);
  await expect(buttons.nth(0)).toBeDisabled();
  await expect(buttons.nth(0)).toContainText('政治點數不足，需要 10 點');
  await expect(buttons.nth(1)).toBeEnabled();
  await buttons.nth(1).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP04_ACT02_SC06_2');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '9'
  );
});
