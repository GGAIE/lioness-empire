import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { loadReaderContent as loadContent } from '../../scripts/load-content';
import { initialState, currentCg } from '../../packages/narrative-core/engine';
import type { GameState, Story } from '../../packages/narrative-core/schema';
import audit from '../../content/sources/ep03/asset-audit.json' with { type: 'json' };

function seed(story: Story, id = 'EP03_ACT01_SC01') {
  const state = initialState({ ...story, manifest: { ...story.manifest, start: id } });
  state.readChapters = ['EP01', 'EP02'];
  state.flags.AIVIS_DEPARTED_EASTERN_FRONT = true;
  state.campaign!.upkeep = [
    { chapter: 'EP02', unrest: 30, cost: 0 },
    { chapter: 'EP03', unrest: 30, cost: 0 },
  ];
  return state;
}
async function importState(page: Page, state: GameState) {
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep03-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'EP03 test fixture',
          savedAt: '2026-11-01',
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
test('reads every A-route paragraph in all five acts, all main CGs, music and final settlement', async ({
  page,
}, info) => {
  test.setTimeout(900000);
  const story = await loadContent(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.text().startsWith('EP03_MEDIA:'))
      console.log(info.project.name + ' ' + message.text());
  });
  await prepare(page);
  await page.getByRole('button', { name: '背景音樂', exact: true }).click();
  await page.getByLabel('選擇背景音樂').selectOption('BGM_MOTIF');
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
    '播放中'
  );
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await importState(page, seed(story));
  await page.getByTestId('background-music').evaluate((a: HTMLAudioElement) => {
    for (const event of ['pause', 'ended', 'error'])
      a.addEventListener(event, () =>
        console.log(
          'EP03_MEDIA:' +
            JSON.stringify({
              event,
              time: a.currentTime,
              duration: a.duration,
              ended: a.ended,
              paused: a.paused,
              error: a.error?.code,
              visibility: document.visibilityState,
            })
        )
      );
  });
  let id = 'EP03_ACT01_SC01',
    count = 0,
    choices = 0,
    completions = 0;
  const real = new Set<string>(),
    missing = new Set<string>();
  for (let guard = 0; guard < 110; guard++) {
    const scene = story.scenes[id];
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', id);
    for (let i = 0; i < scene.segments.length; i++) {
      const p = scene.segments[i];
      count++;
      await expect(page.getByTestId('dialogue-text')).toHaveText(p.text);
      if (p.speaker)
        await expect(page.locator('.dialogue-wrap .speaker-line > span')).toHaveText(
          p.speakerLabel ?? story.characters[p.speaker]
        );
      else await expect(page.locator('.dialogue-wrap .speaker-line')).toHaveCount(0);
      const image = p.cg ?? (i === 0 ? scene.cg : undefined);
      if (image && p.visual !== 'BLACK') {
        const asset = story.assets.find((a) => a.id === image)!;
        if (asset.status === 'PLACEHOLDER') {
          missing.add(image);
          await expect(page.getByTestId('scene-cg')).toHaveCount(0);
          await expect(page.locator('.stage .missing')).toContainText('此張插圖待補');
        } else {
          real.add(image);
          const original = audit.images.find((a) => a.id === image)!;
          await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.src);
          await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
            'naturalWidth',
            original.width
          );
          await expect(page.getByTestId('scene-cg')).toHaveJSProperty(
            'naturalHeight',
            original.height
          );
        }
      }
      if (i < scene.segments.length - 1)
        await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
    if (scene.kind === 'choice') {
      choices++;
      await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
      if (id.includes('ACT05') && scene.sceneNumber === 4) {
        await page.screenshot({
          path: `docs/screenshots/${info.project.name}-ep03-act05-choice-${choices}.png`,
          fullPage: true,
        });
      }
      await page.getByLabel('劇情選項').getByRole('button').first().click();
      id = scene.choices[0].next;
    } else if (scene.next) {
      await page.getByRole('button', { name: '推進對話', exact: true }).click();
      id = scene.next;
    } else if (scene.completion?.scope === 'ACT') {
      completions++;
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(page.getByTestId('background-music')).toHaveJSProperty('paused', false);
      await expect
        .poll(async () => {
          const card = await page.getByRole('region', { name: '章節完成' }).boundingBox(),
            dialogue = await page.locator('.dialogue-wrap').boundingBox();
          return dialogue!.y - card!.y - card!.height;
        })
        .toBeGreaterThanOrEqual(12);
      await page
        .getByRole('button', { name: scene.completion.continueLabel! + ' →', exact: true })
        .click();
      id = scene.completion.nextSceneId!;
    } else break;
  }
  expect([choices, completions, real.size, missing.size]).toEqual([20, 4, 129, 0]);
  await expect(page.getByRole('alertdialog')).toContainText('章末結算');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText(
    '第三章完 · 東北塔的議員們'
  );
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('EP04');
  await expect(page.getByRole('button', { name: /進入 EP04/ })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ep03-complete.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(129);
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const slot = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '存檔 03', exact: true }) });
  await slot.getByRole('button', { name: '儲存', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await slot.getByRole('button', { name: '匯出', exact: true }).click();
  const saved = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8')).record.state;
  expect(saved.readChapters).toContain('EP03');
  expect(saved.decisionLog).toHaveLength(20);
  expect(saved.campaign.politicalPoints).toBe(50);
  expect(saved.campaign.unrest).toBe(30);
  expect(saved.campaign.upkeep).toHaveLength(2);
  expect(saved.flags.OLIVIA_REGENCY_AUTHORITY).toBe(false);
  expect(errors).toEqual([]);
  console.log(
    `${info.project.name}: EP03 ${count} paragraphs, ${real.size} real CGs, ${missing.size} explicit gaps`
  );
});

test('all nine exclusive branch illustrations display and return to their common CG', async ({
  page,
}) => {
  test.setTimeout(180000);
  const story = await loadContent();
  await prepare(page);
  for (const asset of audit.images.filter((a) => a.id.includes('ALT_CH'))) {
    const branch = Object.values(story.scenes).find(
      (s) => s.chapter === 'EP03' && s.cg === asset.id
    )!;
    await importState(page, seed(story, branch.id));
    await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', '/' + asset.path);
    await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', asset.width);
    for (let i = 0; i < branch.segments.length; i++) {
      await expect(page.getByTestId('dialogue-text')).toHaveText(branch.segments[i].text);
      await page.getByRole('button', { name: '推進對話', exact: true }).click();
    }
    const common = story.scenes[branch.next!],
      state = seed(story, common.id),
      image = currentCg(story, state)!;
    await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', common.id);
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      '/' + story.assets.find((a) => a.id === image)!.src
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  }
});
