/**
 * Lobster Academy SDK 基础用法示例
 * 
 * 这个示例展示了如何使用 SDK 的核心功能：
 * 1. 录制 Agent 行为
 * 2. 脱敏敏感数据
 * 3. 运行评测
 * 4. 数字签名
 */

import { Recorder, Redactor, Academy, Signer } from 'lobster-academy';

// ============================================
// 1. 初始化组件
// ============================================

const recorder = new Recorder({ 
  agentId: 'example-agent',
  storage: 'memory' // 开发环境使用内存存储
});

const redactor = new Redactor();

const academy = new Academy({ agentId: 'example-agent' });

const keyPair = Signer.generateKeyPair();
const signer = new Signer(keyPair.secretKey);

console.log('✅ 组件初始化完成');
console.log('公钥:', keyPair.publicKey);
console.log('私钥:', keyPair.secretKey);

// ============================================
// 2. 脱敏示例
// ============================================

console.log('\n🔒 脱敏示例：');

// 脱敏字符串
const rawText = '我的邮箱是 user@example.com，手机 13800138000，身份证号 110101199001011234';
const safeText = redactor.redactString(rawText);
console.log('原始:', rawText);
console.log('脱敏后:', safeText);

// 脱敏对象
const userData = {
  username: '张三',
  email: 'zhangsan@example.com',
  phone: '13800138000',
  apiKey: 'sk-xxxxxxxxxxxxxxxxxxxx',
  address: '北京市朝阳区',
};

const safeUserData = redactor.redactObject(userData);
console.log('\n原始对象:', userData);
console.log('脱敏后:', safeUserData);

// 检查 PII
const testText = '这是一个普通文本';
console.log('\n检查PII:', testText, '->', redactor.hasPII(testText));

const piiText = '联系邮箱 test@example.com';
console.log('检查PII:', piiText, '->', redactor.hasPII(piiText));

// 获取 PII 详情
const matches = redactor.hasPIIWithConfidence('邮箱 test@example.com，电话 13800138000');
console.log('PII 详情:', matches);

// ============================================
// 3. 录制 Agent 行为
// ============================================

console.log('\n📹 录制示例：');

// 模拟 Agent 处理用户请求
async function simulateAgentRequest(userMessage: string) {
  // 脱敏用户输入
  const safeInput = redactor.redactString(userMessage);
  
  // 模拟 Agent 处理
  const response = {
    message: `已处理您的请求: ${safeInput}`,
    confidence: 0.95,
    actions: ['search', 'format'],
  };
  
  // 脱敏输出
  const safeOutput = redactor.redactObject(response);
  
  // 录制决策
  await recorder.record({
    type: 'decision',
    input: { userMessage: safeInput },
    reasoning: '用户发送消息，Agent 进行处理并返回结果',
    output: safeOutput,
    toolCalls: [
      {
        name: 'search',
        params: { query: safeInput },
        result: { items: ['结果1', '结果2'] },
        duration: 150,
      },
    ],
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
  
  return safeOutput;
}

// 模拟几次请求
await simulateAgentRequest('帮我查天气，我的位置在北京');
await simulateAgentRequest('搜索关于 AI 的最新文章');
await simulateAgentRequest('我的邮箱是 test@example.com，帮我发邮件');

// 获取录制的记录
const records = await recorder.getRecords();
console.log(`已录制 ${records.length} 条记录`);

// ============================================
// 4. 数字签名
// ============================================

console.log('\n📜 签名示例：');

// 创建一个记录
const record = {
  id: '123',
  action: 'test',
  timestamp: Date.now(),
  data: { key: 'value' },
};

// 签名
const signature = signer.sign(JSON.stringify(record));
console.log('原始记录:', record);
console.log('签名:', signature);

// 验证签名
const isValid = Signer.verify(
  JSON.stringify(record),
  signature,
  keyPair.publicKey
);
console.log('签名有效:', isValid);

// 篡改后验证
const tamperedRecord = { ...record, data: { key: 'hacked' } };
const isTamperedValid = Signer.verify(
  JSON.stringify(tamperedRecord),
  signature,
  keyPair.publicKey
);
console.log('篡改后签名有效:', isTamperedValid);

// ============================================
// 5. 运行评测
// ============================================

console.log('\n🎯 评测示例：');

const evalResult = await academy.evaluate();
console.log('评测结果:');
console.log('  总分:', evalResult.totalScore);
console.log('  等级:', evalResult.grade);
console.log('  维度:');
Object.entries(evalResult.dimensions).forEach(([dim, result]) => {
  console.log(`    ${dim}: ${result.score} (${result.grade})`);
});

// ============================================
// 6. 生成报告
// ============================================

console.log('\n📊 报告示例：');

const report = await academy.generateReport({
  from: '2026-03-01',
  to: '2026-03-31',
});

console.log('报告摘要:');
console.log('  总记录数:', report.summary.totalRecords);
console.log('  平均分:', report.summary.avgScore);
console.log('  异常数:', report.anomalies.length);

// ============================================
// 7. 完整示例：处理用户请求
// ============================================

console.log('\n🦞 完整示例：');

async function handleUserRequest(message: string) {
  console.log(`\n处理请求: "${message}"`);
  
  // 1. 脱敏输入
  const safeMessage = redactor.redactString(message);
  console.log('  1. 脱敏输入:', safeMessage);
  
  // 2. 模拟处理
  const response = {
    reply: `已收到您的消息: ${safeMessage}`,
    timestamp: new Date().toISOString(),
  };
  
  // 3. 脱敏输出
  const safeResponse = redactor.redactObject(response);
  console.log('  2. 脱敏输出:', safeResponse);
  
  // 4. 录制
  await recorder.record({
    type: 'decision',
    input: { message: safeMessage },
    output: safeResponse,
  });
  console.log('  3. 已录制');
  
  // 5. 签名（可选）
  const signature = signer.sign(JSON.stringify(safeResponse));
  console.log('  4. 已签名');
  
  return { response: safeResponse, signature };
}

// 处理几个请求
await handleUserRequest('你好，我的邮箱是 user@example.com');
await handleUserRequest('我的信用卡号是 4532015112830366');
await handleUserRequest('API密钥: sk-xxxxxxxxxxxxxxxxxxxx');

console.log('\n✅ 所有示例执行完成！');
console.log(`📊 总共录制了 ${(await recorder.getRecords()).length} 条记录`);
