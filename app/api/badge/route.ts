import { NextRequest, NextResponse } from 'next/server';
import { getSession, getProgress, getCourses } from '@/lib/store';

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

export async function GET(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    // C3: studentId 取自 session，不取 body
    const { studentId, student } = session;

    const progress = getProgress(studentId);
    const courses = getCourses();
    const passedCount = progress.filter(p => p.status === 'passed').length;

    const badges = [];

    // 根据进度授予徽章
    if (passedCount >= 1) badges.push({ id: 'first-course', name: '初学者', description: '完成第一门课程', icon: '🎓' });
    if (passedCount >= 4) badges.push({ id: 'college-complete', name: '学院之星', description: '完成一个学院全部课程', icon: '⭐' });
    if (passedCount >= 8) badges.push({ id: 'half-way', name: '半程达人', description: '完成一半课程', icon: '🏅' });
    if (student.graduated) badges.push({ id: 'graduate', name: '毕业生', description: '完成所有课程并毕业', icon: '🏆' });
    if (student.score >= 90) badges.push({ id: 'honor-roll', name: '荣誉榜', description: '总分达到90以上', icon: '🎖️' });
    if (student.score >= 95) badges.push({ id: 'valedictorian', name: '优秀毕业生', description: '总分达到95以上', icon: '👑' });

    return NextResponse.json({ badges, total: badges.length });
  } catch {
    return NextResponse.json({ error: '获取徽章失败' }, { status: 500 });
  }
}
