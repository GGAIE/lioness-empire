import { test, expect, type Page } from '@playwright/test';
import { musicTracks, musicGain } from '../../apps/web-vn/src/engine/music';
async function menu(page: Page) {
  await page.getByRole('button', { name: '背景音樂', exact: true }).click();
}
async function playing(page: Page, id: string) {
  const media = page.getByTestId('background-music');
  await expect(media).toHaveAttribute('src', '/' + musicTracks.find((t) => t.id === id)!.src);
  await expect
    .poll(() => media.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0.02))
    .toBe(true);
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
    '播放中'
  );
}
test('Motif loops across its actual MP3 end without a pause or track change', async ({ page }) => {
  await page.goto('/');
  await menu(page);
  await page.getByLabel('選擇背景音樂').selectOption('BGM_MOTIF');
  await playing(page, 'BGM_MOTIF');
  const media = page.getByTestId('background-music');
  await expect.poll(() => media.evaluate((a: HTMLAudioElement) => a.duration)).toBeGreaterThan(200);
  await media.evaluate((a: HTMLAudioElement) => {
    a.currentTime = a.duration - 0.5;
  });
  await expect
    .poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime), { timeout: 10000 })
    .toBeLessThan(3);
  await expect(media).toHaveJSProperty('paused', false);
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
    '播放中'
  );
});

test('Sigil loops across its natural MP3 boundary and still honors a native pause', async ({
  page,
}) => {
  await page.goto('/');
  await menu(page);
  await page.getByLabel('選擇背景音樂').selectOption('BGM_SIGIL');
  await playing(page, 'BGM_SIGIL');
  const media = page.getByTestId('background-music');
  await expect.poll(() => media.evaluate((a: HTMLAudioElement) => a.duration)).toBeGreaterThan(100);
  await media.evaluate((a: HTMLAudioElement) => {
    a.currentTime = a.duration - 0.5;
  });
  await expect
    .poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime), { timeout: 10000 })
    .toBeLessThan(2);
  await expect(media).toHaveJSProperty('paused', false);
  await expect
    .poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(0.2);
  await media.evaluate((a: HTMLAudioElement) => a.pause());
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
    '已暫停'
  );
});
test('six original tracks really decode, balance volume, pause/resume, stop and loop', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await menu(page);
  const select = page.getByLabel('選擇背景音樂'),
    media = page.getByTestId('background-music');
  await expect(select.locator('option')).toHaveCount(7);
  for (const t of musicTracks) {
    await select.selectOption(t.id);
    await playing(page, t.id);
    await expect(media).toHaveJSProperty('volume', 0.3 * musicGain(t.id));
    await expect(media).toHaveJSProperty('loop', true);
    await expect
      .poll(() => media.evaluate((a: HTMLAudioElement) => a.duration))
      .toBeGreaterThan(100);
  }
  await page.getByRole('button', { name: '暫停背景音樂', exact: true }).click();
  await expect(media).toHaveJSProperty('paused', true);
  const position = await media.evaluate((a: HTMLAudioElement) => a.currentTime);
  await page.getByRole('button', { name: '播放背景音樂', exact: true }).click();
  await expect
    .poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(position);
  await media.evaluate((a: HTMLAudioElement) => {
    a.currentTime = a.duration - 0.2;
  });
  await expect
    .poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime), { timeout: 10000 })
    .toBeLessThan(2);
  await media.evaluate((a: HTMLAudioElement) => a.pause());
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
    '已暫停'
  );
  await page.getByRole('button', { name: '播放背景音樂', exact: true }).click();
  await playing(page, 'BGM_REPORT');
  await page.locator('.modal-body').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'docs/screenshots/' + info.project.name + '-music-menu.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '停止背景音樂', exact: true }).click();
  await expect(media).toHaveJSProperty('paused', true);
  await expect(media).toHaveJSProperty('currentTime', 0);
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toHaveText(
    '已停止'
  );
  expect(errors).toEqual([]);
});
test('remembers song/volume without autoplay and keeps manual music across dialogue, modal and global sound controls', async ({
  page,
}) => {
  await page.goto('/');
  await menu(page);
  await page.getByLabel('選擇背景音樂').selectOption('BGM_MOTIF');
  await playing(page, 'BGM_MOTIF');
  await page.getByRole('slider', { name: /背景音樂音量/ }).fill('0.65');
  await expect(page.getByTestId('background-music')).toHaveJSProperty(
    'volume',
    0.65 * musicGain('BGM_MOTIF')
  );
  // Wait for the actual IndexedDB write before simulating a new visit.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open('lioness-empire-html5-v1');
            request.onsuccess = () => {
              const db = request.result,
                read = db.transaction('preferences').objectStore('preferences').get('settings');
              read.onsuccess = () => {
                resolve(read.result?.bgm ?? -1);
                db.close();
              };
              read.onerror = () => reject(read.error);
            };
            request.onerror = () => reject(request.error);
          })
      )
    )
    .toBe(0.65);
  await page.reload();
  await menu(page);
  await expect(page.getByLabel('選擇背景音樂')).toHaveValue('BGM_MOTIF');
  await expect(page.getByTestId('background-music')).toHaveJSProperty('paused', true);
  await expect(page.getByTestId('background-music')).not.toHaveAttribute('src', /mp3/);
  await page.getByRole('button', { name: '播放背景音樂', exact: true }).click();
  await playing(page, 'BGM_MOTIF');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: /^開始遊戲/ }).click();
  const media = page.getByTestId('background-music'),
    time = await media.evaluate((a: HTMLAudioElement) => a.currentTime);
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await expect
    .poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(time);
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  await page.getByRole('button', { name: /不能帶走的研究室/ }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT02_SC02');
  await expect(media).toHaveAttribute('src', /the-lioness-motif.mp3$/);
  await expect(media).toHaveJSProperty('paused', false);
  await expect
    .poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(time);
  await page.getByRole('button', { name: '關閉聲音', exact: true }).click();
  await expect(media).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: '開啟聲音', exact: true }).click();
  await expect(media).toHaveJSProperty('paused', false);
  await menu(page);
  await page.getByRole('button', { name: '停止背景音樂', exact: true }).click();
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await expect(media).toHaveJSProperty('paused', true);
});
test('a failed file and an obsolete request cannot silence a new selection; automatic mode stops when no scene track exists', async ({
  page,
}) => {
  await page.route('**/content/manifests/assets.json', async (route) => {
    const response = await route.fetch();
    const assets = (await response.json()) as { id: string; src: string }[];
    assets.find((a) => a.id === 'BGM_LEDGER')!.src = 'assets/audio/bgm/absent-for-audio-test.mp3';
    await route.fulfill({ response, json: assets });
  });
  await page.goto('/');
  await menu(page);
  await page.getByLabel('選擇背景音樂').selectOption('BGM_LEDGER');
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toContainText(
    '背景音樂'
  );
  await page.getByLabel('選擇背景音樂').selectOption('BGM_SIGIL');
  await playing(page, 'BGM_SIGIL');
  await page.getByLabel('選擇背景音樂').selectOption('BGM_LEDGER');
  await page.getByLabel('選擇背景音樂').selectOption('BGM_DANCE');
  await playing(page, 'BGM_DANCE');
  await page.getByLabel('選擇背景音樂').selectOption('story');
  await expect(page.getByTestId('background-music')).toHaveJSProperty('paused', true);
  await expect(
    page.getByRole('heading', { name: '此場景尚無指定配樂', exact: true })
  ).toBeVisible();
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      HTMLMediaElement.prototype.play = original;
      return Promise.reject(new DOMException('test playback permission', 'NotAllowedError'));
    };
  });
  await page.getByLabel('選擇背景音樂').selectOption('BGM_SIGIL');
  await expect(page.getByRole('status', { name: '背景音樂播放狀態', exact: true })).toContainText(
    '瀏覽器尚未允許播放'
  );
  await page.getByRole('button', { name: '播放背景音樂', exact: true }).click();
  await playing(page, 'BGM_SIGIL');
});
