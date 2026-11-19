import { type Page } from '@playwright/test';
export async function openActFromDirectory(page: Page, act: 1 | 2) {
  await page.getByRole('button', { name: '章節目錄', exact: true }).click();
  const chapter = page
    .locator('.directory-chapter')
    .filter({ has: page.getByRole('heading', { name: 'The Call', exact: true }) });
  await chapter.locator(':scope > details > summary').click();
  const label = act === 1 ? '第一幕 · 凡事都有定期，天下萬務都有定時' : '第二幕 · 人心籌算自己的道路';
  const section = chapter
    .locator('.directory-act')
    .filter({ has: page.getByRole('heading', { name: label, exact: true }) });
  await section.locator(':scope > summary').click();
  await section.getByRole('button').first().click();
}
