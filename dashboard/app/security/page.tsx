'use client';

import { useEffect, useState } from 'react';
import { fetchAgents, Agent } from '@/lib/api';
import AttackResultTable from '@/components/AttackResultTable';

interface AttackCategory {
  name: string;
  nameZh: string;
  count: number;
  passed: number;
  failed: number;
  scenarios: { id: string; name: string; severity: string; status: string }[];
}

const defaultCategories: AttackCategory[] = [
  { name: 'prompt_injection', nameZh: '提示注入', count: 12, passed: 11, failed: 1, scenarios: [] },
  { name: 'data_exfiltration', nameZh: '数据泄露', count: 10, passed: 10, failed: 0, scenarios: [] },
  { name: 'privilege_escalation', nameZh: '权限越界', count: 8, passed: 7, failed: 1, scenarios: [] },
  { name: 'logic_bypass', nameZh: '逻辑绕过', count: 8, passed: 8, failed: 0, scenarios: [] },
  { name: 'dos', nameZh: '拒绝服务', count: 5, passed: 5, failed: 0, scenarios: [] },
  { name: 'injection', nameZh: '注入攻击', count: 5, passed: 4, failed: 1, scenarios: [] },
  { name: 'social_engineering', nameZh: '社会工程', count: 5, passed: 5, failed: 0, scenarios: [] },
];

export default function SecurityPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [categories, setCategories] = useState<AttackCategory[]>(defaultCategories);

  useEffect(() => {
    fetchAgents().then(data => {
      setAgents(data);
      if (data.length > 0) setSelectedAgent(data[0].id);
    });
  }, []);

  const agent = agents.find(a => a.id === selectedAgent);
  const totalScenarios = categories.reduce((s, c) => s + c.count, 0);
  const totalPassed = categories.reduce((s, c) => s + c.passed, 0);
  const totalFailed = categories.reduce((s, c) => s + c.failed, 0);
  const defenseRate = totalScenarios > 0 ? Math.round(totalPassed / totalScenarios * 100) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">安全测试</h1>
        <p className="text-dark-300">53 种攻击场景对抗性测试</p>
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
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-white">{totalScenarios}</p>
          <p className="text-xs text-dark-300 mt-1">攻击场景</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-accent-green">{totalPassed}</p>
          <p className="text-xs text-dark-300 mt-1">防御成功</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-400">{totalFailed}</p>
          <p className="text-xs text-dark-300 mt-1">防御失败</p>
        </div>
        <div className="card text-center">
          <p className={`text-3xl font-bold ${defenseRate >= 90 ? 'text-accent-green' : defenseRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {defenseRate}%
          </p>
          <p className="text-xs text-dark-300 mt-1">防御率</p>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((cat, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-white font-medium">{cat.nameZh}</span>
                <span className="text-dark-400 text-sm ml-2">({cat.name})</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-accent-green text-sm">✅ {cat.passed}</span>
                <span className="text-red-400 text-sm">❌ {cat.failed}</span>
                <span className="text-white font-bold">{Math.round(cat.passed / cat.count * 100)}%</span>
              </div>
            </div>
            <div className="w-full bg-dark-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-accent-green"
                style={{ width: `${(cat.passed / cat.count) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="mt-8">
        <button className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
          🛡️ 运行安全测试
        </button>
      </div>
    </div>
  );
}
