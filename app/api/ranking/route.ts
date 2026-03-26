import { NextResponse } from 'next/server';
import { getStudents } from '@/lib/store';

export async function GET() {
  try {
    const allStudents = getStudents();
    const ranking = allStudents
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((s, i) => ({
        name: s.agentName,
        college: s.college || '未分院',
        score: s.score,
        grade: s.grade,
        badge: i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '',
      }));

    return NextResponse.json({ ranking });
  } catch {
    return NextResponse.json({ error: '获取排行榜失败' }, { status: 500 });
  }
}
