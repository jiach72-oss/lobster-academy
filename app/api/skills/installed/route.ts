import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInstalledSkills, installSkill, uninstallSkill, getSkills } from '@/lib/store';

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
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const installed = getInstalledSkills(session.studentId);
    const installedWithDetails = installed.map(inst => {
      const skill = getSkills().find(s => s.skill_id === inst.skillId);
      return {
        skill_id: inst.skillId,
        name: skill?.name || inst.skillId,
        description: skill?.description || '',
        category: skill?.category || 'general',
        installed_at: inst.installedAt,
      };
    });

    return NextResponse.json({ installed: installedWithDetails });
  } catch {
    return NextResponse.json({ error: '获取已安装技能失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { skill_id } = await request.json();
    if (!skill_id) return NextResponse.json({ error: 'skill_id 必填' }, { status: 400 });

    const success = installSkill(session.studentId, skill_id);
    return NextResponse.json({ success });
  } catch {
    return NextResponse.json({ error: '安装技能失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { skill_id } = await request.json();
    if (!skill_id) return NextResponse.json({ error: 'skill_id 必填' }, { status: 400 });

    const success = uninstallSkill(session.studentId, skill_id);
    return NextResponse.json({ success });
  } catch {
    return NextResponse.json({ error: '卸载技能失败' }, { status: 500 });
  }
}
