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
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // 获取已登录用户的已安装技能列表
    const session = getAuthSession(request);
    let installedSkillIds: string[] = [];
    if (session) {
      installedSkillIds = getInstalledSkills(session.studentId).map(s => s.skillId);
    }

    let skills = getSkills();
    if (category) {
      skills = skills.filter(s => s.category === category);
    }

    const skillsWithInstallStatus = skills.map(skill => ({
      ...skill,
      installed: installedSkillIds.includes(skill.skill_id),
    }));

    return NextResponse.json({ skills: skillsWithInstallStatus });
  } catch {
    return NextResponse.json({ error: '获取技能列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json();
    const { skill_id } = body;

    if (!skill_id) return NextResponse.json({ error: 'skill_id 必填' }, { status: 400 });

    const success = installSkill(session.studentId, skill_id);
    if (!success) {
      return NextResponse.json({ error: '技能已安装' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '安装技能失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json();
    const { skill_id } = body;

    if (!skill_id) return NextResponse.json({ error: 'skill_id 必填' }, { status: 400 });

    const success = uninstallSkill(session.studentId, skill_id);
    if (!success) {
      return NextResponse.json({ error: '技能未安装' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '卸载技能失败' }, { status: 500 });
  }
}
