import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/store';

export function middleware(request: NextRequest) {
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/verify', '/api/verify/', '/api/ranking'];
  const pathname = request.nextUrl.pathname;
  const isPublic = publicPaths.some(p => pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  // C1: CSRF 保护 — 检查 Origin/Referer（修复同源 POST 误判）
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (origin !== null) {
      // 优先检查 Origin 头（最可靠的 CSRF 防护手段）
      if (!origin.includes(host || '')) {
        return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
      }
    } else {
      // Origin 为 null 时检查 Referer（浏览器同源请求通常带 Referer）
      const referer = request.headers.get('referer');
      if (!referer || !referer.includes(host || '')) {
        return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
      }
    }
  }

  // C2: API 路由认证 — getSession 加 try-catch 保护
  if (pathname.startsWith('/api/')) {
    const token = request.cookies.get('session')?.value;
    if (!token) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    let session;
    try {
      session = getSession(token);
    } catch (err) {
      console.error('[Auth] Session check failed:', err);
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
