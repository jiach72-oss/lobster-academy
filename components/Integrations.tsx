'use client';

import { useI18n } from '@/lib/i18n';

const FRAMEWORKS = [
  {
    name: 'OpenClaw',
    icon: '🐾',
    desc_en: 'Native plugin — zero config integration',
    desc_zh: '原生插件 — 零配置接入',
  },
  {
    name: 'LangChain',
    icon: '🔗',
    desc_en: 'Callback handler for chain-based agents',
    desc_zh: 'LangChain链式Agent回调处理器',
  },
  {
    name: 'CrewAI',
    icon: '👥',
    desc_en: 'Multi-agent crew monitoring middleware',
    desc_zh: '多Agent协作监控中间件',
  },
  {
    name: 'Generic Middleware',
    icon: '🔌',
    desc_en: 'Express/Koa/Fastify middleware for any stack',
    desc_zh: 'Express/Koa/Fastify 通用中间件',
  },
];

export default function Integrations() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isZh ? '框架集成' : 'Framework Integrations'}
          </h2>
          <p className="text-neutral-500">
            {isZh ? '一行代码接入你喜爱的AI框架' : 'One-line integration with your favorite AI framework'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FRAMEWORKS.map((fw, i) => (
            <div key={i}
              className="card-hover p-5 rounded-xl text-center"
              style={{ background: '#111', border: '1px solid #222' }}>
              <div className="text-3xl mb-3">{fw.icon}</div>
              <h3 className="text-base font-semibold text-white mb-1">{fw.name}</h3>
              <p className="text-xs text-neutral-500">
                {isZh ? fw.desc_zh : fw.desc_en}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
