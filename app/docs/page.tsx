'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="px-2 py-1 text-xs rounded transition"
      style={{
        background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
        color: copied ? '#22c55e' : '#737373',
      }}>
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  return (
    <div className="rounded-lg overflow-hidden my-4" style={{ background: '#111', border: '1px solid #222' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: '#161616', borderBottom: '1px solid #222' }}>
        <span className="text-xs text-neutral-500 font-mono">{lang}</span>
        <CopyButton text={children} />
      </div>
      <pre className="p-4 text-sm text-neutral-300 overflow-x-auto leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

const SECTIONS = [
  { id: 'quickstart', label_en: 'Quick Start', label_zh: '快速开始' },
  { id: 'api', label_en: 'API Reference', label_zh: 'API参考' },
  { id: 'cli', label_en: 'CLI Reference', label_zh: 'CLI参考' },
  { id: 'integrations', label_en: 'Integrations', label_zh: '框架集成' },
  { id: 'compliance', label_en: 'Compliance', label_zh: '合规报告' },
];

export default function DocsPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const [activeSection, setActiveSection] = useState('quickstart');

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-24 space-y-1">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                {isZh ? '文档' : 'Docs'}
              </h3>
              {SECTIONS.map((s) => (
                <button key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className="block w-full text-left px-3 py-2 rounded-lg text-sm transition"
                  style={{
                    background: activeSection === s.id ? 'rgba(220,38,38,0.1)' : 'transparent',
                    color: activeSection === s.id ? '#dc2626' : '#a3a3a3',
                  }}>
                  {isZh ? s.label_zh : s.label_en}
                </button>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Mobile section selector */}
            <div className="lg:hidden mb-6 flex gap-2 overflow-x-auto pb-2">
              {SECTIONS.map((s) => (
                <button key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition"
                  style={{
                    background: activeSection === s.id ? 'rgba(220,38,38,0.1)' : '#111',
                    color: activeSection === s.id ? '#dc2626' : '#a3a3a3',
                    border: '1px solid #222',
                  }}>
                  {isZh ? s.label_zh : s.label_en}
                </button>
              ))}
            </div>

            {/* Quick Start */}
            {activeSection === 'quickstart' && (
              <div className="animate-fade-in">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {isZh ? '快速开始' : 'Quick Start'}
                </h1>
                <p className="text-neutral-500 mb-8">
                  {isZh ? '5分钟内为你的Agent添加黑匣子' : 'Add a black box to your Agent in 5 minutes'}
                </p>

                <h2 className="text-xl font-semibold text-white mb-3">1. {isZh ? '安装' : 'Installation'}</h2>
                <CodeBlock lang="bash">npm install @lobster-academy/blackbox</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">2. {isZh ? '初始化' : 'Initialize'}</h2>
                <CodeBlock lang="typescript">{`import { LobsterBlackbox } from '@lobster-academy/blackbox';

const lobster = new LobsterBlackbox({
  agentId: 'my-agent',
  // 自动生成 Ed25519 密钥对
});`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">3. {isZh ? '录制行为' : 'Record Behavior'}</h2>
                <CodeBlock lang="typescript">{`// 每次 Agent 做出决策时录制
lobster.record({
  type: 'decision',
  input: { prompt: userQuery },
  reasoning: 'Selected weather API based on location keyword',
  output: { response: 'Beijing, 25°C, Sunny' },
  metadata: { model: 'gpt-4', tokens: 156 }
});

// PII 自动脱敏（208种模式）
// Ed25519 自动签名`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">4. {isZh ? '生成报告' : 'Generate Report'}</h2>
                <CodeBlock lang="typescript">{`// 生成合规报告
const report = lobster.generateReport({
  format: 'html',  // 'html' | 'pdf' | 'json'
  compliance: ['eu-ai-act', 'soc2'],
});

// 导出 Agent 护照
const passport = lobster.getPassport();`}</CodeBlock>
              </div>
            )}

            {/* API Reference */}
            {activeSection === 'api' && (
              <div className="animate-fade-in">
                <h1 className="text-3xl font-bold text-white mb-2">API Reference</h1>
                <p className="text-neutral-500 mb-8">{isZh ? '完整的TypeScript API文档' : 'Complete TypeScript API documentation'}</p>

                <h2 className="text-xl font-semibold text-white mb-3">LobsterBlackbox</h2>
                <CodeBlock lang="typescript">{`class LobsterBlackbox {
  constructor(config: {
    agentId: string;
    storagePath?: string;
    redactorConfig?: RedactorConfig;
  });

  // 录制 Agent 行为
  record(entry: BehaviorEntry): void;

  // 运行对抗评测
  async evaluate(options?: EvalOptions): Promise<EvalResult>;

  // 生成报告
  generateReport(options?: ReportOptions): Report;

  // 获取 Agent 护照
  getPassport(): AgentPassport;

  // 启动持续监控
  startMonitor(config?: MonitorConfig): Monitor;

  // 导出脱敏后的日志
  exportLogs(format: 'json' | 'csv'): string;
}`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">BehaviorEntry</h2>
                <CodeBlock lang="typescript">{`interface BehaviorEntry {
  type: 'decision' | 'tool_call' | 'error' | 'response';
  input: Record<string, unknown>;
  reasoning?: string;
  output: Record<string, unknown>;
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    timestamp?: string;
  };
}`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">EvalResult</h2>
                <CodeBlock lang="typescript">{`interface EvalResult {
  score: number;            // 0-100
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    security: DimensionScore;
    reasoning: DimensionScore;
    tool_use: DimensionScore;
    compliance: DimensionScore;
    reliability: DimensionScore;
  };
  attacks_tested: number;
  attacks_passed: number;
  recommendations: string[];
}`}</CodeBlock>
              </div>
            )}

            {/* CLI Reference */}
            {activeSection === 'cli' && (
              <div className="animate-fade-in">
                <h1 className="text-3xl font-bold text-white mb-2">CLI Reference</h1>
                <p className="text-neutral-500 mb-8">{isZh ? '命令行工具完整参考' : 'Complete CLI tool reference'}</p>

                <h2 className="text-xl font-semibold text-white mb-3">lobster enroll</h2>
                <p className="text-sm text-neutral-400 mb-3">{isZh ? '注册你的Agent到龙虾学院' : 'Register your Agent with Lobster Academy'}</p>
                <CodeBlock lang="bash">{`lobster enroll --agent <name> [options]

Options:
  --agent, -a       Agent名称（必填）
  --framework, -f   框架类型 (openclaw|langchain|crewai|generic)
  --config, -c      配置文件路径
  --output, -o      输出目录

Example:
  lobster enroll --agent my-chatbot --framework langchain`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">lobster check</h2>
                <p className="text-sm text-neutral-400 mb-3">{isZh ? '运行Agent健康检查' : 'Run Agent health evaluation'}</p>
                <CodeBlock lang="bash">{`lobster check [options]

Options:
  --agent, -a       指定Agent（默认使用已注册的）
  --attack, -k      指定攻击场景
  --depth, -d       评测深度 (shallow|standard|deep)
  --timeout, -t     超时时间（秒）

Example:
  lobster check --depth deep --attack prompt-injection`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">lobster report</h2>
                <p className="text-sm text-neutral-400 mb-3">{isZh ? '生成合规报告' : 'Generate compliance report'}</p>
                <CodeBlock lang="bash">{`lobster report [options]

Options:
  --format, -f      输出格式 (html|pdf|json)
  --compliance, -c  合规标准 (eu-ai-act|soc2|all)
  --output, -o      输出文件路径
  --period, -p      报告周期 (daily|weekly|monthly)

Example:
  lobster report --format html --compliance all -o report.html`}</CodeBlock>
              </div>
            )}

            {/* Integrations */}
            {activeSection === 'integrations' && (
              <div className="animate-fade-in">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {isZh ? '框架集成指南' : 'Integration Guide'}
                </h1>
                <p className="text-neutral-500 mb-8">{isZh ? '一键接入主流AI Agent框架' : 'One-click integration with popular AI Agent frameworks'}</p>

                <h2 className="text-xl font-semibold text-white mb-3">OpenClaw</h2>
                <CodeBlock lang="typescript">{`import { LobsterBlackbox } from '@lobster-academy/blackbox';
import { openclawPlugin } from '@lobster-academy/blackbox/plugins';

const lobster = new LobsterBlackbox({ agentId: 'my-openclaw' });

// 自动拦截所有 OpenClaw 工具调用
openclawPlugin.install(lobster);`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">LangChain</h2>
                <CodeBlock lang="typescript">{`import { LobsterBlackbox } from '@lobster-academy/blackbox';
import { langchainCallback } from '@lobster-academy/blackbox/plugins';

const lobster = new LobsterBlackbox({ agentId: 'my-chain' });

// 添加为 LangChain callback handler
const chain = new LLMChain({
  llm: model,
  callbacks: [langchainCallback(lobster)],
});`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">CrewAI</h2>
                <CodeBlock lang="python">{`from lobster_academy import LobsterBlackbox

lobster = LobsterBlackbox(agent_id="my-crew")

# 作为中间件注入
crew = Crew(
  agents=[agent1, agent2],
  tasks=[task1, task2],
  middleware=[lobster.middleware()],
)`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">
                  {isZh ? '通用中间件' : 'Generic Middleware'}
                </h2>
                <CodeBlock lang="typescript">{`import { LobsterBlackbox } from '@lobster-academy/blackbox';
import { expressMiddleware } from '@lobster-academy/blackbox/plugins';

const lobster = new LobsterBlackbox({ agentId: 'my-app' });

// Express middleware
app.use(expressMiddleware(lobster));`}</CodeBlock>
              </div>
            )}

            {/* Compliance */}
            {activeSection === 'compliance' && (
              <div className="animate-fade-in">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {isZh ? '合规报告指南' : 'Compliance Reports'}
                </h1>
                <p className="text-neutral-500 mb-8">{isZh ? '生成符合EU AI Act和SOC2标准的报告' : 'Generate reports compliant with EU AI Act and SOC2'}</p>

                <h2 className="text-xl font-semibold text-white mb-3">EU AI Act</h2>
                <p className="text-sm text-neutral-400 mb-3">
                  {isZh
                    ? '自动生成符合欧盟AI法案要求的技术文档，包括风险评估、透明度说明和人工监督机制。'
                    : 'Auto-generate technical documentation compliant with EU AI Act requirements, including risk assessment, transparency statements, and human oversight mechanisms.'}
                </p>
                <CodeBlock lang="typescript">{`const report = lobster.generateReport({
  compliance: ['eu-ai-act'],
  format: 'html',
  include: [
    'risk_assessment',
    'transparency_statement',
    'human_oversight',
    'technical_documentation',
    'data_governance',
  ],
});`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">SOC2</h2>
                <p className="text-sm text-neutral-400 mb-3">
                  {isZh
                    ? '生成SOC2 Type II审计所需的行为日志和安全控制证据。'
                    : 'Generate behavior logs and security control evidence for SOC2 Type II audits.'}
                </p>
                <CodeBlock lang="typescript">{`const report = lobster.generateReport({
  compliance: ['soc2'],
  format: 'pdf',
  period: {
    start: '2026-01-01',
    end: '2026-03-31',
  },
  include: [
    'access_controls',
    'audit_logs',
    'incident_response',
    'data_protection',
  ],
});`}</CodeBlock>

                <h2 className="text-xl font-semibold text-white mb-3 mt-8">
                  {isZh ? 'Ed25519 签名验证' : 'Ed25519 Signature Verification'}
                </h2>
                <CodeBlock lang="typescript">{`// 每份报告都带有 Ed25519 签名
const isValid = lobster.verifyReport(report);
// => true

// 第三方可以独立验证
import { verify } from '@lobster-academy/blackbox';
const valid = verify(report.data, report.signature, publicKey);`}</CodeBlock>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
