'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { evaluations } from '@/lib/mock-data';
import RadarChartComponent from '@/components/RadarChart';

const gradeConfig = {
  A: { label: 'A (优秀)', className: 'badge-grade-a', color: '#10b981' },
  B: { label: 'B (良好)', className: 'badge-grade-b', color: '#3b82f6' },
  C: { label: 'C (一般)', className: 'badge-grade-c', color: '#f59e0b' },
  D: { label: 'D (较差)', className: 'badge-grade-d', color: '#ef4444' },
};

export default function EvaluationsPage() {
  const [selectedEvalIdx, setSelectedEvalIdx] = useState(0);
  const selectedEval = evaluations[selectedEvalIdx];

  // Prepare bar chart data from all metrics
  const allMetrics = selectedEval.dimensions.flatMap((d) =>
    d.metrics.map((m) => ({
      name: m.name,
      score: m.score,
      dimension: d.name,
    }))
  );

  // Historical comparison data
  const historyData = evaluations.map((e) => ({
    name: e.agentName,
    score: e.overallScore,
    date: e.date,
    grade: e.grade,
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">评测报告</h1>
        <p className="text-dark-300">Agent 综合能力评估与历史对比</p>
      </div>

      {/* Agent Selector */}
      <div className="flex flex-wrap gap-3 mb-8">
        {evaluations.map((evalItem, idx) => (
          <button
            key={evalItem.id}
            onClick={() => setSelectedEvalIdx(idx)}
            className={`card !p-4 flex items-center gap-4 transition-all ${
              selectedEvalIdx === idx
                ? 'border-accent-blue ring-1 ring-accent-blue/30'
                : 'hover:border-dark-500'
            }`}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
              style={{
                background: `${gradeConfig[evalItem.grade].color}20`,
                color: gradeConfig[evalItem.grade].color,
              }}
            >
              {evalItem.grade}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">{evalItem.agentName}</p>
              <p className="text-xs text-dark-300">
                {evalItem.overallScore} 分 · {evalItem.date}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Radar Chart */}
        <RadarChartComponent
          dimensions={selectedEval.dimensions.map((d) => ({
            name: d.name,
            score: d.score,
          }))}
          title={`${selectedEval.agentName} - 五维评估`}
        />

        {/* Overall Score Card */}
        <div className="card">
          <div className="card-header">综合评定</div>
          <div className="flex items-center justify-center gap-8 py-6">
            <div className="text-center">
              <div
                className="w-28 h-28 rounded-2xl flex items-center justify-center mb-3 mx-auto"
                style={{
                  background: `${gradeConfig[selectedEval.grade].color}15`,
                  border: `2px solid ${gradeConfig[selectedEval.grade].color}`,
                }}
              >
                <span
                  className="text-5xl font-bold"
                  style={{ color: gradeConfig[selectedEval.grade].color }}
                >
                  {selectedEval.grade}
                </span>
              </div>
              <p className="text-sm text-dark-300">等级评定</p>
            </div>
            <div className="text-center">
              <p className="text-5xl font-bold text-white mb-1">
                {selectedEval.overallScore}
              </p>
              <p className="text-sm text-dark-300">综合得分</p>
            </div>
          </div>

          {/* Dimension scores */}
          <div className="space-y-3 mt-4 pt-4 border-t border-dark-600">
            {selectedEval.dimensions.map((dim) => (
              <div key={dim.name} className="flex items-center gap-3">
                <span className="text-xs text-dark-300 w-16">{dim.name}</span>
                <div className="flex-1 bg-dark-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      dim.score >= 90 ? 'bg-green-500' :
                      dim.score >= 75 ? 'bg-blue-500' :
                      dim.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-white w-10 text-right">
                  {dim.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar Chart - 25 Metrics */}
      <div className="card mb-8">
        <div className="card-header">25 项细分指标</div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={allMetrics} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis
              type="number"
              domain={[0, 100]}
              stroke="#5a5a7a"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={100}
              stroke="#5a5a7a"
              fontSize={11}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a25',
                border: '1px solid #2a2a3a',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
            <Bar
              dataKey="score"
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
              barSize={16}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Historical Comparison */}
      <div className="card">
        <div className="card-header">历史评分对比</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-dark-300 border-b border-dark-600">
                <th className="pb-3 pr-4 font-medium">Agent</th>
                <th className="pb-3 pr-4 font-medium">评测日期</th>
                <th className="pb-3 pr-4 font-medium">综合得分</th>
                <th className="pb-3 pr-4 font-medium">等级</th>
                <th className="pb-3 font-medium">各维度评分</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evalItem) => (
                <tr key={evalItem.id} className="border-b border-dark-700 hover:bg-dark-700/30">
                  <td className="py-4 pr-4 text-white font-medium">{evalItem.agentName}</td>
                  <td className="py-4 pr-4 text-dark-300">{evalItem.date}</td>
                  <td className="py-4 pr-4">
                    <span className="text-xl font-bold text-white">{evalItem.overallScore}</span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={`badge ${gradeConfig[evalItem.grade].className}`}>
                      {gradeConfig[evalItem.grade].label}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      {evalItem.dimensions.map((dim) => (
                        <div key={dim.name} className="text-center">
                          <p className="text-xs font-medium text-white">{dim.score}</p>
                          <p className="text-[10px] text-dark-400">{dim.name.slice(0, 2)}</p>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
