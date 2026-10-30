import { test, expect } from '@playwright/test';
import { loadContent } from '../../scripts/load-content';
import { openActFromDirectory } from '../helpers/directory';

test('chapter and act summaries collapse, pending acts are readable as placeholders, and sections retain the CG reader', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: '章節目錄', exact: true }).click();
  await expect(page.locator('.directory-chapter')).toHaveCount(13);
  await expect(page.locator('.directory-chapter > details[open]')).toHaveCount(0);
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  await expect(page.locator('.directory-chapter > details[open]')).toHaveCount(13);
  await expect(page.locator('.directory-act[open]')).toHaveCount(61);
  await expect(page.locator('.directory-sections li')).toHaveCount(23);
  const chapter = page
    .locator('.directory-chapter')
    .filter({ has: page.getByRole('heading', { name: '王冠之前', exact: true }) });
  await expect(chapter).toContainText('已提供 3 / 5 幕');
  const act = chapter
    .locator('.directory-act')
    .filter({ has: page.getByRole('heading', { name: '第二幕 · 離開學院', exact: true }) });
  await expect(act.getByRole('button')).toHaveCount(5);
  await expect(act.getByRole('button', { name: /學院與王室/ })).toBeDisabled();
  await expect(act.getByRole('button', { name: /同行者/ })).toBeDisabled();
  await page.getByRole('button', { name: '收合全部', exact: true }).click();
  await expect(page.locator('.chapter-directory details[open]')).toHaveCount(0);
  await chapter.locator(':scope > details > summary').click();
  await act.locator(':scope > summary').click();
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-chapter-directory.png`,
    fullPage: true,
  });
  await act.getByRole('button', { name: /不能帶走的研究室/ }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT02_SC02');
  await expect(page.getByTestId('scene-cg')).toHaveAttribute('src', /ACT02_SC02_01_v0.2.png$/);
  await page.getByRole('button', { name: '章節', exact: true }).click();
  const current = page.locator('.directory-sections button.is-current');
  await expect(current).toContainText('不能帶走的研究室');
  await expect(current).toContainText('繼續本節');
  await current.click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT02_SC02');
});

test('navigation saves the old position, restores its backup and keeps committed choices on the same route', async ({
  page,
}) => {
  test.setTimeout(90000);
  const story = await loadContent();
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('slider', { name: '逐字間隔（0 為立即顯示）' }).fill('0');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  await openActFromDirectory(page, 2);
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: /王都的研究工作/ }).click();
  for (let i = 0; i < story.scenes.EP01_ACT02_SC03.segments.length - 1; i++)
    await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await page.getByRole('button', { name: /先確認父王病況與王室正式授權/ }).click();
  await page.getByRole('button', { name: '推進對話', exact: true }).click();
  const savedText = await page.getByTestId('dialogue-text').textContent();
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: /不能帶走的研究室/ }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT02_SC02');
  await page.getByRole('button', { name: '存讀檔', exact: true }).click();
  const backup = page.locator('.backup-list p').filter({ hasText: '章節切換前 · 王都的研究工作' });
  await backup.getByRole('button', { name: '讀取', exact: true }).click();
  await expect(page.getByTestId('dialogue-text')).toHaveText(savedText!);
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT02_SC03_A');
  // Continue the chosen response to the common passage, then reopen its source section.
  for (let i = 1; i < story.scenes.EP01_ACT02_SC03_A.segments.length; i++)
    await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-scene-id',
    'EP01_ACT02_SC03_COMMON'
  );
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: /不能帶走的研究室/ }).click();
  await page.getByRole('button', { name: '章節', exact: true }).click();
  await page.getByRole('button', { name: /王都的研究工作/ }).click();
  for (let i = 0; i < story.scenes.EP01_ACT02_SC03.segments.length - 1; i++)
    await page.getByRole('button', { name: '推進對話', exact: true }).click();
  await expect(page.locator('.committed-choice')).toContainText('先確認父王病況與王室正式授權');
  await expect(page.getByLabel('劇情選項').getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: '繼續已選擇的路線' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-scene-id', 'EP01_ACT02_SC03_A');
  await expect(page.locator('.shell>.resource-hud').getByTestId('political-points')).toHaveText(
    '50'
  );
  await expect(page.locator('.shell>.resource-hud').getByTestId('unrest-value')).toHaveText(
    '30 / 100'
  );
});
