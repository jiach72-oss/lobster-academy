/**
 * 共享认证辅助函数 — 安全获取 session
 * 所有需要认证的 API 路由都应使用此函数
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/store';

/**
 * 安全获取用户 session
 * - 异常时返回 null（不抛出），确保 JSON 文件损坏不会 crash 服务
 * - 日志仅打印服务端，不暴露给客户端
 */
export function getAuthSession(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    return getSession(token);
  } catch (err) {
    console.error('[Auth] Session check failed:', err);
    return null;
  }
}
