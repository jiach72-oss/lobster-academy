import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession, getProgress, getCourses, getStudents, saveStudents } from '@/lib/store';

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

    const { student } = session;
    const courses = getCourses();
    const progress = getProgress(session.studentId);
    const passedCount = progress.filter(p => p.status === 'passed').length;

    return NextResponse.json({
      graduated: student.graduated,
      certId: student.certId,
      graduatedAt: student.graduatedAt,
      totalCourses: courses.length,
      passedCourses: passedCount,
      canGraduate: passedCount === courses.length,
    });
  } catch {
    return NextResponse.json({ error: '获取毕业状态失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    // C3: studentId 取自 session，防止水平越权
    const { studentId } = session;
    const students = getStudents();
    const studentIdx = students.findIndex(s => s.studentId === studentId);
    if (studentIdx < 0) return NextResponse.json({ error: '学生不存在' }, { status: 404 });

    const student = students[studentIdx];
    if (student.graduated) {
      return NextResponse.json({
        success: true,
        message: '已经毕业',
        certificate: {
          cert_id: student.certId,
          graduated_at: student.graduatedAt,
        },
      });
    }

    // 检查是否所有课程都已通过
    const courses = getCourses();
    const progress = getProgress(studentId);
    const allPassed = courses.every(c => {
      const p = progress.find(pr => pr.courseId === c.id);
      return p?.status === 'passed';
    });

    if (!allPassed) {
      const passedCount = progress.filter(p => p.status === 'passed').length;
      return NextResponse.json({
        error: `尚未完成所有课程 (${passedCount}/${courses.length})`,
        passedCourses: passedCount,
        totalCourses: courses.length,
      }, { status: 400 });
    }

    // 生成毕业证书
    const certId = `CERT-LOB-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const totalScore = progress.reduce((sum, p) => sum + (p.score || 0), 0);
    const avgScore = Math.round(totalScore / progress.length);

    // 确定等级
    let grade = 'C';
    if (avgScore >= 95) grade = 'S';
    else if (avgScore >= 90) grade = 'A';
    else if (avgScore >= 80) grade = 'B';

    students[studentIdx] = {
      ...student,
      graduated: true,
      graduatedAt: new Date().toISOString(),
      certId,
      grade,
    };
    saveStudents(students);

    return NextResponse.json({
      success: true,
      certificate: {
        cert_id: certId,
        score: avgScore,
        grade,
        cert_level: 'L2',
        security_level: 'S2',
        issued_at: students[studentIdx].graduatedAt,
        status: 'active',
      },
    });
  } catch {
    return NextResponse.json({ error: '毕业失败' }, { status: 500 });
  }
}
