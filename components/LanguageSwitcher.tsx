'use client';

import { useI18n } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 text-xs" style={{ color: '#8a7b6b' }}>
      <button
        onClick={() => setLocale('en')}
        className={`px-2 py-1 rounded transition ${locale === 'en' ? 'font-bold' : 'hover:opacity-80'}`}
        style={{
          color: locale === 'en' ? '#d4a853' : '#8a7b6b',
          background: locale === 'en' ? 'rgba(212, 168, 83, 0.1)' : 'transparent',
        }}
      >
        EN
      </button>
      <span style={{ color: '#4a3b2b' }}>|</span>
      <button
        onClick={() => setLocale('zh')}
        className={`px-2 py-1 rounded transition ${locale === 'zh' ? 'font-bold' : 'hover:opacity-80'}`}
        style={{
          color: locale === 'zh' ? '#d4a853' : '#8a7b6b',
          background: locale === 'zh' ? 'rgba(212, 168, 83, 0.1)' : 'transparent',
        }}
      >
        中文
      </button>
    </div>
  );
}
