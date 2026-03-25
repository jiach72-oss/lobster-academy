import { NextRequest, NextResponse } from 'next/server';
import { getSession, getStudents, getCourses, getProgress } from '@/lib/store';

// 安全获取 session
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
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { studentId, student } = session;

    const courses = getCourses();
    const progress = getProgress(studentId);

    // 组装课程进度
    const coursesWithProgress = courses.map(c => {
      const p = progress.find(pr => pr.courseId === c.id);
      return {
        id: c.id,
        name: c.name_en,
        name_zh: c.name_zh,
        college: c.college_zh,
        status: p?.status || 'locked',
        score: p?.score,
        attempts: p?.attempts || 0,
      };
    });

    // 排行榜（所有学生）
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
        isMe: s.studentId === studentId,
      }));

    return NextResponse.json({
      student: {
        studentId: student.studentId,
        agentName: student.agentName,
        college: student.college,
        grade: student.grade,
        score: student.score,
        graduated: student.graduated,
        graduatedAt: student.graduatedAt,
        certId: student.certId,
      },
      courses: coursesWithProgress,
      ranking,
    });
  } catch {
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}
