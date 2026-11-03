import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
import type { Story } from '../../packages/narrative-core/schema';
async function start(page: Page, story: Story) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP02_ACT01_SC01' },
  });
  state.currentSceneId = 'EP02_ACT01_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.readChapters = ['EP01'];
  state.campaign!.upkeep = [{ chapter: 'EP02', unrest: 30, cost: 0 }];
  state.flags.EP01_ACT02_PRIORITY = 'EASTERN_FRONT';
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep02-act01-end.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'ACT01 end',
          savedAt: '2026-10-31',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP02 第二幕' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
}
async function saveRestore(page: Page, name = '存檔 01') {
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
for (const answer of ['A', 'B', 'C'])
  test(
    'ACT02 complete new screenplay and SCRIPT artwork: route ' + answer,
    async ({ page }, info) => {
      test.setTimeout(300000);
      const story = await loadContent(),
        errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await start(page, story);
      let count = 0,
        cues = 0,
        choices = 0;
      const unique = new Set<string>();
      for (let n = 1; n <= 5; n++)
        for (const suffix of ['', '_' + answer, '_COMMON']) {
          const id = 'EP02_ACT02_SC' + String(n).padStart(2, '0') + suffix,
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
              cues++;
              unique.add(p.cg);
              const asset = story.assets.find((a) => a.id === p.cg)!,
                png = await readFile(asset.src);
              expect(asset.src).toContain('_script-v1.');
              await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
              await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
                'naturalWidth',
                png.readUInt32BE(16)
              );
              await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
                'naturalHeight',
                png.readUInt32BE(20)
              );
              if (answer === 'A' && p.cg === 'EP02-ACT02-CG04-03') {
                await expect(page.getByTestId('scene-cg')).toHaveCSS('opacity', '1');
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.screenshot({
                  path: 'docs/screenshots/' + info.project.name + '-ep02-act02-tower.png',
                  fullPage: true,
                });
                await saveRestore(page);
              }
            }
            const last = i === scene.segments.length - 1;
            if (last && scene.kind === 'choice') {
              choices++;
              if (answer === 'A' && n === 5) await saveRestore(page, '存檔 02');
              await page
                .getByRole('button', {
                  name: new RegExp(scene.choices.find((c) => c.id === answer)!.text),
                })
                .click();
            } else if (!(last && scene.kind === 'end'))
              await page.getByRole('button', { name: '推進對話', exact: true }).click();
          }
        }
      expect(count).toBe(answer === 'A' ? 320 : 318);
      expect(cues).toBe(23);
      expect(unique.size).toBe(20);
      expect(choices).toBe(5);
      await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
        '第二幕完 · 王冠之外的責任'
      );
      await expect(page.getByRole('region', { name: '章節完成' })).toContainText('ACT III');
      await expect(page.locator('.stage-blackout')).toHaveCSS('opacity', '1');
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect
        .poll(async () => {
          const card = await page.getByRole('region', { name: '章節完成' }).boundingBox(),
            dialogue = await page.locator('.dialogue-wrap').boundingBox();
          return dialogue!.y - card!.y - card!.height;
        })
        .toBeGreaterThanOrEqual(12);
      if (answer === 'A') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: 'docs/screenshots/' + info.project.name + '-ep02-act02-finish.png',
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
        expect(saved.readChapters).not.toContain('EP02');
      }
      expect(errors).toEqual([]);
    }
  );
