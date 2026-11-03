import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import audit from '../../content/sources/ep04/act01-asset-audit.json' with { type: 'json' };

async function loadPreviousEnding(page: Page) {
  const story = await loadReaderContent(),
    id = 'EP03_ACT05_SC05_CH01_COMMON';
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.currentSegmentIndex = story.scenes[id].segments.length - 1;
  state.contentVersion = '0.11.1-ep03-act02-cg-fixed.reader-v1';
  state.readChapters = ['EP01', 'EP02'];
  state.flags.AIVIS_DEPARTED_EASTERN_FRONT = true;
  state.campaign!.upkeep = [{ chapter: 'EP03', unrest: 30, cost: 0 }];
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'old-ep03-ending.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'EP03 ending fixture',
          savedAt: '2026-11-02',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章末結算');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP04 第四章' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章初結算');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  return story;
}
for (const answer of ['A', 'B', 'C'])
  test(
    'EP04 ACT01 entire screenplay and all 25 selected CGs: ' + answer,
    async ({ page }, info) => {
      test.setTimeout(240000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/');
      await page.getByRole('button', { name: '設定', exact: true }).click();
      await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
      await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
      await page.getByRole('button', { name: '背景音樂', exact: true }).click();
      await page.getByLabel('選擇背景音樂').selectOption('BGM_SIGIL');
      await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
        '播放中'
      );
      await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
      const story = await loadPreviousEnding(page);
      let count = 0,
        choices = 0,
        cues = 0;
      for (let n = 1; n <= 5; n++)
        for (const suffix of ['', `_${answer}`, '_COMMON']) {
          const scene = story.scenes[`EP04_ACT01_SC0${n}${suffix}`];
          await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', scene.id);
          for (let i = 0; i < scene.segments.length; i++) {
            const p = scene.segments[i];
            count++;
            await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
            expect(p.text).not.toMatch(/SOURCE_REQUIRED|PROPOSAL|EP03|鏡頭|CLEAR|ACT01 END/);
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
              if (answer === 'A' && image.number === 15) {
                await expect(page.locator('.outgoing-cg')).toHaveCount(0);
                await expect(page.getByTestId('scene-cg')).toHaveCSS('opacity', '1');
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.screenshot({
                  path: `docs/screenshots/${info.project.name}-ep04-act01-officials.png`,
                  fullPage: true,
                });
              }
            }
            if (n === 3 && suffix === `_${answer}` && i === 0) {
              await page.getByRole('button', { name: '存讀檔', exact: true }).click();
              const slot = page
                .getByRole('article')
                .filter({ has: page.getByRole('heading', { name: '存檔 01', exact: true }) });
              await slot.getByRole('button', { name: '儲存', exact: true }).click();
              await slot.getByRole('button', { name: '讀取', exact: true }).click();
              await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
            }
            const last = i === scene.segments.length - 1;
            if (last && scene.kind === 'choice') {
              choices++;
              await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
              await page
                .getByLabel('劇情選項')
                .getByRole('button')
                .nth('ABC'.indexOf(answer))
                .click();
            } else if (!(last && scene.kind === 'end'))
              await page.getByRole('button', { name: '推進對話', exact: true }).click();
          }
        }
      expect([count, choices, cues]).toEqual([118, 5, 25]);
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
        '第一幕完 · 攝政之日'
      );
      await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
        '第二幕〈薩克迪之亡〉'
      );
      await expect(page.getByRole('button', { name: '查看章末結算提醒', exact: true })).toHaveCount(
        0
      );
      await expect(page.getByTestId('background-music')).toHaveJSProperty('paused', false);
      await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
        '50'
      );
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
      expect(saved.readChapters).toContain('EP03');
      expect(saved.readChapters).not.toContain('EP04');
      expect(saved.campaign.upkeep).toHaveLength(2);
      expect(saved.campaign.politicalPoints).toBe(50);
      expect(saved.campaign.unrest).toBe(30);
      expect(saved.decisionLog).toHaveLength(5);
      expect(saved.flags.OLIVIA_REGENCY_AUTHORITY).toBe(false);
      expect(errors).toEqual([]);
    }
  );
