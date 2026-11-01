import library from '../../../../content/music/library.json' with { type: 'json' };
export const musicTracks = library;
export const musicDuration = (seconds: number) =>
  Math.floor(Math.round(seconds) / 60) + ':' + String(Math.round(seconds) % 60).padStart(2, '0');
export function musicGain(id: string | undefined) {
  return musicTracks.find((t) => t.id === id)?.playbackGain ?? 1;
}
