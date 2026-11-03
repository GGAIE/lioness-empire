import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent, root } from '../../scripts/load-content';
import {
  initialState,
  advance,
  choose,
  continueChapter,
  visibleSegments,
  markRead,
} from '../../packages/narrative-core/engine';
import type { GameState } from '../../packages/narrative-core/schema';

async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
async function importState(page: Page, state: GameState) {
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep04-continuation.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'continuation fixture',
          savedAt: '2026-11-03',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
}
async function saveAndReload(page: Page) {
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const slot = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '存檔 01', exact: true }) });
  await slot.getByRole('button', { name: '儲存', exact: true }).click();
  await slot.getByRole('button', { name: '讀取', exact: true }).click();
}
for (const active of [true, false])
  test(`EP04 ACT03-ACT05 complete ${active ? 'research and maximum gain' : 'declined research and formal-review cost'} route`, async ({
    page,
  }, info) => {
    test.setTimeout(480000);
    const errors: string[] = [],
      requests: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => requests.push(r.url()));
    const story = await loadReaderContent(),
      audits = [];
    for (const act of [3, 4, 5])
      audits.push(
        JSON.parse(
          await readFile(`${root}/content/sources/ep04/act0${act}-asset-audit.json`, 'utf8')
        )
      );
    const images = audits.flatMap((a) => a.images);
    await setup(page);
    await page.getByRole('button', { name: '背景音樂', exact: true }).click();
    await page.getByLabel('選擇背景音樂').selectOption('BGM_SIGIL');
    await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
      '播放中'
    );
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    const id = 'EP04_ACT02_SC06_COMMON';
    let state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
    state.currentSegmentIndex = story.scenes[id].segments.length - 1;
    state.contentVersion = '0.12.1-ep04-act02-v1.0-art-final-v0.3.reader-v1';
    state.flags.FINLEY_RESEARCH_F1_STATE = active ? 'ACTIVE' : 'DECLINED';
    state.campaign!.politicalPoints = active ? 40 : 50;
    state.campaign!.upkeep = [{ chapter: 'EP04', unrest: 30, cost: 0 }];
    state.readChapters = ['EP01', 'EP02', 'EP03'];
    await importState(page, state);
    await page.getByRole('button', { name: '進入第三幕 →', exact: true }).click();
    state = continueChapter(story, state);
    const seen = new Set<string>(),
      visited = new Set<string>();
    let paragraphs = 0,
      choices = 0;
    for (const act of [3, 4, 5]) {
      let localChoice = 0,
        guard = 0;
      while (++guard < 1000) {
        const scene = story.scenes[state.currentSceneId],
          p = visibleSegments(story, state)[state.currentSegmentIndex];
        visited.add(scene.id);
        paragraphs++;
        await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', scene.id);
        await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
        expect(p.text).not.toMatch(/EP0\d|ACT0\d|本場進入哪|本 Scene|SOURCE_REQUIRED|畫面暗下/);
        if (p.speaker)
          await expect(page.locator('.dialogue-wrap .speaker-line>span')).toHaveText(
            p.speakerLabel ?? story.characters[p.speaker]
          );
        else await expect(page.locator('.dialogue-wrap .speaker-line')).toHaveCount(0);
        if (p.cg) {
          seen.add(p.cg);
          const image = images.find((i) => i.id === p.cg)!;
          await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + image.path);
          await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', image.width);
          await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
            'naturalHeight',
            image.height
          );
          if (active && ['EP04-ACT03-CG01', 'EP04-ACT04-CG10', 'EP04-ACT05-CG15'].includes(p.cg)) {
            await expect(page.locator('.outgoing-cg')).toHaveCount(0);
            await expect(page.getByTestId('scene-cg')).toHaveCSS('opacity', '1');
            await page.screenshot({
              path: `docs/screenshots/${info.project.name}-${p.cg.toLowerCase()}.png`,
              fullPage: true,
            });
          }
        }
        const last = state.currentSegmentIndex === visibleSegments(story, state).length - 1;
        if (scene.id === 'EP04_ACT04_SC05' && last) {
          await expect(
            page.locator('.shell>.resource-hud').getByTestId('political-points')
          ).toHaveText('60');
          await saveAndReload(page);
          await expect(
            page.locator('.shell>.resource-hud').getByTestId('political-points')
          ).toHaveText('60');
        }
        if (last && scene.kind === 'choice') {
          const answer =
            act === 3 ? (active ? '1' : '2') : active ? '1' : localChoice === 4 ? '4' : '3';
          const buttons = page.getByLabel('劇情選項').getByRole('button');
          await expect(buttons).toHaveCount(scene.choices.length);
          await buttons.nth(Number(answer) - 1).click();
          state = choose(story, state, answer);
          localChoice++;
          choices++;
          if (act === 5 && localChoice >= 4)
            await expect(
              page.locator('.shell>.resource-hud').getByTestId('political-points')
            ).toHaveText(String(state.campaign!.politicalPoints));
        } else if (last && scene.kind === 'end') {
          state = markRead(story, state);
          if (act < 5) {
            await expect(page.getByRole('alertdialog')).toHaveCount(0);
            await expect(
              page.getByRole('button', { name: '查看章末結算提醒', exact: true })
            ).toHaveCount(0);
            await page
              .getByRole('button', {
                name: act === 3 ? '進入第四幕 →' : '進入第五幕 →',
                exact: true,
              })
              .click();
            state = continueChapter(story, state);
          }
          break;
        } else {
          await page.getByRole('button', { name: '推進對話', exact: true }).click();
          state = advance(story, state);
        }
      }
      expect(guard).toBeLessThan(1000);
    }
    expect(paragraphs).toBeGreaterThan(450);
    expect(choices).toBe(8);
    expect(seen.size).toBe(active ? 61 : 57);
    expect(visited.has('EP04_ACT04_SC05')).toBe(active);
    if (!active)
      for (const image of images.filter((i) =>
        ['EP04-ACT03-CG22', 'EP04-ACT04-CG09', 'EP04-ACT04-CG10', 'EP04-ACT04-CG11'].includes(i.id)
      ))
        expect(requests.some((url) => url.includes(image.path))).toBe(false);
    await expect(page.getByRole('alertdialog')).toContainText('章末結算');
    await expect(page.getByRole('alertdialog')).toContainText(`章末政治點數：${active ? 85 : 45}`);
    await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
    await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
      '第五章〈攝政成為習慣〉'
    );
    const musicState = await page
      .getByTestId('background-music')
      .evaluate((a: HTMLAudioElement) => ({
        paused: a.paused,
        time: a.currentTime,
        duration: a.duration,
        ended: a.ended,
        error: a.error?.code,
      }));
    await expect(page.getByTestId('background-music'), JSON.stringify(musicState)).toHaveJSProperty(
      'paused',
      false
    );
    await page.getByRole('button', { name: '鑑賞', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(active ? 61 : 57);
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    await page.getByRole('button', { name: '存讀檔', exact: true }).click();
    const slot = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: '存檔 02', exact: true }) });
    await slot.getByRole('button', { name: '儲存', exact: true }).click();
    const download = page.waitForEvent('download');
    await slot.getByRole('button', { name: '匯出', exact: true }).click();
    const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8')).record
      .state;
    expect(exported.campaign.politicalPoints).toBe(active ? 85 : 45);
    expect(exported.campaign.unrest).toBe(30);
    expect(exported.campaign.upkeep).toHaveLength(1);
    expect(exported.flags.FINLEY_RESEARCH_F1_STATE).toBe(active ? 'CLEARED' : 'DECLINED');
    expect(exported.readChapters).toContain('EP04');
    expect(exported.decisionLog).toHaveLength(8);
    expect(exported.clear).toEqual(state.clear);
    expect(exported.politicalScore).toBe(60);
    expect(errors).toEqual([]);
  });

test('free reading hides the unavailable F1 scene and completion rewards survive already-read last-line restore and replay', async ({
  page,
}) => {
  test.setTimeout(120000);
  await setup(page);
  await page.getByRole('button', { name: '其他選項', exact: true }).click();
  await page.getByLabel('劇情密碼', { exact: true }).fill('best');
  await page.getByRole('button', { name: '解鎖劇情', exact: true }).click();
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '章節目錄', exact: true }).click();
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  await expect(page.locator('.directory-sections button:enabled')).toHaveCount(109);
  await expect(
    page.locator('.directory-sections button').filter({ hasText: '芬利的答謝' })
  ).toHaveCount(0);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  const story = await loadReaderContent(),
    id = 'EP04_ACT04_SC05';
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.flags.FINLEY_RESEARCH_F1_STATE = 'MATERIAL_OBTAINED';
  state.campaign!.politicalPoints = 40;
  state.currentSegmentIndex = story.scenes[id].segments.length - 1;
  state.readSegments = [`${id}:${story.scenes[id].segments.at(-1)!.id}`];
  await importState(page, state);
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '60'
  );
  await saveAndReload(page);
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '60'
  );
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  await expect(page.locator('.directory-sections button:enabled')).toHaveCount(110);
  await expect(
    page.locator('.directory-sections button').filter({ hasText: '芬利的答謝' })
  ).toHaveCount(1);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await importState(page, {
    ...state,
    flags: { ...state.flags, FINLEY_RESEARCH_F1_STATE: 'DECLINED' },
  });
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP04_ACT04_SC06');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '40'
  );
});
