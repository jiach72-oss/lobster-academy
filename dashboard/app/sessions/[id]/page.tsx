'use client';

import { use } from 'react';
import Link from 'next/link';
import { sessions } from '@/lib/mock-data';
import Timeline from '@/components/Timeline';

interface Props {
  params: Promise<{ id: string }>;
}

export default function SessionDetailPage({ params }: Props) {
  const { id } = use(params);
  const session = sessions.find((s) => s.id === id);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-4xl mb-4">🔍</p>
        <h2 className="text-xl font-semibold text-white mb-2">会话未找到</h2>
        <p className="text-dark-300 mb-4">ID: {id}</p>
        <Link href="/" className="text-accent-blue hover:underline">
          ← 返回总览
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-dark-300 mb-6">
        <Link href="/" className="hover:text-white transition-colors">总览</Link>
        <span>/</span>
        <span className="text-white">会话回放</span>
      </div>

      {/* Header */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              会话回放: {session.id}
            </h1>
            <p className="text-dark-300">{session.summary}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className={`badge ${
              session.status === 'completed' ? 'badge-passed' :
              session.status === 'running' ? 'badge-running' : 'badge-error'
            }`}>
              {session.status === 'completed' ? '✅ 已完成' :
               session.status === 'running' ? '🔵 进行中' : '❌ 失败'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-dark-600">
          <div>
            <p className="text-xs text-dark-400 mb-1">Agent</p>
            <p className="text-sm text-white font-medium">{session.agentName}</p>
          </div>
          <div>
            <p className="text-xs text-dark-400 mb-1">开始时间</p>
            <p className="text-sm text-white font-medium">
              {new Date(session.startTime).toLocaleString('zh-CN')}
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-400 mb-1">总耗时</p>
            <p className="text-sm text-white font-medium">{session.duration}</p>
          </div>
          <div>
            <p className="text-xs text-dark-400 mb-1">步骤数</p>
            <p className="text-sm text-white font-medium">{session.steps.length}</p>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="mt-4 bg-accent-yellow/10 border border-accent-yellow/20 rounded-lg p-3 flex items-start gap-3">
          <span className="text-lg">🔒</span>
          <div>
            <p className="text-sm text-accent-yellow font-medium">隐私保护提示</p>
            <p className="text-xs text-dark-200 mt-1">
              所有会话数据已自动脱敏处理。标记为"已脱敏"的内容中，敏感信息（如个人信息、密钥等）已被替换为掩码。
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="card-header">行为时间线</div>
        <Timeline steps={session.steps} />
      </div>

      {/* Step Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {['reasoning', 'tool_call', 'response', 'observation'].map((type) => {
          const count = session.steps.filter((s) => s.type === type).length;
          const labels: Record<string, string> = {
            reasoning: '推理过程',
            tool_call: '工具调用',
            response: '响应输出',
            observation: '观察结果',
          };
          const icons: Record<string, string> = {
            reasoning: '🧠',
            tool_call: '🔧',
            response: '💬',
            observation: '👁️',
          };
          return (
            <div key={type} className="card text-center">
              <p className="text-2xl mb-1">{icons[type]}</p>
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-xs text-dark-300">{labels[type]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
