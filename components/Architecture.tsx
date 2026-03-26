'use client';

import { useI18n } from '@/lib/i18n';

const STEPS = [
  { icon: '📹', label_en: 'Record', label_zh: '录制' },
  { icon: '🔒', label_en: 'Redact', label_zh: '脱敏' },
  { icon: '⚔️', label_en: 'Evaluate', label_zh: '评测' },
  { icon: '✍️', label_en: 'Sign', label_zh: '签名' },
  { icon: '📊', label_en: 'Report', label_zh: '报告' },
];

export default function Architecture() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isZh ? 'SDK 架构' : 'SDK Architecture'}
          </h2>
          <p className="text-neutral-500">
            {isZh ? '从行为录制到合规报告的完整流水线' : 'Full pipeline from behavior recording to compliance reporting'}
          </p>
        </div>

        {/* Architecture flow */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-0">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center">
              <div className="card-hover flex flex-col items-center p-5 rounded-xl w-28 md:w-32"
                style={{ background: '#111', border: '1px solid #222' }}>
                <div className="text-2xl mb-2">{step.icon}</div>
                <span className="text-sm font-medium text-white">
                  {isZh ? step.label_zh : step.label_en}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="hidden md:flex items-center px-2">
                  <svg className="w-5 h-5 text-[#dc2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              {i < STEPS.length - 1 && (
                <div className="md:hidden flex items-center py-1">
                  <svg className="w-5 h-5 text-[#dc2626] rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Module overview */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'recorder.ts', desc: isZh ? '行为录制引擎' : 'Behavior recorder' },
            { name: 'redactor.ts', desc: isZh ? 'PII脱敏器' : 'PII redactor' },
            { name: 'adversarial-engine.ts', desc: isZh ? '对抗评测引擎' : 'Adversarial engine' },
            { name: 'passport.ts', desc: isZh ? '护照管理' : 'Passport manager' },
            { name: 'monitor.ts', desc: isZh ? '持续监控' : 'Continuous monitor' },
            { name: 'signer.ts', desc: isZh ? 'Ed25519签名' : 'Ed25519 signer' },
            { name: 'reporter.ts', desc: isZh ? '报告生成' : 'Report generator' },
            { name: 'academy.ts', desc: isZh ? '学院流程' : 'Academy flow' },
          ].map((m, i) => (
            <div key={i} className="p-3 rounded-lg" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
              <code className="text-xs text-[#dc2626]">{m.name}</code>
              <p className="text-xs text-neutral-600 mt-1">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
