'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAgents, Agent } from '@/lib/api';
import AgentCard from '@/components/AgentCard';

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents().then(data => {
      setAgents(data);
      setLoading(false);
    });
  }, []);

  const totalSessions = agents.reduce((sum, a) => sum + a.sessionsCount, 0);
  const avgScore = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.securityScore, 0) / agents.length)
    : 0;
  const runningCount = agents.filter(a => a.status === 'running').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-300">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">总览仪表板</h1>
        <p className="text-dark-300">AI Agent 安全评估平台</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-300 uppercase tracking-wider">Agent 总数</p>
              <p className="text-3xl font-bold text-white mt-1">{agents.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent-blue/15 flex items-center justify-center text-2xl">
              🤖
            </div>
          </div>
          <p className="text-xs text-dark-300 mt-3">
            <span className="text-accent-green">{runningCount}</span> 运行中
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-300 uppercase tracking-wider">总会话数</p>
              <p className="text-3xl font-bold text-white mt-1">{totalSessions}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent-cyan/15 flex items-center justify-center text-2xl">
              💬
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-300 uppercase tracking-wider">平均安全评分</p>
              <p className="text-3xl font-bold text-white mt-1">{avgScore}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent-green/15 flex items-center justify-center text-2xl">
              🛡️
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-300 uppercase tracking-wider">评测维度</p>
              <p className="text-3xl font-bold text-white mt-1">5</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent-purple/15 flex items-center justify-center text-2xl">
              📊
            </div>
          </div>
        </div>
      </div>

      {/* Agent List */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Agent 列表</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
