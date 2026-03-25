/**
 * 龙虾学院 Blackbox — CLI 完整体检工具（5维度25项评测系统）
 * 对 AI Agent 配置进行全面健康检查
 *
 * Usage:
 *   npx lobster-check [agent-path] [--output report.txt]
 *   npx lobster-check [agent-path] [--format json] [--output report.json]
 *   npx lobster-check --agent-path <path> --format json --output report.json
 */

import { LobsterBlackbox } from '../src/index';
import { Signer } from '../src/signer';
import { Redactor } from '../src/redactor';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Types
// ============================================================

interface CheckItem {
  passed: boolean;
  score: number;
  maxScore: number;
  message: string;
  suggestion?: string;
}

interface CheckConfig {
  id: string;
  name: string;
  maxScore: number;
  run: (opts: EvalOptions) => Promise<CheckItem>;
}

interface DimensionConfig {
  name: string;
  emoji: string;
  weight: number;
  checks: CheckConfig[];
}

interface DimensionResult {
  key: string;
  name: string;
  emoji: string;
  weight: number;
  totalScore: number;
  maxScore: number;
  weightedScore: number;
  percentage: number;
  checks: (CheckItem & { id: string; name: string })[];
}

interface EvalReport {
  timestamp: string;
  agentPath?: string;
  totalScore: number;
  grade: string;
  gradeLabel: string;
  dimensions: DimensionResult[];
  suggestions: { priority: string; text: string; dimension: string; scoreGain: number }[];
}

interface EvalOptions {
  agentPath?: string;
  verbose?: boolean;
}

// ============================================================
// SDK-based checks (reuse existing logic)
// ============================================================

let _sdkBox: LobsterBlackbox | null = null;
let _sdkHealthy = false;
let _sdkError: string | null = null;

async function ensureSDK(): Promise<void> {
  if (_sdkBox !== null) return;
  try {
    _sdkBox = new LobsterBlackbox({ agentId: 'eval-check' });
    await _sdkBox.record({ input: { test: 'health' }, output: { status: 'ok' } });
    _sdkHealthy = true;
  } catch (e) {
    _sdkHealthy = false;
    _sdkError = e instanceof Error ? e.message : String(e);
  }
}

// ============================================================
// Grading
// ============================================================

function gradeLabel(totalScore: number): { grade: string; label: string } {
  if (totalScore >= 90) return { grade: 'S', label: '优秀 — 可部署到高安全要求的生产环境' };
  if (totalScore >= 75) return { grade: 'A', label: '良好 — 可投入企业生产环境' };
  if (totalScore >= 60) return { grade: 'B', label: '合格 — 建议改进后投入使用' };
  if (totalScore >= 40) return { grade: 'C', label: '待改进 — 需要多项改进才能上线' };
  return { grade: 'D', label: '不合格 — 存在严重风险，不建议上线' };
}

function dynamicTestCheck(maxScore: number, name: string, detail: string): CheckItem {
  return {
    passed: false,
    score: Math.round(maxScore * 0.3),
    maxScore,
    message: `⚠️ 需要动态测试 — ${detail}`,
    suggestion: `建议通过集成测试/模糊测试验证 ${name}`,
  };
}

// ============================================================
// 25 Check Definitions
// ============================================================

const DIMENSIONS: Record<string, DimensionConfig> = {
  security: {
    name: '安全性',
    emoji: '🔒',
    weight: 30,
    checks: [
      {
        id: '1.1',
        name: '工具白名单',
        maxScore: 5,
        async run(opts) {
          const hasWhitelist = opts.agentPath
            ? ['tool-whitelist.yaml', 'tool-whitelist.json', 'allowed-tools.yaml']
                .some(f => fs.existsSync(path.join(opts.agentPath!, f)))
            : false;
          if (hasWhitelist) return { passed: true, score: 5, maxScore: 5, message: '工具白名单配置文件存在' };
          return { passed: false, score: 0, maxScore: 5, message: '未找到工具白名单配置', suggestion: '创建 tool-whitelist.yaml 定义允许调用的工具列表' };
        },
      },
      {
        id: '1.2',
        name: '密钥管理',
        maxScore: 5,
        async run(opts) {
          await ensureSDK();
          if (!_sdkHealthy) return { passed: false, score: 0, maxScore: 5, message: `SDK 不可用: ${_sdkError}` };
          try {
            const keys = Signer.generateKeyPair();
            const signer = new Signer(keys.secretKey);
            const sig = signer.sign('eval-test');
            const valid = Signer.verify('eval-test', sig, keys.publicKey);
            // 检查是否有 .env 或密钥管理
            const hasEnvMgmt = opts.agentPath
              ? fs.existsSync(path.join(opts.agentPath, '.env')) || fs.existsSync(path.join(opts.agentPath, '.env.example'))
              : false;
            if (valid && hasEnvMgmt) return { passed: true, score: 5, maxScore: 5, message: 'Ed25519 密钥正常 + 环境变量管理' };
            if (valid) return { passed: true, score: 3, maxScore: 5, message: 'Ed25519 密钥生成与签名验证正常，建议使用 .env 管理密钥' };
            return { passed: false, score: 1, maxScore: 5, message: '签名验证失败', suggestion: '检查 Ed25519 实现是否正确' };
          } catch (e) {
            return { passed: false, score: 0, maxScore: 5, message: `密钥管理异常: ${e instanceof Error ? e.message : String(e)}` };
          }
        },
      },
      {
        id: '1.3',
        name: '输入验证',
        maxScore: 4,
        async run(opts) {
          const hasSchema = opts.agentPath
            ? checkDependency(opts.agentPath, ['zod', 'joi', 'superstruct', 'ajv', 'yup'])
            : false;
          if (hasSchema) return { passed: true, score: 4, maxScore: 4, message: '检测到 schema 校验库' };
          return { passed: false, score: 1, maxScore: 4, message: '未检测到输入 schema 校验', suggestion: '使用 zod/joi 对所有工具参数做校验' };
        },
      },
      {
        id: '1.4',
        name: '输出过滤',
        maxScore: 4,
        async run(opts) {
          await ensureSDK();
          if (!_sdkHealthy) return { passed: false, score: 0, maxScore: 4, message: `SDK 不可用: ${_sdkError}` };
          try {
            const redactor = new Redactor({ patterns: ['email', 'phone', 'creditCard'] });
            const redacted = redactor.redactString('邮箱 test@example.com 电话 13812345678');
            const hasRedacted = redacted.includes('[REDACTED]');
            if (hasRedacted) return { passed: true, score: 4, maxScore: 4, message: '输出脱敏机制正常工作' };
            return { passed: false, score: 1, maxScore: 4, message: '脱敏未生效', suggestion: '确保 Redactor 配置正确的脱敏模式' };
          } catch (e) {
            return { passed: false, score: 0, maxScore: 4, message: `输出过滤异常: ${e instanceof Error ? e.message : String(e)}` };
          }
        },
      },
      {
        id: '1.5',
        name: '权限边界',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 4, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const permFiles = ['permissions.yaml', 'permissions.json', 'rbac.yaml', 'acl.yaml'];
          const found = permFiles.some(f => fs.existsSync(path.join(opts.agentPath!, f)));
          if (found) return { passed: true, score: 4, maxScore: 4, message: '发现权限配置文件' };
          return { passed: false, score: 1, maxScore: 4, message: '未找到权限边界配置', suggestion: '创建 permissions.yaml 定义 Agent 的最小权限集' };
        },
      },
      {
        id: '1.6',
        name: '网络控制',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 3, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const netFiles = ['network-policy.yaml', 'firewall.yaml', 'allowed-domains.yaml'];
          const found = netFiles.some(f => fs.existsSync(path.join(opts.agentPath!, f)));
          if (found) return { passed: true, score: 3, maxScore: 3, message: '发现网络策略配置' };
          return { passed: false, score: 1, maxScore: 3, message: '未找到网络控制策略', suggestion: '创建 network-policy.yaml 限制 Agent 的网络访问范围' };
        },
      },
      {
        id: '1.7',
        name: '文件系统控制',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 3, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const sandboxFiles = ['.lobsterignore', 'sandbox.yaml', 'fs-policy.yaml'];
          const found = sandboxFiles.some(f => fs.existsSync(path.join(opts.agentPath!, f)));
          if (found) return { passed: true, score: 3, maxScore: 3, message: '发现文件系统限制配置' };
          return { passed: false, score: 0, maxScore: 3, message: '未找到文件系统限制配置', suggestion: '创建 .lobsterignore 或 sandbox.yaml 限制可访问的文件路径' };
        },
      },
      {
        id: '1.8',
        name: '提示注入防护',
        maxScore: 6,
        async run() {
          return dynamicTestCheck(6, '提示注入防护', '需要通过对抗性输入测试验证 Agent 对注入攻击的抵抗力');
        },
      },
      {
        id: '1.9',
        name: '数据泄露防护',
        maxScore: 6,
        async run(opts) {
          await ensureSDK();
          if (!_sdkHealthy) return { passed: false, score: 0, maxScore: 6, message: `SDK 不可用: ${_sdkError}` };
          try {
            const redactor = new Redactor({ patterns: ['email', 'phone', 'creditCard', 'ssn', 'idCard'] });
            const obj = { user: { email: 'a@b.com', nested: { phone: '13812345678', card: '4111111111111111' } } };
            const redactedObj = redactor.redactObject(obj);
            const str = JSON.stringify(redactedObj);
            const leaked = str.includes('a@b.com') || str.includes('13812345678') || str.includes('4111111111111111');
            // 部分分: 有脱敏能力但可能不完整
            if (!leaked) return { passed: true, score: 6, maxScore: 6, message: '嵌套对象深度脱敏正常，无数据泄露' };
            return { passed: false, score: 0, maxScore: 6, message: '检测到数据泄露 — 脱敏不完整', suggestion: '确保所有敏感字段都被正确脱敏' };
          } catch (e) {
            return { passed: false, score: 0, maxScore: 6, message: `数据泄露检测异常: ${e instanceof Error ? e.message : String(e)}` };
          }
        },
      },
      {
        id: '1.10',
        name: '供应链安全',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 4, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const lockFile = fs.existsSync(path.join(opts.agentPath!, 'package-lock.json'))
            || fs.existsSync(path.join(opts.agentPath!, 'yarn.lock'))
            || fs.existsSync(path.join(opts.agentPath!, 'pnpm-lock.yaml'));
          const hasAudit = fs.existsSync(path.join(opts.agentPath!, '.npmrc'));
          let score = 0;
          if (lockFile) score += 2;
          if (hasAudit) score += 2;
          return {
            passed: score >= 2,
            score,
            maxScore: 4,
            message: lockFile ? (hasAudit ? '依赖锁定文件和 .npmrc 存在' : '依赖锁定文件存在，建议添加 .npmrc') : '未找到依赖锁定文件',
            suggestion: !lockFile ? '使用 package-lock.json / yarn.lock 锁定依赖版本' : (!hasAudit ? '添加 .npmrc 配置 registry 和安全选项' : undefined),
          };
        },
      },
    ],
  },

  reliability: {
    name: '可靠性',
    emoji: '🛡️',
    weight: 25,
    checks: [
      {
        id: '2.1',
        name: '超时处理',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 4, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasTimeout = searchInFiles(opts.agentPath, ['timeout', 'TimeoutError', 'AbortController', 'AbortSignal']);
          if (hasTimeout) return { passed: true, score: 4, maxScore: 4, message: '检测到超时处理代码' };
          return { passed: false, score: 0, maxScore: 4, message: '未检测到超时配置', suggestion: '为所有外部调用添加超时控制（AbortController / Promise.race）' };
        },
      },
      {
        id: '2.2',
        name: '重试机制',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 4, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasRetry = searchInFiles(opts.agentPath, ['retry', 'Retry', 'retries', 'attempt']);
          if (hasRetry) return { passed: true, score: 4, maxScore: 4, message: '检测到重试逻辑' };
          return { passed: false, score: 1, maxScore: 4, message: '未检测到重试机制', suggestion: '为关键操作添加指数退避重试' };
        },
      },
      {
        id: '2.3',
        name: '熔断机制',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 3, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasCircuit = searchInFiles(opts.agentPath, ['circuit', 'CircuitBreaker', 'bulkhead', 'circuitBreaker']);
          if (hasCircuit) return { passed: true, score: 3, maxScore: 3, message: '检测到熔断器实现' };
          return { passed: false, score: 0, maxScore: 3, message: '未检测到熔断机制', suggestion: '添加熔断器防止级联故障（opossum / opossum-rxjs）' };
        },
      },
      {
        id: '2.4',
        name: '错误处理',
        maxScore: 5,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 5, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasCatch = searchInFiles(opts.agentPath, ['catch (', 'catch(', '.catch(', 'try {', 'onError', 'onerror']);
          const hasFriendly = searchInFiles(opts.agentPath, ['用户友好', 'friendly error', 'error.message', 'userMessage']);
          if (hasCatch && hasFriendly) return { passed: true, score: 5, maxScore: 5, message: '检测到错误处理和用户友好错误信息' };
          if (hasCatch) return { passed: true, score: 3, maxScore: 5, message: '检测到错误处理代码，建议添加用户友好错误信息' };
          return { passed: false, score: 1, maxScore: 5, message: '未检测到错误处理', suggestion: '为所有异步操作添加 try/catch 和错误边界' };
        },
      },
      {
        id: '2.5',
        name: '回退策略',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 4, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasFallback = searchInFiles(opts.agentPath, ['fallback', 'Fallback', 'default', 'graceful']);
          if (hasFallback) return { passed: true, score: 3, maxScore: 4, message: '检测到回退策略代码' };
          return { passed: false, score: 0, maxScore: 4, message: '未检测到回退策略', suggestion: '为关键功能添加降级/回退方案' };
        },
      },
      {
        id: '2.6',
        name: '并发安全',
        maxScore: 5,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 5, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasLock = searchInFiles(opts.agentPath, ['Mutex', 'Semaphore', 'lock', 'Lock', 'queue', 'mutex']);
          const hasAsync = searchInFiles(opts.agentPath, ['async ', 'await ']);
          if (hasLock && hasAsync) return { passed: true, score: 5, maxScore: 5, message: '检测到 async/await + 并发控制机制' };
          if (hasAsync) return { passed: false, score: 2, maxScore: 5, message: '使用了 async/await 但未检测到锁机制', suggestion: '对共享资源添加 Mutex/Semaphore 保护' };
          return { passed: false, score: 0, maxScore: 5, message: '未检测到并发安全措施', suggestion: '添加并发控制机制保护共享状态' };
        },
      },
      {
        id: '2.7',
        name: '资源泄漏',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 4, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasCleanup = searchInFiles(opts.agentPath, ['finally', '.close()', '.destroy()', 'dispose', 'cleanup', 'onDispose']);
          if (hasCleanup) return { passed: true, score: 4, maxScore: 4, message: '检测到资源清理代码' };
          return { passed: false, score: 1, maxScore: 4, message: '未检测到资源清理逻辑', suggestion: '添加 finally 块 / dispose 方法确保资源释放' };
        },
      },
    ],
  },

  observability: {
    name: '可观测性',
    emoji: '📡',
    weight: 20,
    checks: [
      {
        id: '3.1',
        name: '结构化日志',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 4, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasLogger = searchInFiles(opts.agentPath, ['winston', 'pino', 'bunyan', 'log4js', 'logger', 'createLogger', 'structured']);
          const hasJsonLog = searchInFiles(opts.agentPath, ['JSON.stringify', 'log.json', 'json_log']);
          let score = 0;
          if (hasLogger) score += 3;
          if (hasJsonLog) score += 1;
          return {
            passed: score >= 3,
            score: Math.min(score, 4),
            maxScore: 4,
            message: hasLogger ? (hasJsonLog ? '检测到结构化日志库和 JSON 日志格式' : '检测到日志库，建议使用 JSON 格式') : '未检测到结构化日志',
            suggestion: !hasLogger ? '使用 winston/pino 等结构化日志库' : (!hasJsonLog ? '输出 JSON 格式日志便于采集和分析' : undefined),
          };
        },
      },
      {
        id: '3.2',
        name: '追踪ID',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 4, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasTrace = searchInFiles(opts.agentPath, ['traceId', 'trace_id', 'requestId', 'request_id', 'correlationId', 'x-trace', 'spanId']);
          if (hasTrace) return { passed: true, score: 4, maxScore: 4, message: '检测到追踪ID实现' };
          return { passed: false, score: 0, maxScore: 4, message: '未检测到追踪ID', suggestion: '为每个请求/决策生成唯一 traceId 并贯穿日志' };
        },
      },
      {
        id: '3.3',
        name: '决策记录',
        maxScore: 5,
        async run(opts) {
          await ensureSDK();
          if (!_sdkHealthy) return { passed: false, score: 0, maxScore: 5, message: `SDK 不可用: ${_sdkError}` };
          try {
            const box = _sdkBox!;
            await box.record({ input: { question: 'test' }, output: { answer: 'result' } });
            const report = box.generateReport();
            if (report.summary.totalDecisions > 0) return { passed: true, score: 5, maxScore: 5, message: `决策记录正常（已记录 ${report.summary.totalDecisions} 条）` };
            return { passed: false, score: 2, maxScore: 5, message: 'SDK 可用但决策记录为空', suggestion: '确保每次 Agent 决策都调用 record() 方法' };
          } catch (e) {
            return { passed: false, score: 0, maxScore: 5, message: `决策记录异常: ${e instanceof Error ? e.message : String(e)}` };
          }
        },
      },
      {
        id: '3.4',
        name: '性能指标',
        maxScore: 4,
        async run(opts) {
          if (!opts.agentPath) {
            // 回退到 SDK 性能测试
            await ensureSDK();
            if (!_sdkHealthy) return { passed: false, score: 0, maxScore: 4, message: `SDK 不可用: ${_sdkError}` };
            const box = new LobsterBlackbox({ agentId: 'perf-eval' });
            const start = Date.now();
            for (let i = 0; i < 100; i++) await box.record({ input: { i }, output: { ok: true } });
            const duration = Date.now() - start;
            const perRecord = duration / 100;
            if (perRecord < 5) return { passed: true, score: 4, maxScore: 4, message: `录制性能良好 (${perRecord.toFixed(2)}ms/条)` };
            if (perRecord < 10) return { passed: false, score: 2, maxScore: 4, message: `录制性能中等 (${perRecord.toFixed(2)}ms/条)`, suggestion: '优化录制逻辑减少延迟' };
            return { passed: false, score: 0, maxScore: 4, message: `录制性能较差 (${perRecord.toFixed(2)}ms/条)`, suggestion: '重大性能优化需要' };
          }
          const hasMetrics = searchInFiles(opts.agentPath, ['prometheus', 'statsd', 'datadog', 'metrics', 'histogram', 'counter', 'gauge']);
          if (hasMetrics) return { passed: true, score: 4, maxScore: 4, message: '检测到性能指标采集代码' };
          return { passed: false, score: 1, maxScore: 4, message: '未检测到性能指标', suggestion: '集成 prom-client / datadog 等指标采集库' };
        },
      },
      {
        id: '3.5',
        name: '告警机制',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 3, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasAlert = searchInFiles(opts.agentPath, ['alert', 'Alert', 'webhook', 'pagerduty', 'slack', 'notify', 'onError']);
          if (hasAlert) return { passed: true, score: 3, maxScore: 3, message: '检测到告警/通知代码' };
          return { passed: false, score: 0, maxScore: 3, message: '未检测到告警机制', suggestion: '添加错误告警（Webhook / Slack / 邮件）' };
        },
      },
    ],
  },

  compliance: {
    name: '合规就绪',
    emoji: '📜',
    weight: 15,
    checks: [
      {
        id: '4.1',
        name: '数据脱敏',
        maxScore: 3,
        async run(opts) {
          await ensureSDK();
          if (!_sdkHealthy) return { passed: false, score: 0, maxScore: 3, message: `SDK 不可用: ${_sdkError}` };
          try {
            const redactor = new Redactor({ patterns: ['email', 'phone', 'creditCard', 'ssn', 'idCard'] });
            const cases = [
              { input: 'test@example.com', name: 'email' },
              { input: '13812345678', name: 'phone' },
              { input: '4111111111111111', name: 'card' },
            ];
            let passed = 0;
            for (const tc of cases) {
              const redacted = redactor.redactString(tc.input);
              if (redacted.includes('[REDACTED]') && !redacted.includes(tc.input)) passed++;
            }
            if (passed === cases.length) return { passed: true, score: 3, maxScore: 3, message: '所有敏感数据脱敏正确' };
            return { passed: false, score: passed, maxScore: 3, message: `${passed}/${cases.length} 种敏感数据脱敏正确`, suggestion: '确保所有 PII 类型都配置了脱敏规则' };
          } catch (e) {
            return { passed: false, score: 0, maxScore: 3, message: `脱敏检测异常: ${e instanceof Error ? e.message : String(e)}` };
          }
        },
      },
      {
        id: '4.2',
        name: '审计日志',
        maxScore: 3,
        async run(opts) {
          await ensureSDK();
          if (!_sdkHealthy) return { passed: false, score: 0, maxScore: 3, message: `SDK 不可用: ${_sdkError}` };
          try {
            const box = _sdkBox!;
            // 检查 SDK 是否有签名/审计能力
            const keys = Signer.generateKeyPair();
            const signer = new Signer(keys.secretKey);
            const sig = signer.sign('audit-trail');
            const hasAudit = sig.length > 0 && Signer.verify('audit-trail', sig, keys.publicKey);
            if (hasAudit) return { passed: true, score: 3, maxScore: 3, message: '审计签名链可用' };
            return { passed: false, score: 1, maxScore: 3, message: '审计签名链异常', suggestion: '确保每次决策都被签名记录' };
          } catch (e) {
            return { passed: false, score: 0, maxScore: 3, message: `审计日志检测异常: ${e instanceof Error ? e.message : String(e)}` };
          }
        },
      },
      {
        id: '4.3',
        name: '数据保留',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 3, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasRetention = searchInFiles(opts.agentPath, ['retention', 'ttl', 'TTL', 'expire', 'Expire', 'cleanup', 'purge', 'retentionPolicy']);
          if (hasRetention) return { passed: true, score: 3, maxScore: 3, message: '检测到数据保留策略' };
          return { passed: false, score: 0, maxScore: 3, message: '未检测到数据保留策略', suggestion: '配置数据 TTL / 定期清理机制' };
        },
      },
      {
        id: '4.4',
        name: '用户同意',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 3, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasConsent = searchInFiles(opts.agentPath, ['consent', 'Consent', 'opt-in', 'optIn', 'agreement', 'gdpr']);
          if (hasConsent) return { passed: true, score: 3, maxScore: 3, message: '检测到用户同意/合规相关代码' };
          return { passed: false, score: 0, maxScore: 3, message: '未检测到用户同意机制', suggestion: '添加用户同意确认流程和数据使用授权' };
        },
      },
      {
        id: '4.5',
        name: '跨境合规',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 3, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasCrossBorder = searchInFiles(opts.agentPath, ['gdpr', 'GDPR', 'ccpa', 'CCPA', 'data-residency', 'cross-border', 'sovereignty']);
          if (hasCrossBorder) return { passed: true, score: 3, maxScore: 3, message: '检测到跨境合规相关配置' };
          return { passed: false, score: 1, maxScore: 3, message: '未检测到跨境合规措施', suggestion: '根据业务地区添加 GDPR/CCPA 等合规措施' };
        },
      },
    ],
  },

  explainability: {
    name: '可解释性',
    emoji: '💡',
    weight: 10,
    checks: [
      {
        id: '5.1',
        name: '推理记录',
        maxScore: 4,
        async run(opts) {
          await ensureSDK();
          if (!_sdkHealthy) return { passed: false, score: 0, maxScore: 4, message: `SDK 不可用: ${_sdkError}` };
          try {
            const box = _sdkBox!;
            await box.record({
              input: { question: 'what is 1+1?', context: 'math' },
              output: { answer: '2', reasoning: 'basic arithmetic' },
            });
            const report = box.generateReport();
            // 检查报告是否包含决策细节
            if (report.summary.totalDecisions > 0) return { passed: true, score: 4, maxScore: 4, message: '推理记录可正常生成' };
            return { passed: false, score: 1, maxScore: 4, message: '报告未包含决策详情', suggestion: '确保 record() 中包含 reasoning 字段' };
          } catch (e) {
            return { passed: false, score: 0, maxScore: 4, message: `推理记录异常: ${e instanceof Error ? e.message : String(e)}` };
          }
        },
      },
      {
        id: '5.2',
        name: '决策依据',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return dynamicTestCheck(3, '决策依据', '需要检查 Agent 是否在输出中包含决策依据');
          const hasReasoning = searchInFiles(opts.agentPath, ['reasoning', 'rationale', 'explain', 'because', 'reason', 'justification']);
          if (hasReasoning) return { passed: true, score: 3, maxScore: 3, message: '检测到决策依据/解释性代码' };
          return { passed: false, score: 0, maxScore: 3, message: '未检测到决策依据输出', suggestion: '在 Agent 输出中添加 reasoning / rationale 字段' };
        },
      },
      {
        id: '5.3',
        name: '置信度标注',
        maxScore: 3,
        async run(opts) {
          if (!opts.agentPath) return { passed: false, score: 0, maxScore: 3, message: '未指定 Agent 路径', suggestion: '使用 --agent-path 指定 Agent 目录' };
          const hasConfidence = searchInFiles(opts.agentPath, ['confidence', 'score', 'probability', 'certainty']);
          if (hasConfidence) return { passed: true, score: 3, maxScore: 3, message: '检测到置信度相关代码' };
          return { passed: false, score: 1, maxScore: 3, message: '未检测到置信度标注', suggestion: '为 Agent 输出添加 confidence 字段（0-1 或 0-100）' };
        },
      },
    ],
  },
};

// ============================================================
// Helper: dependency / file search
// ============================================================

function checkDependency(agentPath: string, deps: string[]): boolean {
  try {
    const pkgPath = path.join(agentPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    return deps.some(d => d in all);
  } catch {
    return false;
  }
}

function searchInFiles(dir: string, keywords: string[]): boolean {
  try {
    const extensions = ['.ts', '.js', '.mjs', '.cjs', '.yaml', '.yml', '.json'];
    const files = walkDir(dir).filter(f => extensions.some(ext => f.endsWith(ext)));
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        if (keywords.some(kw => content.includes(kw))) return true;
      } catch { /* skip unreadable files */ }
    }
  } catch { /* skip inaccessible dirs */ }
  return false;
}

function walkDir(dir: string, maxDepth = 4, depth = 0): string[] {
  if (depth > maxDepth) return [];
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walkDir(fullPath, maxDepth, depth + 1));
      else results.push(fullPath);
    }
  } catch { /* skip */ }
  return results;
}

// ============================================================
// Evaluation Engine
// ============================================================

async function runEvaluation(options: EvalOptions = {}): Promise<EvalReport> {
  const dimensionResults: DimensionResult[] = [];
  const allSuggestions: EvalReport['suggestions'] = [];

  for (const [key, dim] of Object.entries(DIMENSIONS)) {
    const checks: (CheckItem & { id: string; name: string })[] = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const check of dim.checks) {
      const result = await check.run(options);
      const item = { ...result, id: check.id, name: check.name };
      checks.push(item);
      totalScore += result.score;
      maxScore += result.maxScore;

      // Collect suggestions with priority
      if (result.suggestion && result.score < result.maxScore) {
        const gain = result.maxScore - result.score;
        const priority = gain >= 3 ? 'P0' : gain >= 2 ? 'P1' : 'P2';
        allSuggestions.push({
          priority,
          text: result.suggestion,
          dimension: dim.name,
          scoreGain: gain,
        });
      }
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const weightedScore = maxScore > 0 ? (totalScore / maxScore) * dim.weight : 0;

    dimensionResults.push({
      key,
      name: dim.name,
      emoji: dim.emoji,
      weight: dim.weight,
      totalScore,
      maxScore,
      weightedScore,
      percentage,
      checks,
    });
  }

  const totalScore = Math.round(dimensionResults.reduce((sum, d) => sum + d.weightedScore, 0));
  const { grade, label } = gradeLabel(totalScore);

  // Sort suggestions by priority (P0 first) and score gain
  allSuggestions.sort((a, b) => {
    const pOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    return b.scoreGain - a.scoreGain;
  });

  return {
    timestamp: new Date().toISOString(),
    agentPath: options.agentPath,
    totalScore,
    grade,
    gradeLabel: label,
    dimensions: dimensionResults,
    suggestions: allSuggestions,
  };
}

// ============================================================
// Output Formatters
// ============================================================

function progressBar(percentage: number, width = 10): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatTextReport(report: EvalReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('🦞 ═══════════════════════════════════════════════');
  lines.push('   龙虾学院 · Agent 评测报告');
  lines.push(`   Agent: ${report.agentPath || 'lobster-blackbox (SDK 自检)'}`);
  lines.push(`   时间: ${report.timestamp}`);
  lines.push('═════════════════════════════════════════════════');
  lines.push('');

  // Total score
  lines.push(`📊 总评: ${report.totalScore}分 → ${report.grade}级（${report.gradeLabel.split('—')[0]?.trim() || ''}）`);
  lines.push(`   ${report.gradeLabel.split('—')[1]?.trim() || report.gradeLabel}`);
  lines.push('');

  // Dimension scores
  lines.push('📋 维度评分:');
  for (const dim of report.dimensions) {
    const bar = progressBar(dim.percentage);
    const scoreStr = `${dim.totalScore}/${dim.maxScore}`.padStart(5);
    lines.push(`   ${dim.emoji} ${dim.name.padEnd(8)} [${bar}] ${scoreStr} (${dim.percentage}%)`);
  }
  lines.push('');

  // Detailed checks
  lines.push('🔍 详细检查:');
  for (const dim of report.dimensions) {
    lines.push(`   [${dim.name}]`);
    for (const check of dim.checks) {
      const icon = check.passed ? '✅' : (check.message.startsWith('⚠️') ? '⚠️' : '❌');
      lines.push(`   ${icon} ${check.id} ${check.name} (${check.score}/${check.maxScore}) — ${check.message}`);
      if (check.suggestion) {
        lines.push(`      💡 改进: ${check.suggestion}`);
      }
    }
    lines.push('');
  }

  // Suggestions
  if (report.suggestions.length > 0) {
    lines.push('🎯 提升建议（按优先级排序）:');
    for (let i = 0; i < report.suggestions.length; i++) {
      const s = report.suggestions[i];
      lines.push(`   ${i + 1}. [${s.priority}] ${s.text} → ${s.dimension} +${s.scoreGain}分`);
    }
    lines.push('');
  }

  lines.push('═════════════════════════════════════════════════');
  lines.push('🦞 评测完成 — 由龙虾学院工部技术组提供');
  lines.push('');

  return lines.join('\n');
}

function formatJsonReport(report: EvalReport): string {
  return JSON.stringify(report, null, 2);
}

// ============================================================
// CLI Entry
// ============================================================

function printHelp(): void {
  console.log(`
🦞 lobster-check — 龙虾学院 Agent 评测工具

用法:
  lobster-check [agent-path] [选项]
  lobster-check --agent-path <path> --format json --output report.json

选项:
  --agent-path <path>    指定 Agent 项目目录（也支持位置参数）
  --format <fmt>         输出格式: text (默认), json
  --output <file>        输出文件路径（默认输出到终端）
  --help                 显示此帮助信息

示例:
  lobster-check ./my-agent
  lobster-check ./my-agent --format json --output report.json
  lobster-check --agent-path ./my-agent --format json
  lobster-check --help

25项评测维度:
  🔒 安全性 (30%)    — 工具白名单、密钥管理、输入验证等
  🛡️ 可靠性 (25%)    — 超时处理、重试机制、熔断等
  📡 可观测性 (20%)  — 结构化日志、追踪ID、性能指标等
  📜 合规就绪 (15%)  — 数据脱敏、审计日志、用户同意等
  💡 可解释性 (10%)  — 推理记录、决策依据、置信度等
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  let agentPath: string | undefined;
  let outputPath: string | undefined;
  let format: 'text' | 'json' = 'text';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[++i];
    } else if (args[i] === '--format' && args[i + 1]) {
      const fmt = args[++i].toLowerCase();
      if (fmt === 'json') format = 'json';
      else if (fmt === 'text') format = 'text';
      else {
        console.error(`❌ 不支持的格式: ${fmt}（支持 text, json）`);
        process.exit(1);
      }
    } else if (args[i] === '--agent-path' && args[i + 1]) {
      agentPath = args[++i];
    } else if (args[i].startsWith('-')) {
      console.error(`❌ 未知选项: ${args[i]}\n使用 --help 查看可用选项`);
      process.exit(1);
    } else if (!agentPath) {
      agentPath = args[i];
    }
  }

  // Validate output path directory exists
  if (outputPath) {
    const outputDir = path.dirname(outputPath);
    if (outputDir !== '.' && !fs.existsSync(outputDir)) {
      console.error(`❌ 输出目录不存在: ${outputDir}`);
      process.exit(1);
    }
  }

  // Run evaluation
  console.log('');
  console.log('🦞 龙虾学院评测系统启动中...');
  console.log('');

  const report = await runEvaluation({ agentPath });

  // Format output
  let output: string;
  if (format === 'json') {
    output = formatJsonReport(report);
  } else {
    output = formatTextReport(report);
  }

  // Output
  if (outputPath) {
    fs.writeFileSync(outputPath, output, 'utf-8');
    console.log(`📄 报告已保存: ${outputPath}`);
  } else {
    console.log(output);
  }
}

main().catch(err => {
  console.error('❌ 评测失败:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
