import { type Page } from '@playwright/test';
export async function openActFromDirectory(page: Page, act: 1 | 2) {
  await page.getByRole('button', { name: '章節目錄', exact: true }).click();
  const chapter = page
    .locator('.directory-chapter')
    .filter({ has: page.getByRole('heading', { name: '王冠之前', exact: true }) });
  await chapter.locator(':scope > details > summary').click();
  const label = act === 1 ? '第一幕 · 平靜被打破' : '第二幕 · 離開學院';
  const section = chapter
    .locator('.directory-act')
    .filter({ has: page.getByRole('heading', { name: label, exact: true }) });
  await section.locator(':scope > summary').click();
  await section.getByRole('button').first().click();
}
