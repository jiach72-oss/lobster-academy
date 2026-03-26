'use client';

import { useI18n } from '@/lib/i18n';

const STATS = [
  { value: '208', label_en: 'PII Patterns', label_zh: 'PII模式' },
  { value: '53', label_en: 'Attack Scenarios', label_zh: '攻击场景' },
  { value: '352', label_en: 'Test Cases', label_zh: '测试用例' },
  { value: '20', label_en: 'Algorithm Modules', label_zh: '算法模块' },
  { value: '4', label_en: 'Framework Integrations', label_zh: '框架集成' },
];

export default function Stats() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {STATS.map((s, i) => (
            <div key={i} className="text-center p-5 rounded-xl" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-3xl md:text-4xl font-bold text-[#dc2626] mb-1">{s.value}</div>
              <div className="text-xs text-neutral-500">
                {isZh ? s.label_zh : s.label_en}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
