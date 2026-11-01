import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { musicTracks, musicDuration, musicGain } from '../../apps/web-vn/src/engine/music';
import { SettingsSchema, defaults } from '../../apps/web-vn/src/storage/saves';
import { loadContent, root } from '../../scripts/load-content';
it('migrates existing preferences to story music without changing saved volumes or requiring new game saves', () => {
  const { musicTrack: _track, ...old } = defaults;
  expect(SettingsSchema.parse({ ...old, bgm: 0.6 })).toEqual({ ...defaults, bgm: 0.6 });
  expect(SettingsSchema.parse({ ...defaults, musicTrack: 'BGM_LEDGER' }).musicTrack).toBe(
    'BGM_LEDGER'
  );
});
it('keeps all six supplied MP3s unchanged, registered and portable with bounded playback gain', async () => {
  const story = await loadContent();
  expect(musicTracks).toHaveLength(6);
  expect(new Set(musicTracks.map((t) => t.id)).size).toBe(6);
  for (const t of musicTracks) {
    expect(story.assets.find((a) => a.id === t.id)).toMatchObject({
      type: 'bgm',
      src: t.src,
      label: t.title,
    });
    const bytes = await readFile(root + '/' + t.src);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(t.sha256);
    expect(bytes.length).toBe(t.bytes);
    expect(t.durationSeconds).toBeGreaterThan(100);
    expect(t.sampleRate).toBeGreaterThanOrEqual(44100);
    expect(musicGain(t.id)).toBeGreaterThan(0);
    expect(musicGain(t.id)).toBeLessThanOrEqual(1);
    expect(t.integratedLufs + 20 * Math.log10(t.playbackGain)).toBeCloseTo(-18, 1);
  }
});
it('formats rounded durations correctly at minute boundaries and leaves story tracks at their original gain', () => {
  expect(musicDuration(59.6)).toBe('1:00');
  expect(musicDuration(103.6)).toBe('1:44');
  expect(musicDuration(207.1)).toBe('3:27');
  expect(musicGain('UNKNOWN_STORY_TRACK')).toBe(1);
});
