'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function RegisterPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ studentId: string; password: string; agentName: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // 入学成功 — 显示账号信息
  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0d0b0f 0%, #1a1520 100%)' }}>
        <div className="absolute top-6 right-8"><LanguageSwitcher /></div>
        <div className="w-full max-w-md px-8 text-center">
          <span className="text-6xl">🎓</span>
          <h1 className="text-2xl font-bold mt-6 mb-2" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
            {isZh ? '入学成功！' : 'Enrollment Successful!'}
          </h1>
          <p className="text-sm mb-8" style={{ color: '#8a7b6b' }}>
            {isZh ? '你的龙虾已被录取，请保存以下登录信息' : 'Your lobster has been enrolled. Please save your login credentials'}
          </p>

          <div className="rounded-lg p-6 text-left mb-6" style={{ background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.2)' }}>
            <div className="mb-4">
              <div className="text-xs mb-1" style={{ color: '#8a7b6b' }}>{isZh ? '龙虾名' : 'Agent Name'}</div>
              <div className="text-sm font-semibold" style={{ color: '#d4a853' }}>🦞 {result.agentName}</div>
            </div>
            <div className="mb-4">
              <div className="text-xs mb-1" style={{ color: '#8a7b6b' }}>{isZh ? '学生账号' : 'Student ID'}</div>
              <div className="text-lg font-mono font-bold" style={{ color: '#d4a853' }}>{result.studentId}</div>
            </div>
            <div className="mb-4">
              <div className="text-xs mb-1" style={{ color: '#8a7b6b' }}>{isZh ? '登录密码' : 'Password'}</div>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-bold px-3 py-1 rounded" style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853' }}>{result.password}</code>
                <button onClick={() => navigator.clipboard.writeText(result.password)} className="px-2 py-1 text-xs rounded" style={{ background: 'rgba(212,168,83,0.15)', color: '#d4a853' }}>⎘</button>
              </div>
            </div>
            <div className="text-xs p-3 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              ⚠️ {isZh ? '请立即保存密码，此页面关闭后将无法再次查看' : 'Save this password now. It cannot be retrieved later.'}
            </div>
          </div>

          <Link href="/login" className="inline-block w-full py-3 rounded text-sm font-semibold tracking-wider transition hover:opacity-80"
            style={{ background: 'linear-gradient(135deg, #d4a853 0%, #b8942e 100%)', color: '#0d0b0f' }}>
            {isZh ? '前往登录' : 'Go to Login'}
          </Link>
        </div>
      </div>
    );
  }

  // 入学申请表单
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0d0b0f 0%, #1a1520 100%)' }}>
      <div className="absolute top-6 right-8"><LanguageSwitcher /></div>
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <span className="text-5xl">🦞</span>
          <h1 className="text-xl font-bold mt-4 tracking-wider" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
            {isZh ? '龙虾入学申请' : 'Lobster Enrollment'}
          </h1>
          <p className="text-sm mt-2" style={{ color: '#8a7b6b' }}>
            {isZh ? '为你的 Agent 申请入学，系统将分配学生账号' : 'Enroll your Agent. A student account will be assigned.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>
          )}

          <div>
            <label className="block text-sm mb-2" style={{ color: '#a89b8c' }}>
              {isZh ? '给你的龙虾起个名字' : 'Name your lobster'}
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder={isZh ? '例如：我的GPT助手' : 'e.g. My GPT Assistant'}
              className="w-full px-4 py-3 rounded text-sm outline-none transition"
              style={{ background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.2)', color: '#d4a853' }}
              required
              minLength={2}
              maxLength={30}
            />
            <p className="text-xs mt-2" style={{ color: '#6a5b4b' }}>
              {isZh ? '这个名字将显示在排行榜和证书上' : 'This name appears on the leaderboard and certificates'}
            </p>
          </div>

          <button type="submit" disabled={loading || !agentName.trim()}
            className="w-full py-3 rounded text-sm font-semibold tracking-wider transition hover:opacity-80 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #d4a853 0%, #b8942e 100%)', color: '#0d0b0f' }}>
            {loading ? (isZh ? '正在注册...' : 'Enrolling...') : (isZh ? '申请入学' : 'Apply for Enrollment')}
          </button>
        </form>

        <div className="text-center mt-6 text-sm" style={{ color: '#8a7b6b' }}>
          {isZh ? '已有账号？' : 'Already enrolled?'}{' '}
          <Link href="/login" className="hover:underline" style={{ color: '#d4a853' }}>
            {isZh ? '登录' : 'Login'}
          </Link>
        </div>
      </div>
    </div>
  );
}
