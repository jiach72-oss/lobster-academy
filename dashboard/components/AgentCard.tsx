'use client';

import Link from 'next/link';
import { Agent } from '@/lib/mock-data';

interface Props {
  agent: Agent;
}

const statusConfig = {
  running: { label: '运行中', className: 'badge-running', dot: 'bg-blue-500 animate-pulse' },
  idle: { label: '空闲', className: 'badge-idle', dot: 'bg-slate-500' },
  error: { label: '异常', className: 'badge-error', dot: 'bg-red-500 animate-pulse' },
  testing: { label: '测试中', className: 'badge-testing', dot: 'bg-yellow-500 animate-pulse' },
};

export default function AgentCard({ agent }: Props) {
  const config = statusConfig[agent.status];
  const scoreColor = agent.securityScore >= 90
    ? 'text-green-400'
    : agent.securityScore >= 75
    ? 'text-blue-400'
    : agent.securityScore >= 60
    ? 'text-yellow-400'
    : 'text-red-400';

  return (
    <div className="card hover:border-dark-500 transition-colors group">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-base group-hover:text-accent-blue transition-colors">
            {agent.name}
          </h3>
          <p className="text-xs text-dark-300 mt-0.5">{agent.model}</p>
        </div>
        <span className={`badge ${config.className}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
          {config.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className={`text-xl font-bold ${scoreColor}`}>
            {agent.securityScore}
          </p>
          <p className="text-xs text-dark-400">安全评分</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-white">{agent.sessionsCount}</p>
          <p className="text-xs text-dark-400">会话数</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-dark-200">
            {new Date(agent.lastActive).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs text-dark-400">最后活跃</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-4">
        <div className="w-full bg-dark-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              agent.securityScore >= 90
                ? 'bg-green-500'
                : agent.securityScore >= 75
                ? 'bg-blue-500'
                : agent.securityScore >= 60
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${agent.securityScore}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Link
          href={`/sessions/sess-001`}
          className="flex-1 text-center text-xs py-2 rounded-lg bg-dark-700 text-dark-200 hover:bg-dark-600 hover:text-white transition-colors"
        >
          查看会话
        </Link>
        <Link
          href="/security"
          className="flex-1 text-center text-xs py-2 rounded-lg bg-dark-700 text-dark-200 hover:bg-dark-600 hover:text-white transition-colors"
        >
          安全测试
        </Link>
      </div>
    </div>
  );
}
