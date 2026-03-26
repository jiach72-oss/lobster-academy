'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="px-2 py-1 text-xs rounded transition"
      style={{
        background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
        color: copied ? '#22c55e' : '#737373',
      }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export default function CheckPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const [agentId, setAgentId] = useState('');
  const [result, setResult] = useState<null | {
    score: number;
    grade: string;
    dimensions: { name: string; name_zh: string; score: number; status: string }[];
  }>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = () => {
    if (!agentId.trim()) return;
    setLoading(true);
    // Simulated evaluation result
    setTimeout(() => {
      setResult({
        score: 82,
        grade: 'A',
        dimensions: [
          { name: 'Security', name_zh: '安全防御', score: 78, status: 'warning' },
          { name: 'Reasoning', name_zh: '推理能力', score: 91, status: 'good' },
          { name: 'Tool Use', name_zh: '工具使用', score: 85, status: 'good' },
          { name: 'Compliance', name_zh: '合规性', score: 72, status: 'warning' },
          { name: 'Reliability', name_zh: '可靠性', score: 84, status: 'good' },
        ],
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🏥</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isZh ? 'Agent 体检' : 'Agent Health Check'}
          </h1>
          <p className="text-neutral-500">
            {isZh
              ? '输入Agent ID，运行快速健康评测'
              : 'Enter your Agent ID to run a quick health evaluation'}
          </p>
        </div>

        {/* Input */}
        <div className="flex gap-3 mb-8">
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder={isZh ? '输入 Agent ID...' : 'Enter Agent ID...'}
            className="flex-1 px-4 py-3 rounded-lg text-sm text-white placeholder-neutral-600 outline-none focus:ring-1 focus:ring-[#dc2626]"
            style={{ background: '#111', border: '1px solid #222' }}
          />
          <button
            onClick={runCheck}
            disabled={loading || !agentId.trim()}
            className="px-6 py-3 rounded-lg bg-[#dc2626] text-white text-sm font-medium hover:bg-[#b91c1c] transition disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (isZh ? '评测中...' : 'Evaluating...') : (isZh ? '开始体检' : 'Run Check')}
          </button>
        </div>

        {/* CLI alternative */}
        <div className="rounded-lg overflow-hidden mb-10" style={{ background: '#111', border: '1px solid #222' }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ background: '#161616', borderBottom: '1px solid #222' }}>
            <span className="text-xs text-neutral-500">terminal</span>
            <CopyButton text={`lobster check --agent ${agentId || 'my-agent'}`} />
          </div>
          <pre className="p-4 text-sm">
            <span className="text-neutral-600">$ </span>
            <span className="text-neutral-300">lobster check --agent </span>
            <span className="text-[#dc2626]">{agentId || 'my-agent'}</span>
          </pre>
        </div>

        {/* Results */}
        {result && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <div className="text-6xl font-bold gradient-text mb-2">{result.score}</div>
              <div className="text-sm text-neutral-500">
                {isZh ? '综合评分' : 'Overall Score'} ·{' '}
                <span className="text-lg font-bold" style={{
                  color: result.grade === 'S' ? '#eab308' : result.grade === 'A' ? '#22c55e' : '#d4a853'
                }}>{result.grade}</span>
              </div>
            </div>

            <div className="space-y-3">
              {result.dimensions.map((d, i) => (
                <div key={i} className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #222' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white">{isZh ? d.name_zh : d.name}</span>
                    <span className="text-sm font-bold" style={{
                      color: d.score >= 85 ? '#22c55e' : d.score >= 70 ? '#f59e0b' : '#ef4444'
                    }}>{d.score}/100</span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: '#1a1a1a' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${d.score}%`,
                        background: d.score >= 85 ? '#22c55e' : d.score >= 70 ? '#f59e0b' : '#ef4444',
                      }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <a href="/passport" className="text-sm text-[#dc2626] hover:underline">
                {isZh ? '查看完整护照 →' : 'View Full Passport →'}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
