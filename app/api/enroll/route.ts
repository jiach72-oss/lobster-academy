import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCourses, getProgress } from '@/lib/store';

// C3: 辅助函数 — 安全获取 session
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

export async function GET(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const { studentId, student } = session;

    const courses = getCourses();
    const progress = getProgress(studentId);
    const completedCount = progress.filter(p => p.status === 'passed').length;

    return NextResponse.json({
      user: { 
        id: studentId, 
        name: student.agentName, 
        email: `${student.studentId}@lobster.academy` 
      },
      enrollment: {
        student_id: studentId,
        agent_name: student.agentName,
        college: student.college,
        grade: student.grade,
        score: student.score,
        enrolled_at: student.enrolledAt,
        graduated: student.graduated,
        total_courses: courses.length,
        completed_courses: completedCount,
      },
    });
  } catch {
    return NextResponse.json({ error: '获取入学信息失败' }, { status: 500 });
  }
}
