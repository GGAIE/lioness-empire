import { expect, type Page } from '@playwright/test';
import { defaults, emptyMeta } from '../../apps/web-vn/src/storage/saves';
import type { CoverRoute } from '../../apps/web-vn/src/engine/covers';
export async function coverPreferences(
  page: Page,
  routes: CoverRoute[],
  selected = 'palace',
  freeReading = false
) {
  await page.getByTestId('title-cover').waitFor();
  // Wait for initial React preference writes before installing the earned-record fixture.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve, reject) => {
            const r = indexedDB.open('lioness-empire-html5-v1');
            r.onerror = () => reject(r.error);
            r.onsuccess = () => {
              const db = r.result;
              const tx = db.transaction('preferences');
              const q = tx.objectStore('preferences').get('meta');
              q.onsuccess = () => resolve(!!q.result);
              tx.oncomplete = () => db.close();
            };
          })
      )
    )
    .toBe(true);
  await page.evaluate(
    async ({ settings, meta }) => {
      await new Promise<void>((resolve, reject) => {
        const r = indexedDB.open('lioness-empire-html5-v1');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('preferences', 'readwrite');
          tx.objectStore('preferences').put(settings, 'settings');
          tx.objectStore('preferences').put(meta, 'meta');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    {
      settings: { ...defaults, speed: 0, cover: selected, storyUnlocked: freeReading },
      meta: { ...emptyMeta, completedRoutes: routes },
    }
  );
  await page.reload();
}
