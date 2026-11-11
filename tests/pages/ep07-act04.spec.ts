import { expect, test } from '@playwright/test';
import { loadReaderContent } from '../../scripts/load-content';
import { initialState, visibleSegments } from '../../packages/narrative-core/engine';
import { importPlayerState } from '../helpers/import-player-state';

test('shows the release log and continues both third-act saves into the matching fourth act', async ({
  page,
}) => {
  const story = await loadReaderContent();
  await page.goto('/');
  const release = page.getByRole('button', { name: /更新日誌 OLIVIA2026\.11\.11/ });
  await expect(release).toBeInViewport();
  await release.click();
  const log = page.getByRole('dialog', { name: '更新日誌' });
  await expect(log).toContainText('OLIVIA2026.11.11');
  await expect(log).toContainText('龍槍使聖戰');
  await expect(log).toContainText('死龍與聖戰');
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();

  for (const route of ['SACRED', 'WORLD'] as const) {
    const end = Object.values(story.scenes).find(
      (scene) =>
        scene.chapter === 'EP07' &&
        scene.act === 'ACT03' &&
        scene.completion &&
        scene.availableWhen &&
        'value' in scene.availableWhen &&
        scene.availableWhen.value === route
    )!;
    const state = initialState({ ...story, manifest: { ...story.manifest, start: end.id } });
    state.politicalRoute = route;
    state.campaign!.politicalRoute = route;
    state.contentVersion = '0.17.0-ep07-act03-worldlines.reader-v1';
    state.flags.EP07_W3_SETTLED = true;
    state.flags.EP07_SACRED_NEGOTIATION_RESULT = 'FULL';
    state.currentSegmentIndex = visibleSegments(story, state).length - 1;
    await importPlayerState(page, state);
    await page.getByRole('button', { name: '進入第四幕 →', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-scene-id',
      `EP07_ACT04_SC01_${route[0]}`
    );
    await expect(page.getByTestId('scene-cg')).toHaveAttribute(
      'src',
      new RegExp(`/act04/${route.toLowerCase()}/CG01\\.webp`)
    );
  }
  await release.click();
  await expect(log).toBeVisible();
});
