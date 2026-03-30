/**
 * 龙虾学院 Blackbox SDK — 端到端演示
 * 展示完整的录制 → 脱敏 → 签名 → 报告 流程
 */

import { LobsterBlackbox } from '../src/index';

async function demo() {
  console.log('🦞 龙虾学院 Blackbox SDK — 端到端演示\n');

  // Step 1: 生成密钥对
  console.log('═══ Step 1: 生成 Ed25519 密钥对 ═══');
  const keys = LobsterBlackbox.generateKeyPair();
  console.log(`  公钥: ${keys.publicKey.substring(0, 40)}...`);
  console.log(`  私钥: ${keys.secretKey.substring(0, 40)}...`);
  console.log('');

  // Step 2: 初始化黑匣子
  console.log('═══ Step 2: 初始化黑匣子 ═══');
  const box = new LobsterBlackbox({
    agentId: 'demo-agent-001',
    mode: 'local',
    redact: {
      patterns: ['email', 'phone', 'creditCard'],
    },
    signingKey: keys.secretKey,
  });
  console.log('  ✅ 黑匣子已就绪');
  console.log('');

  // Step 3: 模拟Agent决策并录制
  console.log('═══ Step 3: 录制Agent决策 ═══');

  // 决策1: 用户查询
  const r1 = await box.record({
    type: 'decision',
    input: { userMessage: '请查询我的订单状态' },
    reasoning: '用户要求查询订单，需要调用订单系统',
    output: { orderStatus: '已发货', trackingNo: 'SF1234567890' },
    toolCalls: [{
      tool: 'order_api',
      params: { userId: 'user-123' },
      result: '{"status":"shipped"}',
      duration: 230,
    }],
    duration: 450,
  });
  console.log(`  ✅ 决策1: ${r1.id} (hash: ${r1.hash?.substring(0, 16)}...)`);

  // 决策2: 邮件发送（含PII，需要脱敏）
  const r2 = await box.record({
    type: 'decision',
    input: { userMessage: '发邮件给张三 zhang.san@example.com，电话 138-1234-5678' },
    reasoning: '检测到邮件发送请求，收件人信息需脱敏',
    output: { action: 'send_email', to: '[REDACTED]', status: 'queued' },
    toolCalls: [{
      tool: 'email_api',
      params: { to: 'zhang.san@example.com', subject: '通知' },
      result: 'sent',
      duration: 890,
    }],
    duration: 1200,
  });
  console.log(`  ✅ 决策2: ${r2.id} (已脱敏PII)`);

  // 决策3: 错误处理
  const r3 = await box.record({
    type: 'error',
    input: { action: '支付', amount: 100 },
    reasoning: '调用支付接口失败',
    output: { error: '支付网关超时' },
    duration: 15000,
  });
  console.log(`  ✅ 决策3: ${r3.id} (错误记录)`);
  console.log('');

  // Step 4: 验证脱敏
  console.log('═══ Step 4: 验证脱敏 ═══');
  console.log(`  输入: "${r2.input.userMessage}"`);
  console.log(`  → email 被脱敏: ${!(r2.input.userMessage as string).includes('zhang.san@example.com')}`);
  console.log(`  → phone 被脱敏: ${!(r2.input.userMessage as string).includes('138-1234-5678')}`);
  console.log('');

  // Step 5: 生成报告
  console.log('═══ Step 5: 生成审计报告 ═══');
  const report = box.generateReport();
  console.log(box.toText(report));
  console.log('');

  // Step 6: 验证签名
  console.log('═══ Step 6: 验证报告签名 ═══');
  if (report.signature) {
    const valid = LobsterBlackbox.verifyReport(report, keys.publicKey);
    console.log(`  签名验证: ${valid ? '✅ 有效 — 报告未被篡改' : '❌ 无效 — 报告可能被篡改'}`);
  }
  console.log('');

  // Step 7: JSON输出
  console.log('═══ Step 7: JSON报告（截取前500字符）═══');
  const json = box.toJSON(report);
  console.log(json.substring(0, 500) + '...');
  console.log('');

  console.log('🎉 演示完成！');
  console.log('📦 SDK功能：录制 ✅ | 脱敏 ✅ | 签名 ✅ | 报告 ✅ | 验证 ✅');
}

demo().catch(console.error);
