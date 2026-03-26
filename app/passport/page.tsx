'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { PassportApiResponse } from '@/types';

export default function PassportPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const [data, setData] = useState<PassportApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    fetch('/api/passport')
      .then(res => {
        if (!res.ok) throw new Error('No data');
        return res.json();
      })
      .then(setData)
      .catch(() => setDemoMode(true));
  }, []);

  // Demo data for showcase
  const demoPassport = {
    agent_id: 'demo-lobster-agent',
    framework: 'OpenClaw',
    status: 'active',
    issued_at: '2026-03-01T00:00:00Z',
    heartbeat_streak_ok: 47,
    heartbeat_streak_fail: 2,
    fingerprint: 'sha256:a1b2c3d4...',
    score: 86,
    grade: 'A',
  };

  const demoChanges = [
    { id: 1, change_type: 'model_update', detail: 'GPT-4 → GPT-4o migration detected' },
    { id: 2, change_type: 'config_change', detail: 'Temperature changed from 0.7 to 0.3' },
    { id: 3, change_type: 'retest_recommended', detail: 'Security dimension score dropped below threshold' },
  ];

  const passport: Record<string, unknown> | null = demoMode ? demoPassport : (data?.passport ?? null);
  const changes = demoMode ? demoChanges : data?.changes;

  if (!passport) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="text-neutral-500 animate-pulse">{isZh ? '加载中...' : 'Loading...'}</div>
      </div>
    );
  }

  const p = passport as {
    agent_id: string; framework: string; status: string; issued_at: string;
    heartbeat_streak_ok: number; heartbeat_streak_fail: number;
    fingerprint?: string; score?: number; grade?: string;
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🛂</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isZh ? 'Agent 护照' : 'Agent Passport'}
          </h1>
          <p className="text-neutral-500">
            {isZh ? 'Agent身份指纹与变更追踪' : 'Agent identity fingerprint & change tracking'}
          </p>
          {demoMode && (
            <div className="inline-block mt-3 px-3 py-1 rounded-full text-xs"
              style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#ef4444' }}>
              Demo Mode
            </div>
          )}
        </div>

        {/* Passport Card */}
        <div className="rounded-xl p-6 mb-8" style={{ background: '#111', border: '1px solid #222' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="text-xs text-neutral-600 mb-1">{isZh ? 'Agent ID' : 'Agent ID'}</div>
              <div className="text-sm font-mono text-white">{p.agent_id}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-600 mb-1">{isZh ? '框架' : 'Framework'}</div>
              <div className="text-sm text-white">{p.framework}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-600 mb-1">{isZh ? '状态' : 'Status'}</div>
              <div className="text-sm font-medium" style={{ color: p.status === 'active' ? '#22c55e' : '#f59e0b' }}>
                {p.status}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-600 mb-1">{isZh ? '签发日期' : 'Issued'}</div>
              <div className="text-sm text-white">{new Date(p.issued_at).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Score & Grade */}
          {p.score !== undefined && (
            <div className="flex items-center gap-6 pt-4" style={{ borderTop: '1px solid #1a1a1a' }}>
              <div>
                <div className="text-xs text-neutral-600 mb-1">{isZh ? '综合评分' : 'Score'}</div>
                <div className="text-3xl font-bold text-[#dc2626]">{p.score}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600 mb-1">{isZh ? '等级' : 'Grade'}</div>
                <div className="text-3xl font-bold" style={{
                  color: p.grade === 'S' ? '#eab308' : p.grade === 'A' ? '#22c55e' : '#d4a853'
                }}>{p.grade}</div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-neutral-600 mb-1">{isZh ? '心跳状态' : 'Heartbeat'}</div>
                <div className="flex gap-4">
                  <span className="text-sm"><span className="text-[#22c55e] font-bold">{p.heartbeat_streak_ok}</span> <span className="text-neutral-600">pass</span></span>
                  <span className="text-sm"><span className="text-[#ef4444] font-bold">{p.heartbeat_streak_fail}</span> <span className="text-neutral-600">fail</span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fingerprint */}
        {p.fingerprint && (
          <div className="rounded-xl p-5 mb-8" style={{ background: '#111', border: '1px solid #222' }}>
            <div className="text-xs text-neutral-600 mb-2">{isZh ? 'Agent 指纹' : 'Agent Fingerprint'}</div>
            <code className="text-sm text-[#dc2626]">{p.fingerprint}</code>
          </div>
        )}

        {/* Changes History */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">
            {isZh ? '变更历史' : 'Change History'}
          </h2>
          {changes && changes.length > 0 ? (
            <div className="space-y-3">
              {changes.map((change) => (
                <div key={change.id} className="p-4 rounded-lg flex items-start gap-3"
                  style={{ background: '#111', border: '1px solid #222' }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{
                      background: change.change_type === 'retest_recommended' ? '#ef4444' :
                        change.change_type === 'model_update' ? '#f59e0b' : '#3b82f6'
                    }} />
                  <div>
                    <div className="text-xs text-neutral-500 mb-1 uppercase">{change.change_type.replace(/_/g, ' ')}</div>
                    <div className="text-sm text-neutral-300">{change.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-600">
              {isZh ? '暂无变更记录' : 'No changes recorded'}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <a href="/check" className="text-sm text-[#dc2626] hover:underline">
            {isZh ? '重新体检 →' : 'Run New Check →'}
          </a>
        </div>
      </div>
    </div>
  );
}
