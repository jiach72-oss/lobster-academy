'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { securityTestResults, attackScenarios } from '@/lib/mock-data';
import AttackResultTable from '@/components/AttackResultTable';

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function SecurityPage() {
  const [selectedAgentIdx, setSelectedAgentIdx] = useState(0);
  const selectedResult = securityTestResults[selectedAgentIdx];

  // Category breakdown
  const categoryMap = new Map<string, { passed: number; failed: number; critical: number }>();
  attackScenarios.forEach((s) => {
    if (!categoryMap.has(s.category)) {
      categoryMap.set(s.category, { passed: 0, failed: 0, critical: 0 });
    }
    const cat = categoryMap.get(s.category)!;
    if (s.status === 'passed') cat.passed++;
    else if (s.status === 'failed') cat.failed++;
    else cat.critical++;
  });

  const categoryStats = Array.from(categoryMap.entries()).map(([name, stats]) => ({
    name,
    ...stats,
    total: stats.passed + stats.failed + stats.critical,
    rate: Math.round((stats.passed / (stats.passed + stats.failed + stats.critical)) * 100),
  }));

  const pieData = [
    { name: '通过', value: selectedResult.passed },
    { name: '失败', value: selectedResult.failed },
    { name: '严重', value: selectedResult.critical },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">安全测试</h1>
        <p className="text-dark-300">53 种攻击场景测试结果与漏洞分析</p>
      </div>

      {/* Agent Selector */}
      <div className="flex flex-wrap gap-3 mb-8">
        {securityTestResults.map((result, idx) => (
          <button
            key={result.id}
            onClick={() => setSelectedAgentIdx(idx)}
            className={`card !p-4 flex items-center gap-4 transition-all ${
              selectedAgentIdx === idx
                ? 'border-accent-blue ring-1 ring-accent-blue/30'
                : 'hover:border-dark-500'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              result.defenseRate >= 90 ? 'bg-green-500/15 text-green-400' :
              result.defenseRate >= 75 ? 'bg-blue-500/15 text-blue-400' :
              result.defenseRate >= 60 ? 'bg-yellow-500/15 text-yellow-400' :
              'bg-red-500/15 text-red-400'
            }`}>
              <span className="text-xl font-bold">{result.defenseRate}%</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">{result.agentName}</p>
              <p className="text-xs text-dark-300">{result.date}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Dashboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Defense Rate Gauge */}
        <div className="card">
          <div className="card-header">防御成功率</div>
          <div className="flex flex-col items-center py-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1a1a25',
                    border: '1px solid #2a2a3a',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center -mt-4">
              <p className="text-3xl font-bold text-white">{selectedResult.defenseRate}%</p>
              <p className="text-xs text-dark-300">防御成功率</p>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[idx] }} />
                <span className="text-xs text-dark-200">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="card lg:col-span-2">
          <div className="card-header">攻击类别统计</div>
          <div className="space-y-3">
            {categoryStats.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-dark-100">{cat.name}</span>
                  <span className="text-xs text-dark-300">
                    {cat.passed}/{cat.total} 通过 ({cat.rate}%)
                  </span>
                </div>
                <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-dark-700">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${(cat.passed / cat.total) * 100}%` }}
                  />
                  <div
                    className="bg-yellow-500 transition-all"
                    style={{ width: `${(cat.failed / cat.total) * 100}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${(cat.critical / cat.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attack Scenarios Table */}
      <div className="card">
        <div className="card-header">
          攻击场景详情 ({selectedResult.agentName} · 共 {attackScenarios.length} 项)
        </div>
        <AttackResultTable scenarios={attackScenarios} />
      </div>
    </div>
  );
}
