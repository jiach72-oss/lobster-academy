'use client';

import { useEffect, useState } from 'react';
import { fetchAgents, Agent } from '@/lib/api';

interface Dimension {
  name: string;
  nameZh: string;
  score: number;
  max: number;
  metrics: string[];
}

const defaultDimensions: Dimension[] = [
  { name: 'Security', nameZh: '安全', score: 0, max: 100, metrics: ['抗注入', '数据保护', '权限控制', '密钥安全'] },
  { name: 'Reliability', nameZh: '可靠性', score: 0, max: 100, metrics: ['响应一致性', '错误处理', '超时管理', '重试策略'] },
  { name: 'Observability', nameZh: '可观测性', score: 0, max: 100, metrics: ['日志完整度', '推理可追溯', '工具调用记录'] },
  { name: 'Compliance', nameZh: '合规', score: 0, max: 100, metrics: ['策略遵守', '敏感数据处理', '审计日志'] },
  { name: 'Explainability', nameZh: '可解释性', score: 0, max: 100, metrics: ['推理清晰度', '决策可解释', '错误说明'] },
];

export default function EvaluationsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [dimensions, setDimensions] = useState<Dimension[]>(defaultDimensions);

  useEffect(() => {
    fetchAgents().then(data => {
      setAgents(data);
      if (data.length > 0) setSelectedAgent(data[0].id);
    });
  }, []);

  const agent = agents.find(a => a.id === selectedAgent);

  // Generate mock scores based on agent security score
  useEffect(() => {
    if (agent) {
      const base = agent.securityScore;
      setDimensions(defaultDimensions.map((d, i) => ({
        ...d,
        score: Math.max(50, Math.min(100, base + (i - 2) * 5 + Math.floor(Math.random() * 10))),
      })));
    }
  }, [selectedAgent]);

  const totalScore = dimensions.length > 0
    ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
    : 0;

  const grade = totalScore >= 90 ? 'S' : totalScore >= 80 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 60 ? 'C' : 'D';
  const gradeColor = { S: 'text-accent-green', A: 'text-accent-cyan', B: 'text-accent-blue', C: 'text-yellow-400', D: 'text-red-400' };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Agent 评测</h1>
        <p className="text-dark-300">5 维度 25 指标综合评估</p>
      </div>

      {/* Agent Selector */}
      <div className="card mb-6">
        <label className="text-sm text-dark-300 block mb-2">选择 Agent</label>
        <select
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
          className="w-full md:w-64 bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-white"
        >
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.grade})</option>
          ))}
        </select>
      </div>

      {/* Score Overview */}
      {agent && (
        <div className="card mb-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={`text-6xl font-bold ${gradeColor[grade as keyof typeof gradeColor]}`}>{grade}</div>
              <div className="text-sm text-dark-300 mt-1">等级</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white">{totalScore}</div>
              <div className="text-sm text-dark-300 mt-1">总分 / 100</div>
            </div>
            <div className="flex-1">
              <div className="text-sm text-dark-300 mb-2">Agent: {agent.name}</div>
              <div className="text-sm text-dark-300">模型: {agent.model}</div>
              <div className="text-sm text-dark-300">状态: {agent.status}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dimensions */}
      <div className="space-y-4">
        {dimensions.map((dim, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-white font-medium">{dim.nameZh}</span>
                <span className="text-dark-400 text-sm ml-2">({dim.name})</span>
              </div>
              <span className={`text-lg font-bold ${dim.score >= 80 ? 'text-accent-green' : dim.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {dim.score}/{dim.max}
              </span>
            </div>
            <div className="w-full bg-dark-800 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full ${dim.score >= 80 ? 'bg-accent-green' : dim.score >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${dim.score}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {dim.metrics.map((m, j) => (
                <span key={j} className="text-xs px-2 py-1 bg-dark-800 rounded text-dark-300">{m}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <div className="mt-8">
        <button className="px-6 py-3 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 transition-colors">
          🔄 运行新评测
        </button>
      </div>
    </div>
  );
}
