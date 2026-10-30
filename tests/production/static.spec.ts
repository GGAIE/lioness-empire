import { test, expect } from '@playwright/test';
import { openActFromDirectory } from '../helpers/directory';
import { readdir, readFile } from 'node:fs/promises';
import { loadContent } from '../../scripts/load-content';
import { initialState } from '../../packages/narrative-core/engine';
test('static build runs independently, has no developer UI or external service requests', async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4181/') && !r.url().startsWith('data:'))
      external.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '開始序幕' })).toBeVisible();
  await expect(page.getByTestId('political-points')).toHaveText('50');
  await expect(page.getByTestId('unrest-value')).toHaveText('30 / 100');
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '瀏覽劇情架構' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '劇情架構', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '開始序幕' }).click();
  await page.getByRole('button', { name: '推進對話' }).click();
  await expect(page.getByTestId('dialogue-text')).toContainText('安度因的鐘聲');
  await expect(page.getByTestId('scene-cg')).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  const jsFiles = (await readdir('dist/assets')).filter((x) => x.endsWith('.js'));
  for (const file of jsFiles) {
    const body = await readFile('dist/assets/' + file, 'utf8');
    expect(body).not.toContain('開發場景跳轉');
    expect(body).not.toContain('結局測試狀態');
    expect(body).not.toContain('走訪政治點數');
  }
});

test('static build includes EP01 ACT I and its original CG without developer tools', async ({
  page,
}) => {
  await page.goto('/');
  await openActFromDirectory(page, 1);
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT01_SC01');
  await page.getByRole('button', { name: '推進對話' }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(
    '晨鐘響過第三聲，皇家魔法學院的庭院便漸漸熱鬧起來。'
  );
  await expect(page.getByTestId('scene-cg')).toHaveAttribute(
    'src',
    /LE_CG_EP01_ACT01_SC01_IMG01_v0.3.png$/
  );
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});

test('static build opens ACT II with the original CG and the second-act heading', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '章節目錄', exact: true })).toBeVisible();
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await page.screenshot({ path: 'docs/screenshots/production-title-act02.png', fullPage: true });
  await openActFromDirectory(page, 2);
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT02_SC01');
  await expect(page.locator('.scene-heading')).toContainText('EP01 · 第二幕');
  await expect(page.getByTestId('scene-cg')).toHaveAttribute(
    'src',
    /LE_CG_EP01_ACT02_SC01_01_v0.2.png$/
  );
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});

test('production continues an ACT II ending save into ACT III with its prior priority intact', async ({
  page,
}) => {
  const story = await loadContent();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT02_SC01' },
  });
  state.currentSceneId = 'EP01_ACT02_SC05';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.flags.EP01_ACT02_PRIORITY = 'TECHNICAL_INTERFACE';
  state.decisionLog = ['EP01_ACT02_SC03:C'];
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'act02-end.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'test-entry',
          title: 'ACT II end',
          savedAt: '2026-10-30',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP01 第三幕' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT03_SC01');
  await expect(page.locator('.scene-heading')).toContainText('第三幕');
  await expect(page.getByTestId('dialogue-text')).toContainText('王都的城牆在午後陽光下逐漸清晰');
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /ACT03_SC01_CG01_v0.3.png$/);
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});

test('production continues ACT III into the ACT IV black opening and corrected first-person CG', async ({
  page,
}) => {
  const story = await loadContent();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT03_SC01' },
  });
  state.currentSceneId = 'EP01_ACT03_SC05';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.flags.EP01_ACT02_PRIORITY = 'EASTERN_FRONT';
  state.decisionLog = [
    'EP01_ACT02_SC03:B',
    'EP01_ACT03_SC02:A',
    'EP01_ACT03_SC03:B',
    'EP01_ACT03_SC04:C',
  ];
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'act03-end.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'ACT III end',
          savedAt: '2026-10-30',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP01 第四幕' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT04_SC01');
  await expect(page.locator('.scene-heading')).toContainText('第四幕');
  await expect(page.locator('.stage')).toHaveClass(/stage-black/);
  await expect(page.getByTestId('scene-cg')).toHaveCount(0);
  await expect(page.getByTestId('dialogue-text')).toHaveText('「……大公主。」');
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText('奧莉維亞睜開眼。');
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /ACT04_SC01_IMG01_v0.1.png$/);
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});

test('production continues ACT IV into ACT V and shows a non-charging first-chapter settlement', async ({
  page,
}) => {
  const story = await loadContent();
  const state = initialState({
    ...story,
    manifest: { ...story.manifest, start: 'EP01_ACT04_SC01' },
  });
  state.currentSceneId = 'EP01_ACT04_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.decisionLog = [
    'EP01_ACT02_SC03:B',
    ...['02', '03', '04'].map((n) => `EP01_ACT03_SC${n}:A`),
    ...['01', '02', '03', '04', '05'].map((n) => `EP01_ACT04_SC${n}:A`),
  ];
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  async function importState() {
    await page.getByRole('button', { name: '存讀檔', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'ep01-entry.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'lioness-empire-save',
          exportVersion: 1,
          record: {
            slot: 'entry',
            title: 'EP01 entry',
            savedAt: '2026-10-30',
            thumbnail: null,
            state,
          },
        })
      ),
    });
    await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  }
  await importState();
  await page.getByRole('button', { name: '進入 EP01 第五幕' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT05_SC01');
  await expect(page.getByTestId('dialogue-text')).toHaveText('宮廷的早晨比學院安靜得多。');
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /ACT05_SC01_CG01_v0.4.png$/);
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  state.currentSceneId = 'EP01_ACT05_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.campaign!.act = 5;
  await importState();
  await expect(page.getByRole('alertdialog')).toContainText('章末結算提醒');
  await expect(page.getByRole('alertdialog')).toContainText('下一章 EP02 開局');
  await expect(page.getByRole('alertdialog')).toContainText('此處僅預告');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.getByRole('region', { name: '章節完成' })).toContainText('第一章完 · 王冠之前');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});

test('production enters EP02 with one upkeep charge and preserves the EP01 ending', async ({
  page,
}) => {
  const story = await loadContent(),
    state = initialState({ ...story, manifest: { ...story.manifest, start: 'EP01_ACT05_SC01' } });
  state.currentSceneId = 'EP01_ACT05_SC05_COMMON';
  state.currentSegmentIndex = story.scenes[state.currentSceneId].segments.length - 1;
  state.campaign!.politicalPoints = 100;
  state.campaign!.unrest = 80;
  state.contentVersion = '0.7.1-ep01-act05-v0.4-speakers';
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ep01-old-end.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: {
          slot: 'entry',
          title: 'Old EP01 ending',
          savedAt: '2026-10-31',
          thumbnail: null,
          state,
        },
      })
    ),
  });
  await page.getByRole('button', { name: '確認並載入', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('章末結算提醒');
  await expect(page.getByRole('alertdialog').getByTestId('political-points')).toHaveText('100');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await page.getByRole('button', { name: '進入 EP02 第一幕' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('100 − 40 = 60');
  await page.getByRole('button', { name: '確認結算資訊', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP02_ACT01_SC01');
  await expect(page.getByTestId('dialogue-text')).toHaveText('王宮的晨鐘響過第一遍。');
  await expect(page.getByTestId('scene-cg')).toHaveAttribute(
    'src',
    /LE_EP02_ACT01_SC01_CG01_v0.9.png$/
  );
  await expect(page.getByTestId('scene-cg')).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.getByRole('button', { name: '開發', exact: true })).toHaveCount(0);
});
