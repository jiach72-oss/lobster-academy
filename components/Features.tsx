'use client';

import { useI18n } from '@/lib/i18n';

const FEATURES = [
  {
    icon: '📹',
    title_en: 'Behavior Recording',
    title_zh: '行为录制',
    desc_en: '208 PII patterns auto-redacted. Ed25519 signed evidence chain.',
    desc_zh: '208种PII模式自动脱敏，Ed25519签名防篡改证据链。',
  },
  {
    icon: '💀',
    title_en: 'Adversarial Evaluation',
    title_zh: '对抗评测',
    desc_en: '53 attack scenarios for real-world red team testing.',
    desc_zh: '53种攻击场景，真实红队对抗测试。',
  },
  {
    icon: '🎓',
    title_en: 'Academy Certification',
    title_zh: '学院认证',
    desc_en: '5 dimensions, 25 metrics for comprehensive Agent grading.',
    desc_zh: '5维度25指标，综合Agent能力评级。',
  },
  {
    icon: '🛂',
    title_en: 'Agent Passport',
    title_zh: 'Agent护照',
    desc_en: 'Fingerprint + change detection + re-test recommendations.',
    desc_zh: '指纹识别+变更检测+复测建议。',
  },
  {
    icon: '📡',
    title_en: 'Continuous Monitoring',
    title_zh: '持续监控',
    desc_en: '6 detection types with automatic alerting on drift.',
    desc_zh: '6种检测类型，漂移自动预警。',
  },
  {
    icon: '📋',
    title_en: 'Compliance Reports',
    title_zh: '合规报告',
    desc_en: 'EU AI Act & SOC2 ready. Export HTML/PDF reports.',
    desc_zh: 'EU AI Act + SOC2 合规，导出HTML/PDF报告。',
  },
];

export default function Features() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isZh ? '核心功能' : 'Core Features'}
          </h2>
          <p className="text-neutral-500 max-w-xl mx-auto">
            {isZh
              ? '从录制到报告，覆盖Agent安全评测全生命周期'
              : 'From recording to reporting — full lifecycle Agent security evaluation'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i}
              className="card-hover p-6 rounded-xl"
              style={{ background: '#111', border: '1px solid #222' }}>
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {isZh ? f.title_zh : f.title_en}
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                {isZh ? f.desc_zh : f.desc_en}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
