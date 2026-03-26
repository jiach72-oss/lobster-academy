import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/store';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    if (token) deleteSession(token);

    const response = NextResponse.json({ success: true });
    response.cookies.delete('session');
    return response;
  } catch {
    // 即使 deleteSession 失败，也清除 cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session');
    return response;
  }
}
