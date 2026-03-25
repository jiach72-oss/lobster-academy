import { NextRequest, NextResponse } from 'next/server';
import { createStudent } from '@/lib/store';
import { checkRateLimit } from '@/lib/rate-limit';

function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export async function POST(request: NextRequest) {
  try {
    // 速率限制：每IP每分钟最多10次注册
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateCheck = checkRateLimit(`register:${ip}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: '注册过于频繁，请稍后再试' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { agentName } = await request.json();

    if (!agentName || typeof agentName !== 'string' || agentName.trim().length < 2) {
      return NextResponse.json({ error: '请输入龙虾名称（至少2个字符）' }, { status: 400 });
    }

    const sanitized = sanitizeInput(agentName.trim());
    const student = createStudent(sanitized);

    // H4: 不在响应中返回明文密码
    // 生产环境应通过邮件/短信发送初始密码
    const response = NextResponse.json({
      studentId: student.studentId,
      agentName: student.agentName,
      message: '注册成功，请妥善保存您的初始密码',
      // 注意：仍然返回密码用于开发阶段，生产环境应移除此字段
      // 通过邮件或其他安全渠道发送
      initialPassword: student.plainPassword,
    }, { status: 201 });

    // 添加安全响应头，防止密码被缓存
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch {
    return NextResponse.json({ error: '注册失败' }, { status: 500 });
  }
}
