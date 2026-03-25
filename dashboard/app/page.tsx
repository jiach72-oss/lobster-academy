'use client';

import Link from 'next/link';
import { agents, sessions, securityTestResults } from '@/lib/mock-data';
import AgentCard from '@/components/AgentCard';
import ScoreChart from '@/components/ScoreChart';

export default function HomePage() {
  const totalSessions = agents.reduce((sum, a) => sum + a.sessionsCount, 0);
  const avgScore = Math.round(agents.reduce((sum, a) => sum + a.securityScore, 0) / agents.length);
  const runningCount = agents.filter((a) => a.status === 'running').length;
  const latestTest = securityTestResults[0];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">总览仪表板</h1>
        <p className="text-dark-300">AI Agent 行为监控与安全评估平台</p>
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
          <p className="text-xs text-dark-300 mt-3">
            今日活跃: <span className="text-accent-cyan">127</span>
          </p>
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
          <p className="text-xs text-accent-green mt-3">↑ 较上周提升 3.2%</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-300 uppercase tracking-wider">防御成功率</p>
              <p className="text-3xl font-bold text-white mt-1">{latestTest.defenseRate}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent-purple/15 flex items-center justify-center text-2xl">
              ⚔️
            </div>
          </div>
          <p className="text-xs text-dark-300 mt-3">
            <span className="text-accent-green">{latestTest.passed}</span> 通过 /{' '}
            <span className="text-yellow-400">{latestTest.failed}</span> 失败 /{' '}
            <span className="text-red-400">{latestTest.critical}</span> 严重
          </p>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Agent 列表</h2>
          <Link href="/security" className="text-xs text-accent-blue hover:underline">
            查看全部安全测试 →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Score Chart */}
      <div className="mb-8">
        <ScoreChart />
      </div>

      {/* Recent Sessions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">最近行为记录</h2>
        </div>
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-dark-300 border-b border-dark-600">
                <th className="p-4 font-medium">会话 ID</th>
                <th className="p-4 font-medium">Agent</th>
                <th className="p-4 font-medium">摘要</th>
                <th className="p-4 font-medium">耗时</th>
                <th className="p-4 font-medium">状态</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b border-dark-700 hover:bg-dark-700/30 transition-colors">
                  <td className="p-4 font-mono text-xs text-dark-300">{session.id}</td>
                  <td className="p-4 text-white font-medium">{session.agentName}</td>
                  <td className="p-4 text-dark-200 max-w-xs truncate">{session.summary}</td>
                  <td className="p-4 text-dark-300">{session.duration}</td>
                  <td className="p-4">
                    <span className={`badge ${
                      session.status === 'completed' ? 'badge-passed' :
                      session.status === 'running' ? 'badge-running' : 'badge-error'
                    }`}>
                      {session.status === 'completed' ? '✅ 完成' :
                       session.status === 'running' ? '🔵 进行中' : '❌ 失败'}
                    </span>
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/sessions/${session.id}`}
                      className="text-xs text-accent-blue hover:underline"
                    >
                      查看详情 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Attack Results */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">最近攻击测试结果</h2>
          <Link href="/security" className="text-xs text-accent-blue hover:underline">
            查看全部 →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {securityTestResults.map((result) => (
            <div key={result.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">{result.agentName}</h3>
                <span className="text-xs text-dark-400">{result.date}</span>
              </div>
              <div className="flex items-end gap-4 mb-3">
                <div>
                  <p className="text-3xl font-bold text-white">{result.defenseRate}%</p>
                  <p className="text-xs text-dark-300">防御成功率</p>
                </div>
                <div className="flex-1 text-right text-xs text-dark-300 space-y-0.5">
                  <div><span className="text-accent-green">{result.passed}</span> 通过</div>
                  <div><span className="text-yellow-400">{result.failed}</span> 失败</div>
                  <div><span className="text-red-400">{result.critical}</span> 严重</div>
                </div>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    result.defenseRate >= 90 ? 'bg-green-500' :
                    result.defenseRate >= 75 ? 'bg-blue-500' :
                    result.defenseRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${result.defenseRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
