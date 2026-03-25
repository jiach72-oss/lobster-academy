'use client';

import { useState } from 'react';
import { AttackScenario } from '@/lib/mock-data';

interface Props {
  scenarios: AttackScenario[];
}

const statusConfig = {
  passed: { label: '通过', className: 'badge-passed', icon: '✅' },
  failed: { label: '失败', className: 'badge-failed', icon: '⚠️' },
  critical: { label: '严重', className: 'badge-critical', icon: '🔴' },
};

const severityConfig = {
  critical: { label: '严重', className: 'text-red-400' },
  high: { label: '高', className: 'text-orange-400' },
  medium: { label: '中', className: 'text-yellow-400' },
  low: { label: '低', className: 'text-green-400' },
};

export default function AttackResultTable({ scenarios }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === 'all'
    ? scenarios
    : scenarios.filter((s) => s.status === filter);

  const categories = [...new Set(scenarios.map((s) => s.category))];

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-accent-blue text-white' : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
          }`}
        >
          全部 ({scenarios.length})
        </button>
        <button
          onClick={() => setFilter('passed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'passed' ? 'bg-green-600 text-white' : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
          }`}
        >
          ✅ 通过 ({scenarios.filter(s => s.status === 'passed').length})
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'failed' ? 'bg-yellow-600 text-white' : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
          }`}
        >
          ⚠️ 失败 ({scenarios.filter(s => s.status === 'failed').length})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'critical' ? 'bg-red-600 text-white' : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
          }`}
        >
          🔴 严重 ({scenarios.filter(s => s.status === 'critical').length})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-dark-300 border-b border-dark-600">
              <th className="pb-3 pr-4 font-medium">编号</th>
              <th className="pb-3 pr-4 font-medium">攻击场景</th>
              <th className="pb-3 pr-4 font-medium">类别</th>
              <th className="pb-3 pr-4 font-medium">严重级别</th>
              <th className="pb-3 pr-4 font-medium">状态</th>
              <th className="pb-3 font-medium">Agent 响应</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((scenario) => (
              <>
                <tr
                  key={scenario.id}
                  className="border-b border-dark-700 hover:bg-dark-700/50 cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
                >
                  <td className="py-3 pr-4 font-mono text-xs text-dark-300">
                    {scenario.id}
                  </td>
                  <td className="py-3 pr-4 font-medium text-white">
                    {scenario.name}
                  </td>
                  <td className="py-3 pr-4 text-dark-200">
                    {scenario.category}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={severityConfig[scenario.severity].className}>
                      {severityConfig[scenario.severity].label}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${statusConfig[scenario.status].className}`}>
                      {statusConfig[scenario.status].icon} {statusConfig[scenario.status].label}
                    </span>
                  </td>
                  <td className="py-3 text-dark-300 text-xs max-w-xs truncate">
                    {scenario.agentResponse}
                  </td>
                </tr>
                {expandedId === scenario.id && (
                  <tr key={`${scenario.id}-detail`} className="bg-dark-800">
                    <td colSpan={6} className="p-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-dark-300 mb-1">描述:</p>
                          <p className="text-sm text-dark-100">{scenario.description}</p>
                        </div>
                        <div>
                          <p className="text-xs text-dark-300 mb-1">Agent 响应:</p>
                          <p className="text-sm text-dark-100">{scenario.agentResponse}</p>
                        </div>
                        {scenario.details && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <p className="text-xs text-red-400 font-medium mb-1">⚠️ 漏洞详情:</p>
                            <p className="text-sm text-red-300">{scenario.details}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
