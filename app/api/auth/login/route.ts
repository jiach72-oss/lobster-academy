import { NextRequest, NextResponse } from 'next/server';
import { findStudent, createSession } from '@/lib/store';
import { verifyPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`login:${ip}`, 5, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '登录尝试过于频繁，请稍后再试' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { studentId, password } = await request.json();

    if (!studentId || !password) {
      return NextResponse.json({ error: '请输入学生账号和密码' }, { status: 400 });
    }

    // C4: 防御用户枚举 — 学生不存在时传入 dummy hash 确保恒定时间计算
    const student = findStudent(studentId.toUpperCase());
    if (!verifyPassword(password, student?.password ?? 'dummy:0:')) {
      // 统一错误信息，不区分"账号不存在"和"密码错误"
      return NextResponse.json({ error: '学生账号或密码错误' }, { status: 401 });
    }

    // 此处 student 一定存在（因为 verifyPassword 返回 true 意味着 hash 匹配成功）
    const token = createSession(student!.studentId);
    const response = NextResponse.json({ success: true });
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
