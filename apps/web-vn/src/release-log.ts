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
    date: '2026-11-14',
    title: '第八章第二幕',
    changes: [
      '神聖線〈五十張椅子〉與世界線〈懸空的席位〉各新增五場劇情，共收錄 42 張 CG。',
      '神聖線決定議會舉薦與過渡議事方式；世界線迎接赫碧就任，選擇聯合議程的推進方式。',
      '新增三組劇情決策與九組對話回應，承接原有路線與存檔，並清理製作備註及轉場文字。',
    ],
  },
  {
    date: '2026-11-12',
    title: '第八章第一幕',
    changes: [
      '神聖線〈歷史從不騙人〉與世界線〈不變的事情〉各新增五場劇情，共收錄 43 張 CG。',
      '新增九組對話選項，僅改變當下回話，不增減政治點數、動盪或角色進度。',
      '第七章結尾可接續原有世界線，進入第八章時依既有規則扣除一次章節維持費。',
      '補齊各幕正式標題，章節目錄不再使用通用規劃名稱，兩條世界線保留各自的幕名。',
    ],
  },
  {
    date: '2026-11-11',
    title: '第七章第五幕',
    changes: [
      '神聖線與世界線〈留下來的帳〉各新增五場劇情，共收錄 60 張 CG。',
      '神聖線依結晶處置判定塔馬拉與芬利的支線，世界線依拜訪決定艾琳達的支線，並收束倉庫調查。',
      '新增第七章章末結算提醒，承接各路線第四幕的進度。',
    ],
  },
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
