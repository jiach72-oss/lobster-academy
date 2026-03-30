/**
 * Agent护照系统测试
 */

import { PassportManager } from '../src/passport';
import { Signer } from '../src/signer';
import { AgentPassport } from '../src/types';

// 简易测试运行器
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.error(`  ❌ ${msg}`);
  }
}

console.log('\n🪞 Agent护照系统测试\n');
console.log('='.repeat(50));

// ─── 测试1: 创建护照 ─────────────────────────────────────────────────────────
console.log('\n📋 测试1: 创建护照');

const signer = new Signer();
const keyPair = Signer.generateKeyPair();
signer.setKey(keyPair.secretKey);

const pm = new PassportManager(signer);

const passport = pm.createPassport({
  agentId: 'test-agent-001',
  framework: { name: 'openclaw', version: '1.0.0' },
  model: { provider: 'anthropic', name: 'claude-3', version: '3.5' },
  tools: [
    { name: 'web-search', category: 'web-search', permissions: ['read'] },
    { name: 'code-exec', category: 'code-exec', permissions: ['execute'] },
  ],
  permissions: {
    maxTokens: 100000,
    allowedDomains: ['*'],
    deniedDomains: ['evil.com'],
    maxExecutionTime: 30000,
    sandboxed: true,
  },
});

assert(!!passport.passportId, 'passportId 存在');
assert(passport.agentId === 'test-agent-001', 'agentId 正确');
assert(passport.fingerprint.length === 16, `指纹长度为16 (实际: ${passport.fingerprint.length})`);
assert(!!passport.signature, '签名存在');
assert(passport.createdAt.length > 0, 'createdAt 存在');
assert(passport.framework.name === 'openclaw', '框架名正确');
assert(passport.model.provider === 'anthropic', '模型提供者正确');
assert(passport.tools.length === 2, `工具数量为2 (实际: ${passport.tools.length})`);
assert(passport.permissions.sandboxed === true, '沙箱模式正确');

// ─── 测试2: 指纹确定性 ──────────────────────────────────────────────────────
console.log('\n📋 测试2: 指纹确定性（相同输入 → 相同指纹）');

const passport2 = pm.createPassport({
  agentId: 'test-agent-001',
  framework: { name: 'openclaw', version: '1.0.0' },
  model: { provider: 'anthropic', name: 'claude-3', version: '3.5' },
  tools: [
    { name: 'web-search', category: 'web-search', permissions: ['read'] },
    { name: 'code-exec', category: 'code-exec', permissions: ['execute'] },
  ],
  permissions: {
    maxTokens: 100000,
    allowedDomains: ['*'],
    deniedDomains: ['evil.com'],
    maxExecutionTime: 30000,
    sandboxed: true,
  },
});

assert(passport.fingerprint === passport2.fingerprint, '相同配置产生相同指纹');

// ─── 测试3: 验证护照 ─────────────────────────────────────────────────────────
console.log('\n📋 测试3: 验证护照完整性');

const isValid = pm.verifyPassport(passport, keyPair.publicKey);
assert(isValid, '正确护照通过验证');

// 篡改指纹
const tampered = { ...passport, fingerprint: 'tampered12345678' };
const isTamperedValid = pm.verifyPassport(tampered, keyPair.publicKey);
assert(!isTamperedValid, '篡改指纹后验证失败');

// ─── 测试4: 变更检测 ─────────────────────────────────────────────────────────
console.log('\n📋 测试4: 变更检测');

// 模型升级
const modelChanges = pm.detectChanges(passport, {
  model: { provider: 'openai', name: 'gpt-4' },
});
assert(modelChanges.length > 0, '模型变更产生变更记录');
assert(modelChanges[0].changeType === 'model_upgrade', '变更类型为 model_upgrade');
assert(modelChanges[0].previousFingerprint === passport.fingerprint, '旧指纹正确');
assert(modelChanges[0].newFingerprint !== passport.fingerprint, '新指纹不同');

// 工具添加
const toolChanges = pm.detectChanges(passport, {
  tools: [
    ...passport.tools,
    { name: 'file-io', category: 'file-io', permissions: ['read', 'write'] },
  ],
});
assert(toolChanges.length > 0, '工具添加产生变更记录');
assert(toolChanges.some(c => c.changeType === 'tool_added'), '包含 tool_added 变更');

// 工具移除
const removeChanges = pm.detectChanges(passport, {
  tools: [passport.tools[0]], // 只保留第一个工具
});
assert(removeChanges.length > 0, '工具移除产生变更记录');
assert(removeChanges.some(c => c.changeType === 'tool_removed'), '包含 tool_removed 变更');

// 配置变更
const configChanges = pm.detectChanges(passport, {
  permissions: {
    ...passport.permissions,
    maxTokens: 500000,
    sandboxed: false,
  },
});
assert(configChanges.length > 0, '权限变更产生变更记录');
assert(configChanges.some(c => c.changeType === 'config_changed'), '包含 config_changed 变更');

// 框架升级
const fwChanges = pm.detectChanges(passport, {
  framework: { name: 'openclaw', version: '2.0.0' },
});
assert(fwChanges.length > 0, '框架升级产生变更记录');
assert(fwChanges[0].changeType === 'framework_upgrade', '变更类型为 framework_upgrade');

// 无变更
const noChanges = pm.detectChanges(passport, {});
assert(noChanges.length === 0, '无变更时返回空数组');

// ─── 测试5: 复测检查 ─────────────────────────────────────────────────────────
console.log('\n📋 测试5: 复测检查');

const retest1 = pm.needsRetest(passport, null);
assert(retest1.needed === true, '无历史评测时需要复测');
assert(retest1.scope === 'full', '无历史评测 → 全量复测');

// 最近的评测
const recentEval = {
  sequence: 1,
  timestamp: new Date().toISOString(),
  dimensions: {
    security: { score: 80, max: 100 },
    reliability: { score: 85, max: 100 },
    observability: { score: 90, max: 100 },
    compliance: { score: 75, max: 100 },
    explainability: { score: 70, max: 100 },
  },
  totalScore: 80,
  grade: 'B' as const,
};
const retest2 = pm.needsRetest(passport, recentEval);
assert(retest2.needed === false, '最近评测不需要复测');

// 过期的护照
const expiredPassport = pm.createPassport({
  agentId: 'expired-agent',
  framework: { name: 'test', version: '1.0' },
  model: { provider: 'test', name: 'test' },
  tools: [],
  permissions: {
    maxTokens: 1000,
    allowedDomains: [],
    deniedDomains: [],
    maxExecutionTime: 1000,
    sandboxed: true,
  },
  expiresAt: '2020-01-01T00:00:00.000Z',
});
const retest3 = pm.needsRetest(expiredPassport, recentEval);
assert(retest3.needed === true, '过期护照需要复测');
assert(retest3.scope === 'full', '过期 → 全量复测');

// ─── 测试6: 无签名器 ─────────────────────────────────────────────────────────
console.log('\n📋 测试6: 无签名器时的行为');

const pmNoSigner = new PassportManager();
const passportNoSig = pmNoSigner.createPassport({
  agentId: 'no-sig-agent',
  framework: { name: 'test', version: '1.0' },
  model: { provider: 'test', name: 'test' },
  tools: [],
  permissions: {
    maxTokens: 1000,
    allowedDomains: [],
    deniedDomains: [],
    maxExecutionTime: 1000,
    sandboxed: true,
  },
});
assert(!passportNoSig.signature, '无签名器时不产生签名');
assert(passportNoSig.fingerprint.length === 16, '指纹仍然正确生成');

// ─── 汇总 ─────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log(`\n🪞 测试完成: ${passed} 通过, ${failed} 失败\n`);

if (failed > 0) {
  process.exit(1);
}
