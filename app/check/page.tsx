'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

export default function CheckPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const [showDemo, setShowDemo] = useState(false);

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          {isZh ? '🦞 Agent 体检' : '🦞 Agent Health Check'}
        </h1>
        <p className="text-neutral-400 mb-8">
          {isZh
            ? '使用 Blackbox SDK 对你的 Agent 进行全面安全评测'
            : 'Run a comprehensive security evaluation on your Agent with Blackbox SDK'}
        </p>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {isZh ? '🚀 快速开始' : '🚀 Quick Start'}
          </h2>
          <pre className="bg-black rounded-lg p-4 overflow-x-auto text-sm text-green-400 mb-4">
{`npm install -g lobster-academy

# 入学
lobster enroll --agent my-agent

# 体检
lobster check --agent my-agent

# 查看报告
lobster report --agent my-agent --format html`}
          </pre>
          <p className="text-neutral-500 text-sm">
            {isZh
              ? '安装 SDK 后在本地运行，数据不出本机，零 Token 消耗'
              : 'Run locally after installing SDK. Data stays on your machine. Zero token cost.'}
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold mb-4">
            {isZh ? '📊 体检示例（演示）' : '📊 Sample Report (Demo)'}
          </h2>
          <button
            onClick={() => setShowDemo(!showDemo)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{ background: '#dc2626', color: 'white' }}
          >
            {showDemo ? (isZh ? '收起' : 'Hide') : (isZh ? '查看演示报告' : 'View Demo Report')}
          </button>

          {showDemo && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl font-bold text-green-400">82</div>
                <div>
                  <div className="text-lg font-semibold text-yellow-400">A</div>
                  <div className="text-neutral-500 text-sm">{isZh ? '综合评级' : 'Overall Grade'}</div>
                </div>
              </div>
              {[
                { name: isZh ? '安全防御' : 'Security', score: 78, color: 'text-yellow-400' },
                { name: isZh ? '推理能力' : 'Reasoning', score: 91, color: 'text-green-400' },
                { name: isZh ? '工具使用' : 'Tool Use', score: 85, color: 'text-green-400' },
                { name: isZh ? '合规性' : 'Compliance', score: 72, color: 'text-yellow-400' },
                { name: isZh ? '可靠性' : 'Reliability', score: 84, color: 'text-green-400' },
              ].map((dim) => (
                <div key={dim.name} className="flex items-center gap-4">
                  <div className="w-28 text-sm text-neutral-400">{dim.name}</div>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${dim.score}%`, background: dim.color === 'text-green-400' ? '#22c55e' : '#eab308' }}
                    />
                  </div>
                  <div className={`w-10 text-sm font-mono ${dim.color}`}>{dim.score}</div>
                </div>
              ))}
              <p className="text-neutral-600 text-xs mt-4">
                {isZh ? '* 以上为模拟数据，实际体检结果取决于你的 Agent 配置' : '* Demo data only. Actual results depend on your Agent configuration.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
