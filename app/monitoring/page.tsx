'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { HeartbeatEntry } from '@/types';

export default function MonitoringPage() {
  const { t } = useI18n();
  const [data, setData] = useState<{ heartbeats: HeartbeatEntry[]; passport: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/heartbeat')
      .then(res => res.json())
      .then(setData)
      .catch(() => setError('加载监控数据失败'));
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

  const { heartbeats, passport } = data;

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
          {t('monitoring.title')}
        </h1>

        {/* Heartbeat History */}
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#d4a853' }}>
          {t('monitoring.heartbeat_history')}
        </h2>

        {heartbeats.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#8a7b6b' }}>{t('monitoring.no_data')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(212, 168, 83, 0.2)' }}>
                  <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: '#8a7b6b' }}>{t('monitoring.time')}</th>
                  <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: '#8a7b6b' }}>{t('monitoring.pass_count')}</th>
                  <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: '#8a7b6b' }}>{t('monitoring.drift')}</th>
                </tr>
              </thead>
              <tbody>
                {heartbeats.map((hb: HeartbeatEntry, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(212, 168, 83, 0.1)' }}>
                    <td className="py-3 px-4 text-sm" style={{ color: '#a89b8c' }}>
                      {new Date(hb.checked_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium" style={{ color: hb.pass_count === hb.total_probes ? '#22c55e' : '#f59e0b' }}>
                        {hb.pass_count}/{hb.total_probes}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {hb.drift_detected ? (
                        <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                          {t('monitoring.detected')}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                          {t('monitoring.normal')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
