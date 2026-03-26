import { NextRequest, NextResponse } from 'next/server';
import { getSession, getProgress } from '@/lib/store';

// C3: 安全获取 session
function getAuthSession(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    return getSession(token);
  } catch (err) {
    console.error('[Auth] Session check failed:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    // C3: 使用 session 中的 studentId，不取 body 中的
    const { studentId, student } = session;

    const body = await request.json();
    const { scores } = body;

    const progress = getProgress(studentId);
    const evals = progress
      .filter(p => p.score !== null)
      .map((p, i) => ({
        id: i + 1,
        course_id: p.courseId,
        total_score: p.score,
        evaluated_at: new Date().toISOString(),
      }));

    return NextResponse.json({
      evals,
      current: {
        total_score: scores?.total || student.score,
        grade: student.grade,
      },
    });
  } catch {
    return NextResponse.json({ error: '评测失败' }, { status: 500 });
  }
}
