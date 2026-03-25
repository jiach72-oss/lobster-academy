'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { PassportApiResponse } from '@/types';

export default function PassportPage() {
  const { t } = useI18n();
  const [data, setData] = useState<PassportApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/passport')
      .then(res => res.json())
      .then(setData)
      .catch(() => setError('加载护照数据失败'));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0b0f', color: '#ef4444' }}>
        ⚠️ {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0b0f', color: '#a89b8c' }}>
        {t('common.loading')}
      </div>
    );
  }

  const { passport, changes } = data;

  return (
    <div className="min-h-screen" style={{ background: '#0d0b0f' }}>
      {/* Header */}
      <nav className="flex justify-between items-center max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦞</span>
          <div>
            <div className="text-sm font-bold" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>{t('site.name')}</div>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <Link href="/dashboard" className="text-sm hover:text-[#d4a853] transition" style={{ color: '#a89b8c' }}>
            {t('common.back')}
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold mb-8" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
          {t('passport.title')}
        </h1>

        {/* Passport Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-lg border" style={{ background: 'rgba(212, 168, 83, 0.05)', borderColor: 'rgba(212, 168, 83, 0.2)' }}>
            <div className="text-xs mb-1" style={{ color: '#8a7b6b' }}>{t('passport.agent_id')}</div>
            <div className="text-sm font-medium" style={{ color: '#d4a853' }}>{passport.agent_id}</div>
          </div>
          <div className="p-4 rounded-lg border" style={{ background: 'rgba(212, 168, 83, 0.05)', borderColor: 'rgba(212, 168, 83, 0.2)' }}>
            <div className="text-xs mb-1" style={{ color: '#8a7b6b' }}>{t('passport.framework')}</div>
            <div className="text-sm font-medium" style={{ color: '#d4a853' }}>{passport.framework}</div>
          </div>
          <div className="p-4 rounded-lg border" style={{ background: 'rgba(212, 168, 83, 0.05)', borderColor: 'rgba(212, 168, 83, 0.2)' }}>
            <div className="text-xs mb-1" style={{ color: '#8a7b6b' }}>{t('passport.status')}</div>
            <div className="text-sm font-medium" style={{ color: '#22c55e' }}>{passport.status}</div>
          </div>
          <div className="p-4 rounded-lg border" style={{ background: 'rgba(212, 168, 83, 0.05)', borderColor: 'rgba(212, 168, 83, 0.2)' }}>
            <div className="text-xs mb-1" style={{ color: '#8a7b6b' }}>{t('passport.issued')}</div>
            <div className="text-sm font-medium" style={{ color: '#d4a853' }}>{new Date(passport.issued_at).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Heartbeat Streak */}
        <div className="mb-8 p-4 rounded-lg border" style={{ background: 'rgba(212, 168, 83, 0.03)', borderColor: 'rgba(212, 168, 83, 0.15)' }}>
          <div className="text-xs mb-2" style={{ color: '#8a7b6b' }}>{t('passport.heartbeat_streak')}</div>
          <div className="flex gap-4">
            <div>
              <span className="text-2xl font-bold" style={{ color: '#22c55e' }}>{passport.heartbeat_streak_ok}</span>
              <span className="text-xs ml-1" style={{ color: '#8a7b6b' }}>{t('passport.pass')}</span>
            </div>
            <div>
              <span className="text-2xl font-bold" style={{ color: '#ef4444' }}>{passport.heartbeat_streak_fail}</span>
              <span className="text-xs ml-1" style={{ color: '#8a7b6b' }}>{t('passport.fail')}</span>
            </div>
          </div>
        </div>

        {/* Changes History */}
        {changes && changes.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#d4a853' }}>Changes</h2>
            <div className="space-y-2">
              {changes.map((change: { id: number; change_type: string; detail: string }) => (
                <div key={change.id} className="p-3 rounded-lg border text-sm" style={{ background: 'rgba(212, 168, 83, 0.03)', borderColor: 'rgba(212, 168, 83, 0.15)', color: '#a89b8c' }}>
                  {change.change_type}: {change.detail}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
