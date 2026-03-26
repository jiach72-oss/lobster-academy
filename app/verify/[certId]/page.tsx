'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { VerifyApiResponse } from '@/types';

export default function VerifyPage({ params }: { params: { certId: string } }) {
  const { t } = useI18n();
  const [data, setData] = useState<VerifyApiResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/verify/${params.certId}`)
      .then(res => {
        if (!res.ok) throw new Error('Certificate not found');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message));
  }, [params.certId]);

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
          <Link href="/" className="text-sm hover:text-[#d4a853] transition" style={{ color: '#a89b8c' }}>
            {t('common.back')}
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-2xl mx-auto px-8 py-20">
        <h1 className="text-2xl font-bold mb-8 text-center" style={{ color: '#d4a853', fontFamily: 'Georgia, serif' }}>
          {t('verify.title')}
        </h1>

        {error ? (
          <div className="text-center">
            <span className="text-6xl">❌</span>
            <p className="mt-4 text-lg" style={{ color: '#ef4444' }}>{t('verify.invalid')}</p>
            <p className="mt-2 text-sm" style={{ color: '#8a7b6b' }}>{t('verify.not_found')}</p>
          </div>
        ) : data ? (
          <div className="p-6 rounded-lg border" style={{ background: 'rgba(212, 168, 83, 0.05)', borderColor: 'rgba(212, 168, 83, 0.2)' }}>
            <div className="text-center mb-6">
              <span className="text-6xl">✅</span>
              <p className="mt-4 text-lg font-semibold" style={{ color: '#22c55e' }}>{t('verify.valid')}</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b" style={{ borderColor: 'rgba(212, 168, 83, 0.1)' }}>
                <span className="text-sm" style={{ color: '#8a7b6b' }}>{t('verify.cert_id')}</span>
                <span className="text-sm font-medium" style={{ color: '#d4a853' }}>{data.certificate.cert_id}</span>
              </div>
              <div className="flex justify-between py-2 border-b" style={{ borderColor: 'rgba(212, 168, 83, 0.1)' }}>
                <span className="text-sm" style={{ color: '#8a7b6b' }}>{t('verify.agent')}</span>
                <span className="text-sm font-medium" style={{ color: '#d4a853' }}>{data.agent.agent_id}</span>
              </div>
              <div className="flex justify-between py-2 border-b" style={{ borderColor: 'rgba(212, 168, 83, 0.1)' }}>
                <span className="text-sm" style={{ color: '#8a7b6b' }}>{t('verify.student_id')}</span>
                <span className="text-sm font-medium" style={{ color: '#d4a853' }}>{data.agent.student_id}</span>
              </div>
              <div className="flex justify-between py-2 border-b" style={{ borderColor: 'rgba(212, 168, 83, 0.1)' }}>
                <span className="text-sm" style={{ color: '#8a7b6b' }}>{t('verify.score')}</span>
                <span className="text-2xl font-bold" style={{ color: '#d4a853' }}>{data.certificate.score}</span>
              </div>
              <div className="flex justify-between py-2 border-b" style={{ borderColor: 'rgba(212, 168, 83, 0.1)' }}>
                <span className="text-sm" style={{ color: '#8a7b6b' }}>{t('verify.grade')}</span>
                <span className="text-sm px-2 py-1 rounded font-bold" style={{ background: 'rgba(212, 168, 83, 0.1)', color: '#d4a853' }}>{data.certificate.grade}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm" style={{ color: '#8a7b6b' }}>{t('verify.issued')}</span>
                <span className="text-sm font-medium" style={{ color: '#d4a853' }}>
                  {new Date(data.certificate.issued_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center" style={{ color: '#8a7b6b' }}>
            {t('common.loading')}
          </div>
        )}
      </div>
    </div>
  );
}
