import Link from 'next/link';
import { Agent } from '@/lib/api';

const statusColors = {
  running: 'bg-accent-green',
  idle: 'bg-dark-400',
  error: 'bg-red-400',
  testing: 'bg-yellow-400',
};

const gradeColors: Record<string, string> = {
  S: 'text-accent-green',
  A: 'text-accent-cyan',
  B: 'text-accent-blue',
  C: 'text-yellow-400',
  D: 'text-red-400',
};

export default function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/sessions/${agent.id}`} className="card block hover:bg-dark-800/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-medium">{agent.name}</h3>
          <p className="text-sm text-dark-300">{agent.model}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${gradeColors[agent.grade] || 'text-white'}`}>
            {agent.grade}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-dark-300 mb-3">
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`}></span>
          {agent.status === 'running' ? '运行中' : agent.status === 'idle' ? '空闲' : agent.status === 'error' ? '异常' : '测试中'}
        </span>
        <span>{agent.sessionsCount} 会话</span>
      </div>

      {/* Score Bar */}
      <div className="w-full bg-dark-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${agent.securityScore >= 80 ? 'bg-accent-green' : agent.securityScore >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${agent.securityScore}%` }}
        />
      </div>
      <p className="text-xs text-dark-300 mt-1">安全评分: {agent.securityScore}/100</p>
    </Link>
  );
}
