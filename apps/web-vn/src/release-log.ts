const weeklyCharacters = ['OLIVIA', 'FINLEY', 'ELLA', 'ALINDA', 'MIEL', 'ALYSSIA', 'KALLIS'];
const firstWeek = Date.UTC(2026, 10, 9);
const weekMs = 7 * 24 * 60 * 60 * 1000;

// Release dates are Taipei calendar dates. UTC arithmetic keeps the rotation
// identical for all players, and a published release retains its version.
export function releaseVersion(date: string): string {
  const week = Math.floor((Date.parse(date + 'T00:00:00Z') - firstWeek) / weekMs);
  const index =
    ((week % weeklyCharacters.length) + weeklyCharacters.length) % weeklyCharacters.length;
  return weeklyCharacters[index] + date.replaceAll('-', '.');
}

export const releaseLog = [
  {
    date: '2026-11-10',
    title: '第七章第四幕',
    changes: [
      '神聖線〈龍槍使聖戰〉與世界線〈死龍與聖戰〉各新增九場劇情及 40 張 CG。',
      '第三幕存檔可接入原有世界線。神聖線承接教會談判及秘書印，世界線記錄求援、協作與善後決策。',
      '新增遊戲內更新日誌。',
    ],
  },
] as const;
