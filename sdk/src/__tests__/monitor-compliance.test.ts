/**
 * 框架集成插件 + 监控 + 合规 单元测试
 * 测试: OpenClawPlugin, CrewAIPlugin, Middleware, AgentMonitor, RetestTrigger, ComplianceExporter
 */

import { OpenClawPlugin } from '../../plugins/openclaw';
import { CrewAIPlugin } from '../../plugins/crewai';
import { createMiddleware, wrapWithMiddleware } from '../../plugins/middleware';
import { AgentMonitor, RetestTrigger } from '../monitor';
import { generateEUAIActReport } from '../compliance/eu-ai-act';
import { generateSOC2Report } from '../compliance/soc2';
import { ComplianceExporter } from '../compliance/exporter';
import type { DecisionRecord, AgentPassport, EvalRecord, AgentChange, Certificate } from '../types';
import type { Alert } from '../monitor';

// ─────────────────────────────────────────────
// 断言工具
// ─────────────────────────────────────────────
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) { failCount++; console.log(`❌ FAIL: ${message}`); return; }
  passCount++; console.log(`✅ PASS: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) { failCount++; console.log(`❌ FAIL: ${message} - expected ${expected}, got ${actual}`); return; }
  passCount++; console.log(`✅ PASS: ${message}`);
}

function assertExists(value: unknown, message: string) {
  assert(value !== null && value !== undefined, message);
}

function assertGreaterThan(a: number, b: number, message: string) {
  if (a <= b) { failCount++; console.log(`❌ FAIL: ${message} - ${a} should be > ${b}`); return; }
  passCount++; console.log(`✅ PASS: ${message}`);
}

// ─────────────────────────────────────────────
// 1. OpenClawPlugin 测试
// ─────────────────────────────────────────────
console.log('\n=== OpenClawPlugin 测试 ===');

{
  const plugin = new OpenClawPlugin({ agentId: 'test-openclaw' });
  const status = plugin.getStatus();
  assertEqual(status.recorded, 0, '初始录制数为 0');
  assertEqual(status.errors, 0, '初始错误数为 0');
  assertEqual(status.lastRecord, null, '初始无最后记录');

  // wrap 一个模拟 Agent
  const mockAgent = {
    execute: async (input: unknown) => ({ answer: 'hello' }),
    tools: [
      { name: 'search', execute: async (params: unknown) => 'result' },
    ],
  };
  const wrapped = plugin.wrap(mockAgent);
  assertExists(wrapped, 'wrap 返回 Agent');

  // 测试执行
  (async () => {
    await wrapped.execute({ question: 'test' });
    const s = plugin.getStatus();
    assertGreaterThan(s.recorded, 0, '执行后录制数 > 0');
  })();
}

// ─────────────────────────────────────────────
// 2. CrewAIPlugin 测试
// ─────────────────────────────────────────────
console.log('\n=== CrewAIPlugin 测试 ===');

{
  const plugin = new CrewAIPlugin({ agentId: 'test-crewai' });
  const status = plugin.getStatus();
  assertEqual(status.recorded, 0, 'CrewAI 初始录制数为 0');

  const mockCrew = {
    kickoff: async (input: unknown) => 'crew result',
    agents: [
      {
        role: 'researcher',
        goal: 'research',
        execute: async () => 'agent result',
      },
    ],
  };

  const wrapped = plugin.wrapCrew(mockCrew);
  assertExists(wrapped, 'wrapCrew 返回 Crew');

  // 测试执行
  (async () => {
    await wrapped.kickoff({ topic: 'test' });
    const s = plugin.getStatus();
    assertGreaterThan(s.recorded, 0, 'CrewAI 执行后录制数 > 0');
  })();
}

// ─────────────────────────────────────────────
// 3. Middleware 测试
// ─────────────────────────────────────────────
console.log('\n=== Middleware 测试 ===');

{
  const middleware = createMiddleware({ agentId: 'test-middleware' });
  assertExists(middleware, 'createMiddleware 返回中间件');
  assertExists(middleware.beforeExecute, 'beforeExecute 存在');
  assertExists(middleware.afterExecute, 'afterExecute 存在');
  assertExists(middleware.onToolCall, 'onToolCall 存在');
  assertExists(middleware.onError, 'onError 存在');

  // 测试 wrapWithMiddleware
  const fn = async (input: { q: string }) => ({ answer: 'ok' });
  const wrapped = wrapWithMiddleware(fn, middleware);
  assertExists(wrapped, 'wrapWithMiddleware 返回包装函数');

  (async () => {
    const result = await wrapped({ q: 'test' });
    assertEqual(result.answer, 'ok', '中间件包装后结果正确');
  })();
}

// ─────────────────────────────────────────────
// 4. AgentMonitor 测试
// ─────────────────────────────────────────────
console.log('\n=== AgentMonitor 测试 ===');

{
  const alerts: Alert[] = [];
  const monitor = new AgentMonitor({
    agentId: 'test-monitor',
    performanceThreshold: 50,
    errorRateThreshold: 10,
    anomalyWindow: 10,
    certExpiryWarningDays: 30,
    onAlert: (alert) => alerts.push(alert),
  });

  // 测试空记录
  const emptyAlerts = monitor.analyze([]);
  assertEqual(emptyAlerts.length, 0, '空记录无告警');

  // 测试正常记录
  const normalRecords: DecisionRecord[] = Array.from({ length: 5 }, (_, i) => ({
    id: `record-${i}`,
    agentId: 'test-monitor',
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
    type: 'decision' as const,
    input: { test: true },
    output: { result: 'ok' },
    duration: 100 + i * 10,
    hash: `hash-${i}`,
  }));
  const normalResult = monitor.analyze(normalRecords);
  // 首次分析设置基线，不应有告警
  assertEqual(normalResult.length, 0, '正常记录无告警（设置基线）');

  // 测试错误率告警
  const errorRecords: DecisionRecord[] = Array.from({ length: 10 }, (_, i) => ({
    id: `err-${i}`,
    agentId: 'test-monitor',
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
    type: i < 5 ? 'error' as const : 'decision' as const,
    input: {},
    output: i < 5 ? { error: 'fail' } : { result: 'ok' },
    duration: 100,
    hash: `hash-err-${i}`,
  }));
  const errorAlerts = monitor.analyze(errorRecords);
  assert(errorAlerts.some(a => a.type === 'error_spike'), '高错误率触发 error_spike 告警');

  // 测试 getAlerts
  const allAlerts = monitor.getAlerts();
  assertGreaterThan(allAlerts.length, 0, 'getAlerts 返回历史告警');

  const criticalOnly = monitor.getAlerts({ level: 'critical' });
  assert(criticalOnly.every(a => a.level === 'critical'), '按级别过滤正确');
}

// ─────────────────────────────────────────────
// 5. AgentMonitor 证书和权限测试
// ─────────────────────────────────────────────
console.log('\n=== AgentMonitor 证书/权限测试 ===');

{
  const monitor = new AgentMonitor({
    agentId: 'test-cert',
    performanceThreshold: 50,
    errorRateThreshold: 10,
    anomalyWindow: 10,
    certExpiryWarningDays: 60,
  });

  // 测试证书过期检测
  const cert: Certificate = {
    certId: 'cert-001',
    agentId: 'test-cert',
    studentId: 'stu-001',
    issuedAt: new Date(Date.now() - 340 * 24 * 60 * 60 * 1000).toISOString(), // 340天前
    score: 95,
    grade: 'S',
    dimensions: {
      security: { score: 19, max: 20 },
      reliability: { score: 19, max: 20 },
      observability: { score: 19, max: 20 },
      compliance: { score: 19, max: 20 },
      explainability: { score: 19, max: 20 },
    },
    signature: 'sig',
    verifyUrl: 'https://verify.example.com',
  };
  const certAlert = monitor.checkCertificateExpiry(cert);
  assertExists(certAlert, '证书即将过期产生告警');
  assertEqual(certAlert!.type, 'certificate_expiring', '证书告警类型正确');

  // 测试权限漂移检测
  const passport: AgentPassport = {
    passportId: 'pp-001',
    agentId: 'test-cert',
    fingerprint: 'fp-001',
    framework: { name: 'test', version: '1.0' },
    model: { provider: 'openai', name: 'gpt-4' },
    tools: [{ name: 'search', category: 'web', permissions: ['read'] }],
    permissions: {
      maxTokens: 10000,
      allowedDomains: [],
      deniedDomains: [],
      maxExecutionTime: 30000,
      sandboxed: true,
    },
    createdAt: new Date().toISOString(),
  };
  const driftAlert = monitor.checkPermissionDrift(passport, {
    tools: ['search', 'new-tool'],
  });
  assertExists(driftAlert, '权限漂移产生告警');
  assertEqual(driftAlert!.type, 'permission_drift', '权限告警类型正确');
}

// ─────────────────────────────────────────────
// 6. RetestTrigger 测试
// ─────────────────────────────────────────────
console.log('\n=== RetestTrigger 测试 ===');

{
  const trigger = new RetestTrigger();
  const evalRecord: EvalRecord = {
    sequence: 1,
    timestamp: new Date().toISOString(),
    dimensions: {
      security: { score: 15, max: 20 },
      reliability: { score: 16, max: 20 },
      observability: { score: 14, max: 20 },
      compliance: { score: 17, max: 20 },
      explainability: { score: 13, max: 20 },
    },
    totalScore: 75,
    grade: 'B',
  };

  // 无预警无变更 → 不需复测
  const noRetest = trigger.evaluate([], [], evalRecord);
  assertEqual(noRetest.needed, false, '无预警无需复测');

  // critical 安全预警 → 需要安全复测
  const criticalAlert: Alert = {
    id: 'a1',
    level: 'critical',
    type: 'security_breach',
    message: 'breach',
    agentId: 'test',
    timestamp: new Date().toISOString(),
  };
  const secRetest = trigger.evaluate([criticalAlert], [], evalRecord);
  assertEqual(secRetest.needed, true, 'critical 安全预警需复测');
  assertEqual(secRetest.scope, 'security_only', '安全预警触发安全复测');
  assertEqual(secRetest.priority, 'high', '安全复测优先级 high');

  // 模型升级 → 全量复测
  const modelChange: AgentChange = {
    changeId: 'c1',
    passportId: 'pp-001',
    changeType: 'model_upgrade',
    description: 'GPT-3.5 → GPT-4',
    previousFingerprint: 'fp-old',
    newFingerprint: 'fp-new',
    timestamp: new Date().toISOString(),
  };
  const modelRetest = trigger.evaluate([], [modelChange], evalRecord);
  assertEqual(modelRetest.needed, true, '模型升级需复测');
  assertEqual(modelRetest.scope, 'full', '模型升级触发全量复测');
}

// ─────────────────────────────────────────────
// 7. 合规报告测试
// ─────────────────────────────────────────────
console.log('\n=== 合规报告测试 ===');

{
  const passport: AgentPassport = {
    passportId: 'pp-compliance',
    agentId: 'compliance-test',
    fingerprint: 'fp-comp',
    framework: { name: 'openclaw', version: '1.0' },
    model: { provider: 'openai', name: 'gpt-4', version: 'turbo' },
    tools: [
      { name: 'web_search', category: 'web-search', permissions: ['read'] },
      { name: 'code_exec', category: 'code-exec', permissions: ['execute'] },
    ],
    permissions: {
      maxTokens: 50000,
      allowedDomains: ['api.example.com'],
      deniedDomains: ['evil.com'],
      maxExecutionTime: 60000,
      sandboxed: true,
    },
    createdAt: new Date().toISOString(),
  };

  const evalHistory: EvalRecord[] = [{
    sequence: 1,
    timestamp: new Date().toISOString(),
    dimensions: {
      security: { score: 18, max: 20 },
      reliability: { score: 17, max: 20 },
      observability: { score: 16, max: 20 },
      compliance: { score: 19, max: 20 },
      explainability: { score: 15, max: 20 },
    },
    totalScore: 85,
    grade: 'A',
  }];

  const records: DecisionRecord[] = [{
    id: 'r1',
    agentId: 'compliance-test',
    timestamp: new Date().toISOString(),
    type: 'decision',
    input: { question: 'test' },
    output: { answer: 'result' },
    duration: 200,
    hash: 'hash1',
    signature: 'sig1',
    reasoning: 'test reasoning',
  }];

  const alertList: Alert[] = [{
    id: 'alert-1',
    level: 'warning',
    type: 'performance_degradation',
    message: '延迟增加 30%',
    agentId: 'compliance-test',
    timestamp: new Date().toISOString(),
  }];

  // EU AI Act 报告
  const euReport = generateEUAIActReport(passport, evalHistory, alertList);
  assertExists(euReport.id, 'EU AI Act 报告有 ID');
  assertExists(euReport.systemDescription, 'EU AI Act 报告有系统描述');
  assert(euReport.riskManagement.identifiedRisks.length > 0, 'EU AI Act 有已识别风险');
  assert(euReport.riskManagement.mitigationMeasures.length > 0, 'EU AI Act 有缓解措施');
  assertExists(euReport.dataGovernance.retentionPolicy, 'EU AI Act 有保留策略');
  assertExists(euReport.technicalDocumentation.architecture, 'EU AI Act 有架构文档');
  assertExists(euReport.generatedAt, 'EU AI Act 有生成时间');
  assertExists(euReport.evaluationSummary, 'EU AI Act 有评测摘要');
  assertEqual(euReport.evaluationSummary!.latestGrade, 'A', 'EU AI Act 评测等级正确');

  // SOC2 报告
  const soc2Report = generateSOC2Report(passport, evalHistory, records, alertList);
  assertExists(soc2Report.id, 'SOC2 报告有 ID');
  assertExists(soc2Report.criteria.security, 'SOC2 有安全性评估');
  assertExists(soc2Report.criteria.availability, 'SOC2 有可用性评估');
  assertExists(soc2Report.criteria.processingIntegrity, 'SOC2 有处理完整性评估');
  assertExists(soc2Report.criteria.confidentiality, 'SOC2 有保密性评估');
  assertExists(soc2Report.criteria.privacy, 'SOC2 有隐私评估');
  assertEqual(soc2Report.evidenceSummary.totalEvents, 1, 'SOC2 事件数正确');

  // 报告导出器
  const exporter = new ComplianceExporter();

  const html = exporter.toHTML(euReport);
  assert(html.includes('<!DOCTYPE html>'), 'HTML 导出包含 DOCTYPE');
  assert(html.includes('EU AI Act'), 'HTML 包含标题');

  const json = exporter.toJSON(euReport);
  const parsed = JSON.parse(json);
  assertEqual(parsed.id, euReport.id, 'JSON 导出包含正确 ID');

  const md = exporter.toMarkdown(euReport);
  assert(md.includes('# EU AI Act'), 'Markdown 导出包含标题');

  const soc2Html = exporter.toHTML(soc2Report);
  assert(soc2Html.includes('SOC2'), 'SOC2 HTML 导出包含标题');

  const soc2Md = exporter.toMarkdown(soc2Report);
  assert(soc2Md.includes('# SOC2'), 'SOC2 Markdown 导出包含标题');
}

// ─────────────────────────────────────────────
// 汇总
// ─────────────────────────────────────────────
console.log(`\n📊 测试结果: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  process.exit(1);
}
