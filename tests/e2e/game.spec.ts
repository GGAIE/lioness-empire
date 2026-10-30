import { test, expect, type Page } from '@playwright/test';
async function fastText(page: Page) {
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗' }).click();
}
const next = async (page: Page) => {
  await page.getByRole('button', { name: '推進對話', exact: true }).click();
};
test('full playable branch, result, gallery, manual save and reload', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '引擎試演' })).toBeVisible();
  await fastText(page);
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-title.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '引擎試演' }).click();
  await expect(page.getByTestId('scene-cg')).toBeVisible();
  await expect(page.getByTestId('dialogue-text')).toContainText('DEMO_ONLY');
  await next(page);
  await next(page);
  await next(page);
  await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
  await expect
    .poll(async () => {
      const options = await page.getByLabel('劇情選項').boundingBox(),
        dialogue = await page.locator('.dialogue-wrap').boundingBox();
      return !!options && !!dialogue && options.y + options.height <= dialogue.y;
    })
    .toBe(true);
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-choices.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '查閱測試檔案' }).click();
  await expect(page.getByTestId('dialogue-text')).toContainText('隱藏旗標');
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '存檔 01' }) })
    .getByRole('button', { name: '儲存', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('進度已儲存');
  await page.getByRole('button', { name: '關閉視窗' }).click();
  await next(page);
  await expect(page.getByTestId('dialogue-text')).toContainText('Result Scene');
  await expect(page.getByLabel('劇情選項')).toHaveCount(0);
  await next(page);
  await next(page);
  await expect(page.getByRole('button', { name: '確認檔案記錄並完成測試' })).toBeVisible();
  await page.getByRole('button', { name: '確認檔案記錄並完成測試' }).click();
  await next(page);
  await expect(page.getByTestId('dialogue-text')).toContainText('重新開始');
  await page.getByRole('button', { name: '結局', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: '測試的終點', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '關閉視窗' }).click();
  await page.getByRole('button', { name: '鑑賞', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(3);
  await page.getByRole('button', { name: '關閉視窗' }).click();
  await page.reload();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '存檔 01' }) })
    .getByRole('button', { name: '讀取', exact: true })
    .click();
  await expect(page.getByTestId('dialogue-text')).toContainText('隱藏旗標');
  await page.getByRole('button', { name: '開發', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('"finley": 2');
  await expect(page.getByRole('dialog')).toContainText('DEMO_ACT01_SC02:inspect');
  await page.getByRole('button', { name: '關閉視窗' }).click();
  await page.getByRole('button', { name: '回顧', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('DEMO_ONLY');
  await page.getByRole('button', { name: '關閉視窗' }).click();
  const size = await page.evaluate(() => ({
    w: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.w);
  expect(errors).toEqual([]);
});
test('typewriter reveal, unread skip stop, developer jump and conditional choice absence', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '引擎試演' }).click();
  await next(page);
  await expect(page.getByTestId('dialogue-text')).toContainText('不是正式 Canon');
  await page.getByRole('button', { name: '已讀跳過', exact: true }).click();
  await expect(page.getByRole('button', { name: '已讀跳過', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await fastText(page);
  await page.getByRole('button', { name: '開發', exact: true }).click();
  await page.getByLabel('開發場景跳轉').selectOption('DEMO_FINAL_CHOICE');
  await expect(page.getByRole('button', { name: '完成本次引擎測試', exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '確認檔案記錄並完成測試' })).toHaveCount(0);
});
test('missing CG displays placeholder and still advances', async ({ page }) => {
  await page.route('**/assets/cg/hall.svg', (r) => r.abort());
  await page.goto('/');

  await fastText(page);
  await page.getByRole('button', { name: '引擎試演' }).click();
  await expect(page.getByText('素材尚未就緒', { exact: false })).toBeVisible();
  await next(page);
  await expect(page.getByTestId('dialogue-text')).toContainText('先讓一段文字');
});
test('versioned import requires confirmation before replacing progress', async ({ page }) => {
  await page.goto('/');
  await fastText(page);
  await page.getByRole('button', { name: '引擎試演' }).click();
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const { loadContent } = await import('../../scripts/load-content');
  const { initialState } = await import('../../packages/narrative-core/engine');
  const state = initialState(await loadContent());
  state.contentVersion = '0.0.1';
  state.currentSceneId = 'DEMO_OLD_START';
  await page.locator('input[type=file]').setInputFiles({
    name: 'old.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'lioness-empire-save',
        exportVersion: 1,
        record: { slot: '1', title: 'old', savedAt: 'old', thumbnail: null, state },
      })
    ),
  });
  await expect(page.getByRole('alertdialog')).toContainText('劇情版本不同');
  await expect(page.getByRole('alertdialog')).toContainText('場景已遷移');
  await page.getByRole('button', { name: '確認並載入' }).click();
  await expect(page.getByTestId('dialogue-text')).toContainText('DEMO_ONLY');
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  await expect(page.getByRole('heading', { name: '切換與遷移前的備份' })).toBeVisible();
});
test('auto reaches choices and pauses; font setting persists after refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('slider', { name: '自動閱讀等待' }).fill('500');
  await page.getByRole('slider', { name: '字型大小' }).fill('28');
  await page.getByRole('button', { name: '關閉視窗' }).click();
  await page.getByRole('button', { name: '引擎試演' }).click();
  await expect(page.getByRole('button', { name: '推進對話' })).toHaveCSS('font-size', '28px');
  await page.getByRole('button', { name: 'AUTO', exact: true }).click();
  await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '三份記錄' })).toBeVisible();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByRole('slider', { name: '字型大小' })).toHaveValue('28');
  await page.getByRole('button', { name: '關閉視窗' }).click();
  await page.reload();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByRole('slider', { name: '字型大小' })).toHaveValue('28');
});
test('read-only skip advances read text and stops at first unread segment', async ({ page }) => {
  await page.goto('/');
  await fastText(page);
  await page.getByRole('button', { name: '引擎試演' }).click();
  await next(page);
  await expect(page.getByTestId('dialogue-text')).toContainText('先讓一段文字');
  await page.getByRole('button', { name: '開發', exact: true }).click();
  await page.getByLabel('開發場景跳轉').selectOption('DEMO_ACT01_SC01');
  await page.getByRole('button', { name: '已讀跳過', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toContainText('桌上放著三份');
  await expect(page.getByRole('button', { name: '已讀跳過', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

test('user gesture plays decodable BGM and result-scene SFX', async ({ page }) => {
  await page.addInitScript(() => {
    const log: { src: string; volume: number }[] = [];
    Object.assign(window, { __mediaTest: log });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const result = play.call(this);
      void result.then(
        () => log.push({ src: this.src, volume: this.volume }),
        () => {}
      );
      return result;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '引擎試演' }).click();
  await page.getByRole('button', { name: '開啟聲音', exact: true }).click();
  const played = () =>
    page.evaluate(
      () => (window as unknown as { __mediaTest: { src: string; volume: number }[] }).__mediaTest
    );
  await expect.poll(played).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: expect.stringContaining('/assets/bgm/calm.wav'),
        volume: 0.3,
      }),
    ])
  );
  await page.getByRole('button', { name: '開發', exact: true }).click();
  await page.getByLabel('開發場景跳轉').selectOption('DEMO_RESULT');
  await expect.poll(played).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: expect.stringContaining('/assets/sfx/resolve.wav'),
        volume: 0.4,
      }),
    ])
  );
  await page.getByRole('button', { name: '關閉聲音', exact: true }).click();
  await expect(page.getByRole('button', { name: '開啟聲音', exact: true })).toBeVisible();
});
