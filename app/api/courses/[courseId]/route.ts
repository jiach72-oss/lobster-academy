import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession, getCourse, getProgress, updateProgress, getCourses, getStudents, saveStudents } from '@/lib/store';

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { courseId } = await params;
    const course = getCourse(courseId);
    if (!course) return NextResponse.json({ error: '课程不存在' }, { status: 404 });

    const progress = getProgress(session.studentId);
    const courseProgress = progress.find(p => p.courseId === courseId);

    return NextResponse.json({
      course,
      progress: courseProgress || { status: 'locked', score: null, attempts: 0 },
    });
  } catch {
    return NextResponse.json({ error: '获取课程失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { courseId } = await params;
    const course = getCourse(courseId);
    if (!course) return NextResponse.json({ error: '课程不存在' }, { status: 404 });

    const body = await request.json();
    const { action } = body;
    const { studentId } = session;

    const progress = getProgress(studentId);
    const courseProgress = progress.find(p => p.courseId === courseId);

    if (action === 'start') {
      if (courseProgress && courseProgress.status !== 'available') {
        return NextResponse.json({ error: '课程状态不允许开始学习' }, { status: 400 });
      }
      updateProgress(studentId, courseId, { status: 'studying' });
      return NextResponse.json({ success: true, status: 'studying' });
    }

    if (action === 'complete') {
      if (!courseProgress || courseProgress.status !== 'studying') {
        return NextResponse.json({ error: '请先开始学习该课程' }, { status: 400 });
      }
      // 使用 crypto.randomBytes 替代 Math.random()（M4 一致性）
      const score = (crypto.randomInt(31)) + 70;
      updateProgress(studentId, courseId, {
        status: 'passed',
        score,
        attempts: (courseProgress.attempts || 0) + 1,
      });

      // 解锁下一门课程
      const courses = getCourses();
      const currentIdx = courses.findIndex(c => c.id === courseId);
      if (currentIdx >= 0 && currentIdx < courses.length - 1) {
        const nextCourse = courses[currentIdx + 1];
        const nextProgress = progress.find(p => p.courseId === nextCourse.id);
        if (!nextProgress || nextProgress.status === 'locked') {
          updateProgress(studentId, nextCourse.id, { status: 'available' });
        }
      }

      // 更新学生分数
      const students = getStudents();
      const studentIdx = students.findIndex(s => s.studentId === studentId);
      if (studentIdx >= 0) {
        students[studentIdx].score += score;
        // 根据总分更新等级
        const totalScore = students[studentIdx].score;
        if (totalScore >= 1000) students[studentIdx].grade = 'S';
        else if (totalScore >= 800) students[studentIdx].grade = 'A';
        else if (totalScore >= 600) students[studentIdx].grade = 'B';
        else if (totalScore >= 400) students[studentIdx].grade = 'C';
        // 根据完成课程最多的学院自动分院
        const allProgress = getProgress(studentId);
        const passedCourses = allProgress.filter(p => p.status === 'passed');
        if (passedCourses.length >= 3) {
          const collegeCounts: Record<string, number> = {};
          for (const p of passedCourses) {
            const c = getCourse(p.courseId);
            if (c) collegeCounts[c.college_zh] = (collegeCounts[c.college_zh] || 0) + 1;
          }
          const topCollege = Object.entries(collegeCounts).sort((a, b) => b[1] - a[1])[0];
          if (topCollege) students[studentIdx].college = topCollege[0];
        }
        saveStudents(students);
      }

      return NextResponse.json({ success: true, status: 'passed', score });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
