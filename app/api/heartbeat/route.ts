import { NextRequest, NextResponse } from 'next/server';
import { getSession, getHeartbeats, addHeartbeat } from '@/lib/store';

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
    const heartbeats = getHeartbeats(session.studentId);

    const formatted = heartbeats.map(h => ({
      checked_at: h.checkedAt,
      pass_count: h.passCount,
      total_probes: h.totalProbes,
      drift_detected: h.driftDetected,
    }));

    return NextResponse.json({
      heartbeats: formatted,
      passport: {
        agent_id: session.student.agentName,
        status: session.student.graduated ? 'graduated' : 'active',
      },
    });
  } catch {
    return NextResponse.json({ error: '获取监控数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json();
    const { probes } = body;

    if (!Array.isArray(probes)) {
      return NextResponse.json({ error: 'probes 必须是数组' }, { status: 400 });
    }
    if (probes.length > 1000) {
      return NextResponse.json({ error: 'probes 数组过大，最多1000项' }, { status: 400 });
    }

    const passCount = probes.filter(Boolean).length;
    const totalProbes = probes.length;

    // C3: studentId 取自 session，不取 body，防止水平越权
    addHeartbeat(session.studentId, {
      checkedAt: new Date().toISOString(),
      passCount,
      totalProbes,
      driftDetected: passCount < totalProbes,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '记录心搏失败' }, { status: 500 });
  }
}
