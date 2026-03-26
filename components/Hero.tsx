'use client';

import { useI18n } from '@/lib/i18n';

export default function Hero() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.08) 0%, transparent 60%)' }} />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.04) 0%, transparent 70%)' }} />

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-8 animate-fade-in-up"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#ef4444' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626] animate-pulse" />
          v0.2.0 — Blackbox SDK Released
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <span className="text-white">🦞 Lobster</span>{' '}
          <span className="gradient-text">Academy</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-neutral-300 mb-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {isZh ? 'AI Agent 培训与评测平台' : 'AI Agent Training & Evaluation Platform'}
        </p>

        {/* Slogan */}
        <p className="text-base text-neutral-500 mb-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {isZh ? '每只龙虾都该有一个黑匣子' : 'Every Agent deserves a black box'}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <a href="/docs"
            className="px-6 py-3 rounded-lg bg-[#dc2626] text-white font-semibold hover:bg-[#b91c1c] transition text-sm">
            {isZh ? '快速开始' : 'Get Started'}
          </a>
          <a href="https://github.com/jiach72-oss/lobster-academy" target="_blank" rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white transition text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            View on GitHub
          </a>
        </div>

        {/* Code preview */}
        <div className="max-w-xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <div className="rounded-lg overflow-hidden" style={{ background: '#111', border: '1px solid #222' }}>
            <div className="flex items-center gap-2 px-4 py-2" style={{ background: '#161616', borderBottom: '1px solid #222' }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
              </div>
              <span className="text-xs text-neutral-500 ml-2">terminal</span>
            </div>
            <pre className="p-4 text-sm text-left overflow-x-auto text-neutral-300 leading-relaxed">
{`$ npm install @lobster-academy/blackbox

import { LobsterBlackbox } from '@lobster-academy/blackbox';
const lobster = new LobsterBlackbox({ agentId: 'my-agent' });
lobster.record({ type: 'decision', ... });`}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
