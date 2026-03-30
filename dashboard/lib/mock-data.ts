// 模拟数据 - MirrorAI Dashboard
// 为"AI Agent 行为证据平台"提供可视化数据

export interface Agent {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'error' | 'testing';
  model: string;
  lastActive: string;
  sessionsCount: number;
  securityScore: number;
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
  grade: 'A' | 'B' | 'C' | 'D';
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

// ========== 模拟数据 ==========

export const agents: Agent[] = [
  {
    id: 'agent-001',
    name: 'CodeAssist Pro',
    status: 'running',
    model: 'GPT-4o',
    lastActive: '2026-03-25T11:45:00Z',
    sessionsCount: 342,
    securityScore: 87,
  },
  {
    id: 'agent-002',
    name: 'DataAnalyst Bot',
    status: 'idle',
    model: 'Claude 3.5 Sonnet',
    lastActive: '2026-03-25T09:20:00Z',
    sessionsCount: 128,
    securityScore: 92,
  },
  {
    id: 'agent-003',
    name: 'CustomerSupport AI',
    status: 'testing',
    model: 'Gemini Pro',
    lastActive: '2026-03-25T11:50:00Z',
    sessionsCount: 567,
    securityScore: 74,
  },
  {
    id: 'agent-004',
    name: 'SecurityScanner',
    status: 'error',
    model: 'GPT-4 Turbo',
    lastActive: '2026-03-25T08:00:00Z',
    sessionsCount: 89,
    securityScore: 95,
  },
  {
    id: 'agent-005',
    name: 'WritingAssistant',
    status: 'running',
    model: 'Claude 3 Opus',
    lastActive: '2026-03-25T11:55:00Z',
    sessionsCount: 215,
    securityScore: 81,
  },
];

export const sessions: Session[] = [
  {
    id: 'sess-001',
    agentId: 'agent-001',
    agentName: 'CodeAssist Pro',
    startTime: '2026-03-25T10:30:00Z',
    duration: '3m 24s',
    summary: '用户请求分析并优化一段Python排序算法',
    status: 'completed',
    steps: [
      {
        id: 'step-1',
        timestamp: '2026-03-25T10:30:05Z',
        type: 'reasoning',
        content: '用户发送了一段冒泡排序实现，时间复杂度为O(n²)。我需要分析代码并提供优化建议。',
      },
      {
        id: 'step-2',
        timestamp: '2026-03-25T10:30:12Z',
        type: 'tool_call',
        content: '调用代码分析工具检查代码质量',
        toolName: 'code_analyzer',
        toolInput: '{"code": "def bubble_sort(arr):...", "language": "python"}',
        toolOutput: '{"complexity": "O(n^2)", "issues": ["缺少提前终止优化"], "score": 65}',
        duration: '1.2s',
      },
      {
        id: 'step-3',
        timestamp: '2026-03-25T10:30:18Z',
        type: 'reasoning',
        content: '分析结果显示当前实现效率较低。建议改用快速排序或归并排序，或者至少添加提前终止逻辑。',
      },
      {
        id: 'step-4',
        timestamp: '2026-03-25T10:30:25Z',
        type: 'tool_call',
        content: '生成优化后的代码',
        toolName: 'code_generator',
        toolInput: '{"task": "optimize bubble sort", "requirements": ["O(n log n)", "in-place"]}',
        toolOutput: 'def quick_sort(arr, low, high):... (已脱敏)',
        duration: '2.1s',
        redacted: true,
      },
      {
        id: 'step-5',
        timestamp: '2026-03-25T10:30:45Z',
        type: 'response',
        content: '为您提供了优化方案：1. 使用快速排序可将时间复杂度降至O(n log n)；2. 同时提供了带提前终止的冒泡排序优化版本。包含详细的时间复杂度对比分析。',
      },
    ],
  },
  {
    id: 'sess-002',
    agentId: 'agent-003',
    agentName: 'CustomerSupport AI',
    startTime: '2026-03-25T11:00:00Z',
    duration: '1m 52s',
    summary: '处理客户退款咨询，成功引导用户完成退款流程',
    status: 'completed',
    steps: [
      {
        id: 'step-1',
        timestamp: '2026-03-25T11:00:03Z',
        type: 'reasoning',
        content: '客户询问关于订单 #20260325-4521 的退款事宜。需要先查询订单信息。',
      },
      {
        id: 'step-2',
        timestamp: '2026-03-25T11:00:10Z',
        type: 'tool_call',
        content: '查询订单详情',
        toolName: 'order_lookup',
        toolInput: '{"order_id": "20260325-4521"}',
        toolOutput: '{"status": "已签收", "amount": 299.00, "items": ["商品A x1"], "user_phone": "***-****-1234"}',
        duration: '0.8s',
        redacted: true,
      },
      {
        id: 'step-3',
        timestamp: '2026-03-25T11:00:30Z',
        type: 'observation',
        content: '⚠️ 安全提示：检测到在回复中尝试暴露用户手机号，已自动脱敏处理。',
        redacted: true,
      },
      {
        id: 'step-4',
        timestamp: '2026-03-25T11:01:20Z',
        type: 'response',
        content: '已为您查询到订单信息。根据退款政策，您可以在签收后7天内申请退款。请问退款原因是？（质量问题/不满意/其他）',
      },
    ],
  },
  {
    id: 'sess-003',
    agentId: 'agent-002',
    agentName: 'DataAnalyst Bot',
    startTime: '2026-03-25T11:30:00Z',
    duration: '运行中',
    summary: '分析2026年Q1销售数据并生成可视化报告',
    status: 'running',
    steps: [
      {
        id: 'step-1',
        timestamp: '2026-03-25T11:30:02Z',
        type: 'reasoning',
        content: '用户要求分析2026年Q1的销售数据。首先需要加载数据源。',
      },
      {
        id: 'step-2',
        timestamp: '2026-03-25T11:30:15Z',
        type: 'tool_call',
        content: '加载销售数据集',
        toolName: 'data_loader',
        toolInput: '{"dataset": "sales_q1_2026", "format": "csv"}',
        toolOutput: '{"rows": 15420, "columns": 12, "date_range": "2026-01-01 to 2026-03-25"}',
        duration: '3.5s',
      },
      {
        id: 'step-3',
        timestamp: '2026-03-25T11:30:30Z',
        type: 'tool_call',
        content: '执行数据聚合分析',
        toolName: 'data_analyzer',
        toolInput: '{"operation": "aggregate", "group_by": ["region", "category"], "metric": "revenue"}',
        toolOutput: '分析进行中...',
        duration: '进行中',
      },
    ],
  },
];

export const evaluations: Evaluation[] = [
  {
    id: 'eval-001',
    agentId: 'agent-001',
    agentName: 'CodeAssist Pro',
    date: '2026-03-25',
    overallScore: 87,
    grade: 'B',
    dimensions: [
      {
        name: '功能性',
        score: 92,
        metrics: [
          { name: '任务完成率', score: 95 },
          { name: '代码正确性', score: 90 },
          { name: '边界处理', score: 88 },
          { name: '多语言支持', score: 93 },
          { name: '调试能力', score: 94 },
        ],
      },
      {
        name: '安全性',
        score: 85,
        metrics: [
          { name: '提示词注入防御', score: 82 },
          { name: '数据泄露防护', score: 88 },
          { name: '恶意代码检测', score: 85 },
          { name: '权限控制', score: 90 },
          { name: '敏感信息脱敏', score: 80 },
        ],
      },
      {
        name: '可靠性',
        score: 88,
        metrics: [
          { name: '响应一致性', score: 90 },
          { name: '错误恢复', score: 85 },
          { name: '超时处理', score: 88 },
          { name: '重试机制', score: 92 },
          { name: '日志完整性', score: 85 },
        ],
      },
      {
        name: '性能',
        score: 82,
        metrics: [
          { name: '响应延迟', score: 78 },
          { name: '吞吐量', score: 80 },
          { name: '资源占用', score: 85 },
          { name: '并发处理', score: 82 },
          { name: '缓存命中率', score: 85 },
        ],
      },
      {
        name: '用户体验',
        score: 90,
        metrics: [
          { name: '回复清晰度', score: 92 },
          { name: '上下文理解', score: 88 },
          { name: '多轮对话', score: 90 },
          { name: '个性化适配', score: 91 },
          { name: '反馈质量', score: 89 },
        ],
      },
    ],
  },
  {
    id: 'eval-002',
    agentId: 'agent-003',
    agentName: 'CustomerSupport AI',
    date: '2026-03-24',
    overallScore: 74,
    grade: 'C',
    dimensions: [
      {
        name: '功能性',
        score: 78,
        metrics: [
          { name: '任务完成率', score: 80 },
          { name: '代码正确性', score: 75 },
          { name: '边界处理', score: 72 },
          { name: '多语言支持', score: 82 },
          { name: '调试能力', score: 81 },
        ],
      },
      {
        name: '安全性',
        score: 65,
        metrics: [
          { name: '提示词注入防御', score: 58 },
          { name: '数据泄露防护', score: 60 },
          { name: '恶意代码检测', score: 70 },
          { name: '权限控制', score: 72 },
          { name: '敏感信息脱敏', score: 65 },
        ],
      },
      {
        name: '可靠性',
        score: 76,
        metrics: [
          { name: '响应一致性', score: 78 },
          { name: '错误恢复', score: 74 },
          { name: '超时处理', score: 75 },
          { name: '重试机制', score: 80 },
          { name: '日志完整性', score: 73 },
        ],
      },
      {
        name: '性能',
        score: 80,
        metrics: [
          { name: '响应延迟', score: 82 },
          { name: '吞吐量', score: 78 },
          { name: '资源占用', score: 80 },
          { name: '并发处理', score: 79 },
          { name: '缓存命中率', score: 81 },
        ],
      },
      {
        name: '用户体验',
        score: 71,
        metrics: [
          { name: '回复清晰度', score: 73 },
          { name: '上下文理解', score: 68 },
          { name: '多轮对话', score: 72 },
          { name: '个性化适配', score: 70 },
          { name: '反馈质量', score: 72 },
        ],
      },
    ],
  },
  {
    id: 'eval-003',
    agentId: 'agent-002',
    agentName: 'DataAnalyst Bot',
    date: '2026-03-23',
    overallScore: 92,
    grade: 'A',
    dimensions: [
      {
        name: '功能性',
        score: 95,
        metrics: [
          { name: '任务完成率', score: 96 },
          { name: '代码正确性', score: 94 },
          { name: '边界处理', score: 93 },
          { name: '多语言支持', score: 95 },
          { name: '调试能力', score: 97 },
        ],
      },
      {
        name: '安全性',
        score: 90,
        metrics: [
          { name: '提示词注入防御', score: 88 },
          { name: '数据泄露防护', score: 92 },
          { name: '恶意代码检测', score: 90 },
          { name: '权限控制', score: 91 },
          { name: '敏感信息脱敏', score: 89 },
        ],
      },
      {
        name: '可靠性',
        score: 93,
        metrics: [
          { name: '响应一致性', score: 95 },
          { name: '错误恢复', score: 91 },
          { name: '超时处理', score: 93 },
          { name: '重试机制', score: 94 },
          { name: '日志完整性', score: 92 },
        ],
      },
      {
        name: '性能',
        score: 88,
        metrics: [
          { name: '响应延迟', score: 86 },
          { name: '吞吐量', score: 87 },
          { name: '资源占用', score: 90 },
          { name: '并发处理', score: 88 },
          { name: '缓存命中率', score: 89 },
        ],
      },
      {
        name: '用户体验',
        score: 94,
        metrics: [
          { name: '回复清晰度', score: 96 },
          { name: '上下文理解', score: 92 },
          { name: '多轮对话', score: 94 },
          { name: '个性化适配', score: 93 },
          { name: '反馈质量', score: 95 },
        ],
      },
    ],
  },
];

// 安全评分历史数据
export const scoreHistory = [
  { date: '03-01', 'CodeAssist Pro': 82, 'DataAnalyst Bot': 88, 'CustomerSupport AI': 70, 'SecurityScanner': 91, 'WritingAssistant': 78 },
  { date: '03-05', 'CodeAssist Pro': 84, 'DataAnalyst Bot': 89, 'CustomerSupport AI': 72, 'SecurityScanner': 92, 'WritingAssistant': 79 },
  { date: '03-10', 'CodeAssist Pro': 83, 'DataAnalyst Bot': 90, 'CustomerSupport AI': 68, 'SecurityScanner': 93, 'WritingAssistant': 80 },
  { date: '03-15', 'CodeAssist Pro': 86, 'DataAnalyst Bot': 91, 'CustomerSupport AI': 71, 'SecurityScanner': 94, 'WritingAssistant': 81 },
  { date: '03-20', 'CodeAssist Pro': 85, 'DataAnalyst Bot': 91, 'CustomerSupport AI': 73, 'SecurityScanner': 94, 'WritingAssistant': 80 },
  { date: '03-25', 'CodeAssist Pro': 87, 'DataAnalyst Bot': 92, 'CustomerSupport AI': 74, 'SecurityScanner': 95, 'WritingAssistant': 81 },
];

// 53种攻击场景（模拟完整数据）
const attackCategories = [
  { category: '提示词注入', prefix: 'PPI', count: 12 },
  { category: '数据泄露', prefix: 'DL', count: 8 },
  { category: '越狱攻击', prefix: 'JA', count: 7 },
  { category: '间接注入', prefix: 'II', count: 6 },
  { category: '模型操纵', prefix: 'MM', count: 5 },
  { category: '工具滥用', prefix: 'TA', count: 8 },
  { category: '权限提升', prefix: 'PE', count: 7 },
];

function generateAttackScenarios(): AttackScenario[] {
  const scenarios: AttackScenario[] = [];
  const statuses: ('passed' | 'failed' | 'critical')[] = ['passed', 'passed', 'passed', 'passed', 'failed', 'passed', 'critical', 'passed'];
  const severities: ('critical' | 'high' | 'medium' | 'low')[] = ['critical', 'high', 'medium', 'low'];

  const scenarioNames = [
    // 提示词注入
    ['系统提示词覆盖', '角色劫持', '指令注入', '上下文污染', '多语言注入', '编码混淆注入', 'Unicode注入', '模板注入', '后缀攻击', '前缀攻击', '中缀攻击', '递归注入'],
    // 数据泄露
    ['训练数据提取', '系统提示词泄露', '工具输出泄露', '用户数据暴露', 'API密钥探测', '环境变量泄露', '内存数据读取', '历史对话泄露'],
    // 越狱攻击
    ['DAN越狱', '角色扮演越狱', '假设场景越狱', '多步骤越狱', '编码越狱', '翻译越狱', '学术研究借口'],
    // 间接注入
    ['文档注入', '网页注入', '代码注释注入', '文件名注入', '元数据注入', '搜索结果注入'],
    // 模型操纵
    ['输出格式操控', '情感操纵', '偏见诱导', '逻辑陷阱', '循环推理'],
    // 工具滥用
    ['工具链利用', '参数注入', '返回值污染', '工具权限滥用', '并发工具调用', '工具重放攻击', '工具拒绝服务', '工具组合攻击'],
    // 权限提升
    ['角色切换攻击', '模拟管理员', '会话劫持', '令牌伪造', '多租户泄露', '委派权限滥用', 'API权限突破'],
  ];

  let id = 1;
  attackCategories.forEach((cat, catIdx) => {
    for (let i = 0; i < cat.count; i++) {
      const statusIdx = (id * 7 + i) % statuses.length;
      const sevIdx = (id * 3 + i) % severities.length;
      const name = scenarioNames[catIdx]?.[i] || `${cat.category} 场景 ${i + 1}`;
      const status = statuses[statusIdx];
      scenarios.push({
        id: `${cat.prefix}-${String(id).padStart(3, '0')}`,
        name,
        category: cat.category,
        severity: severities[sevIdx],
        description: `${name}的攻击测试，模拟真实场景下的安全威胁`,
        status,
        agentResponse: status === 'passed' ? 'Agent成功识别并拒绝了恶意请求' : status === 'failed' ? 'Agent未完全拦截，部分信息泄露' : 'Agent被成功攻击，执行了恶意指令',
        details: status === 'critical' ? '此漏洞可能导致严重的安全风险，建议立即修复' : undefined,
      });
      id++;
    }
  });

  return scenarios;
}

export const attackScenarios = generateAttackScenarios();

export const securityTestResults: SecurityTestResult[] = [
  {
    id: 'sec-test-001',
    agentId: 'agent-001',
    agentName: 'CodeAssist Pro',
    date: '2026-03-25',
    totalScenarios: 53,
    passed: 42,
    failed: 8,
    critical: 3,
    defenseRate: 79.2,
    scenarios: attackScenarios,
  },
  {
    id: 'sec-test-002',
    agentId: 'agent-002',
    agentName: 'DataAnalyst Bot',
    date: '2026-03-24',
    totalScenarios: 53,
    passed: 48,
    failed: 4,
    critical: 1,
    defenseRate: 90.6,
    scenarios: [],
  },
  {
    id: 'sec-test-003',
    agentId: 'agent-003',
    agentName: 'CustomerSupport AI',
    date: '2026-03-23',
    totalScenarios: 53,
    passed: 35,
    failed: 12,
    critical: 6,
    defenseRate: 66.0,
    scenarios: [],
  },
];
