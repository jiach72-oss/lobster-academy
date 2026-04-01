import type { Grade } from './types';

/**
 * 统一评分函数：基于百分比将分数转换为等级。
 * @param score 实际得分
 * @param maxScore 满分
 * @returns 等级 (S/A/B/C/D)
 */
export function scoreToGrade(score: number, maxScore: number): Grade {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return 'S';
  if (pct >= 75) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 40) return 'C';
  return 'D';
}
