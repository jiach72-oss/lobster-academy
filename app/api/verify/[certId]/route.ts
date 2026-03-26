import { NextRequest, NextResponse } from 'next/server';
import { getStudents } from '@/lib/store';

export async function GET(
  request: NextRequest,
  { params }: { params: { certId: string } }
) {
  try {
    const { certId } = params;
    
    const students = getStudents();
    const student = students.find(s => s.certId === certId);
    
    if (!student) {
      return NextResponse.json({ 
        valid: false,
        error: '证书不存在或无效' 
      }, { status: 404 });
    }

    if (!student.graduated) {
      return NextResponse.json({ 
        valid: false,
        error: '该学生尚未毕业' 
      }, { status: 400 });
    }

    // 只返回必要的公开信息，不暴露 studentId（防止信息泄露）
    return NextResponse.json({
      valid: true,
      certificate: {
        cert_id: student.certId,
        agent_name: student.agentName,
        college: student.college,
        grade: student.grade,
        score: student.score,
        issued_at: student.graduatedAt,
      },
    });
  } catch {
    return NextResponse.json({ error: '验证失败' }, { status: 500 });
  }
}
