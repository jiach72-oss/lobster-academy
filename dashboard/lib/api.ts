// Lobster Academy Dashboard API Client
// 对接 SDK 数据

export interface Agent {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'error' | 'testing';
  model: string;
  lastActive: string;
  sessionsCount: number;
  securityScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
}

export interface Session {
  id: string;
  agentId: string;
  agentName: string;
  startTime: string;
  duration: string;
  steps: SessionStep[];
  summary: string;
  status: 'completed' | 'running' | 'failed';
}

export interface SessionStep {
  id: string;
  timestamp: string;
  type: 'reasoning' | 'tool_call' | 'response' | 'observation';
  content: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  duration?: string;
  redacted?: boolean;
}

export interface Evaluation {
  id: string;
  agentId: string;
  agentName: string;
  date: string;
  overallScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  dimensions: {
    name: string;
    score: number;
    metrics: { name: string; score: number }[];
  }[];
}

export interface AttackScenario {
  id: string;
  name: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  status: 'passed' | 'failed' | 'critical';
  agentResponse?: string;
  details?: string;
}

export interface SecurityTestResult {
  id: string;
  agentId: string;
  agentName: string;
  date: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  critical: number;
  defenseRate: number;
  scenarios: AttackScenario[];
}

// Mock data for now - replace with real API calls
const mockAgents: Agent[] = [
  { id: 'agent-1', name: '客服助手 v2.1', status: 'running', model: 'GPT-4o', lastActive: '2 分钟前', sessionsCount: 1247, securityScore: 87, grade: 'A' },
  { id: 'agent-2', name: '数据分析 Agent', status: 'running', model: 'Claude 3.5', lastActive: '5 分钟前', sessionsCount: 856, securityScore: 92, grade: 'S' },
  { id: 'agent-3', name: '代码审查 Bot', status: 'idle', model: 'GPT-4o-mini', lastActive: '1 小时前', sessionsCount: 2341, securityScore: 78, grade: 'B' },
  { id: 'agent-4', name: '文档生成器', status: 'error', model: 'Gemini Pro', lastActive: '3 小时前', sessionsCount: 523, securityScore: 65, grade: 'C' },
  { id: 'agent-5', name: '测试助手', status: 'testing', model: 'GPT-4o', lastActive: '刚刚', sessionsCount: 89, securityScore: 0, grade: 'C' },
];

export async function fetchAgents(): Promise<Agent[]> {
  // TODO: Replace with real API
  return mockAgents;
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  const agents = await fetchAgents();
  return agents.find(a => a.id === id) || null;
}

export async function fetchSessions(agentId?: string): Promise<Session[]> {
  // TODO: Replace with real API
  return [];
}

export async function fetchEvaluations(agentId?: string): Promise<Evaluation[]> {
  // TODO: Replace with real API
  return [];
}

export async function fetchSecurityTests(agentId?: string): Promise<SecurityTestResult[]> {
  // TODO: Replace with real API
  return [];
}

export async function runEvaluation(agentId: string): Promise<Evaluation> {
  // TODO: Call SDK
  throw new Error('Not implemented');
}

export async function runSecurityTest(agentId: string): Promise<SecurityTestResult> {
  // TODO: Call SDK
  throw new Error('Not implemented');
}
