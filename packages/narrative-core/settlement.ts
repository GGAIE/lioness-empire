import type { CampaignPlan, CampaignState } from './campaign-schema';
import { openingCost } from './campaign';

export interface SettlementNotice {
  phase: 'CHAPTER_END' | 'CHAPTER_START';
  title: string;
  severity: 'INFO' | 'WARNING' | 'UNRESOLVED';
  lines: string[];
}
export function chapterEndNotice(plan: CampaignPlan, state: CampaignState): SettlementNotice {
  const chapter = plan.chapters.find((c) => c.id === state.chapter);
  if (!chapter) throw Error('Cannot settle an unknown chapter');
  const next = chapter.next,
    points = state.politicalPoints,
    unrest = state.unrest;
  const lines = [
    `本章：${chapter.id} ${chapter.title}`,
    `章末政治點數：${points ?? '待設定'}；動盪值：${unrest ?? '待設定'}。`,
  ];
  if (chapter.id === 'PROLOGUE') lines.push('序幕不啟動計分；以下是下一章開局預告。');
  if (!next)
    return {
      phase: 'CHAPTER_END',
      title: '章末結算提醒',
      severity: 'INFO',
      lines: [...lines, '已到尾聲，沒有下一章扣點。'],
    };
  const cost = openingCost(plan, next, unrest);
  if (cost === null)
    return {
      phase: 'CHAPTER_END',
      title: '章末結算警告',
      severity: 'UNRESOLVED',
      lines: [
        ...lines,
        next === 'EP12'
          ? '下一章 EP12 的免扣點例外尚待確認；EP11 終局保持封存，不自動扣點。'
          : '下一章的扣點尚無法計算，需先設定劇情初始數值。',
      ],
    };
  lines.push(`下一章 ${next} 開局將依目前動盪扣除 ${cost} 點政治點數。`);
  if (points === null)
    return {
      phase: 'CHAPTER_END',
      title: '章末結算警告',
      severity: 'UNRESOLVED',
      lines: [...lines, '政治點數尚未設定，不能計算剩餘點數。'],
    };
  if (points < cost)
    return {
      phase: 'CHAPTER_END',
      title: '章末結算警告',
      severity: 'WARNING',
      lines: [
        ...lines,
        '警告：政治點數不足以支付下一章開局成本。點數不足規則未定，不會直接扣成負值或判定失敗。',
        '此處僅預告，尚未扣點。',
      ],
    };
  return {
    phase: 'CHAPTER_END',
    title: '章末結算提醒',
    severity: cost > 0 ? 'WARNING' : 'INFO',
    lines: [...lines, `預計剩餘 ${points - cost} 點。此處僅預告，實際在進入下一章時扣除一次。`],
  };
}
export function chapterStartNotice(
  before: CampaignState,
  after: CampaignState
): SettlementNotice | null {
  if (after.upkeep.length === before.upkeep.length) return null;
  const receipt = after.upkeep.at(-1)!;
  return {
    phase: 'CHAPTER_START',
    title: '章初結算通知',
    severity: receipt.cost > 0 ? 'WARNING' : 'INFO',
    lines: [
      `${receipt.chapter} 已按承接動盪 ${receipt.unrest} 完成結算。`,
      `政治點數：${before.politicalPoints} − ${receipt.cost} = ${after.politicalPoints}。`,
      '本章章初費已結清，不會因重新顯示通知或當章動盪改變而重複扣點。',
    ],
  };
}
