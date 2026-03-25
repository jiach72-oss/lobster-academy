'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function LoginPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0d0b0f 0%, #1a1520 100%)' }}>
      <div className="absolute top-6 right-8"><LanguageSwitcher /></div>
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <span className="text-5xl">🦞</span>
          <h1 className="text-xl font-bold mt-4 tracking-wider" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
            {isZh ? '学生登录' : 'Student Login'}
          </h1>
          <p className="text-sm mt-2" style={{ color: '#8a7b6b' }}>
            {isZh ? '使用入学时分配的学生账号登录' : 'Login with your student credentials'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>
          )}

          <div>
            <label className="block text-sm mb-2" style={{ color: '#a89b8c' }}>
              {isZh ? '学生账号' : 'Student ID'}
            </label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.toUpperCase())}
              placeholder="LOB-2026-XXXXXX"
              className="w-full px-4 py-3 rounded text-sm font-mono outline-none transition"
              style={{ background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.2)', color: '#d4a853' }}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: '#a89b8c' }}>
              {isZh ? '密码' : 'Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded text-sm font-mono outline-none transition"
              style={{ background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.2)', color: '#d4a853' }}
              required
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded text-sm font-semibold tracking-wider transition hover:opacity-80 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #d4a853 0%, #b8942e 100%)', color: '#0d0b0f' }}>
            {loading ? (isZh ? '登录中...' : 'Logging in...') : (isZh ? '登录' : 'Login')}
          </button>
        </form>

        <div className="text-center mt-6 text-sm" style={{ color: '#8a7b6b' }}>
          {isZh ? '还没有账号？' : "Don't have an account?"}{' '}
          <Link href="/register" className="hover:underline" style={{ color: '#d4a853' }}>
            {isZh ? '申请入学' : 'Enroll Now'}
          </Link>
        </div>
      </div>
    </div>
  );
}
