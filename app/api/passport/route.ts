import { NextRequest, NextResponse } from 'next/server';
import { getSession, getHeartbeats } from '@/lib/store';

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

    const heartbeats = getHeartbeats(student.studentId);
    let streakOk = 0;
    let streakFail = 0;
    // 从最近的心跳往前计算连续次数
    for (let i = heartbeats.length - 1; i >= 0; i--) {
      if (!heartbeats[i].driftDetected) {
        streakOk++;
      } else {
        streakFail++;
        break;
      }
    }

    return NextResponse.json({
      passport: {
        agent_id: student.agentName,
        framework: 'openclaw',
        status: student.graduated ? 'graduated' : 'active',
        issued_at: student.enrolledAt,
        heartbeat_streak_ok: streakOk,
        heartbeat_streak_fail: streakFail,
      },
      changes: [],
    });
  } catch {
    return NextResponse.json({ error: '获取护照失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '更新护照失败' }, { status: 500 });
  }
}
