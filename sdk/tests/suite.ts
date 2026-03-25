/**
 * 龙虾学院 Blackbox — 零 Bug 测试套件
 * 覆盖所有边界条件、异常路径、安全场景
 */

import { LobsterBlackbox } from '../src/index';
import { Recorder } from '../src/recorder';
import { Redactor } from '../src/redactor';
import { Signer } from '../src/signer';
import { Reporter } from '../src/reporter';
import { BlackboxError, BlackboxErrorCode } from '../src/errors';

// --- 测试框架 ---
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
    failures.push(name);
  }
}

function assertEqual<T>(actual: T, expected: T, name: string): void {
  assert(actual === expected, `${name} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function assertThrows(fn: () => void, name: string, expectedMessage?: string): void {
  try {
    fn();
    assert(false, `${name} (expected to throw but didn't)`);
  } catch (e) {
    if (expectedMessage) {
      const msg = e instanceof Error ? e.message : String(e);
      assert(msg.includes(expectedMessage), `${name} (throw message contains "${expectedMessage}")`);
    } else {
      assert(true, name);
    }
  }
}

function assertNoThrow(fn: () => void, name: string): void {
  try {
    fn();
    assert(true, name);
  } catch (e) {
    assert(false, `${name} (unexpected throw: ${e instanceof Error ? e.message : String(e)})`);
  }
}

function section(name: string): void {
  console.log(`\n📋 ${name}`);
}

// ============================================================
async function runTests(): Promise<void> {
  console.log('🦞 龙虾学院 Blackbox — 零 Bug 测试套件\n');
  console.log('═══════════════════════════════════════════════════\n');

  // ==================
  // 1. Redactor 脱敏模块
  // ==================
  section('1. Redactor — 基础脱敏');

  const redactor = new Redactor({ patterns: ['email', 'phone', 'creditCard', 'idCard'] });

  // 基础脱敏
  const r1 = redactor.redactString('联系邮箱 test@example.com');
  assert(!r1.includes('test@example.com'), '邮箱脱敏');
  assert(r1.includes('[REDACTED]'), '替换标记');

  const r2 = redactor.redactString('电话 138-1234-5678');
  assert(!r2.includes('138-1234-5678'), '手机号脱敏');

  const r3 = redactor.redactString('卡号 4111-1111-1111-1111');
  assert(!r3.includes('4111-1111-1111-1111'), '信用卡脱敏');

  section('1.1 Redactor — 对象深度脱敏');

  const obj = { user: { email: 'a@b.com', name: '张三' } };
  const redactedObj = redactor.redactObject(obj);
  assert(!JSON.stringify(redactedObj).includes('a@b.com'), '嵌套邮箱脱敏');
  assert(redactedObj.user.name === '张三', '非敏感字段保留');
  // 验证原始对象未被修改（Bug #2 修复验证）
  assert(obj.user.email === 'a@b.com', '原始对象不被修改');

  section('1.2 Redactor — 敏感字段名自动脱敏');

  const sensitiveTests = [
    { input: { apiKey: 'sk-123' }, expected: '[REDACTED]', name: 'apiKey' },
    { input: { api_key: 'sk-123' }, expected: '[REDACTED]', name: 'api_key' },
    { input: { password: 'secret' }, expected: '[REDACTED]', name: 'password' },
    { input: { token: 'abc' }, expected: '[REDACTED]', name: 'token' },
    { input: { secret: 'xyz' }, expected: '[REDACTED]', name: 'secret' },
    { input: { authorization: 'Bearer xxx' }, expected: '[REDACTED]', name: 'authorization' },
    { input: { APIKEY: 'upper' }, expected: '[REDACTED]', name: 'APIKEY (大写)' },
    { input: { Api_Key: 'mixed' }, expected: '[REDACTED]', name: 'Api_Key (混合)' },
  ];
  for (const tc of sensitiveTests) {
    const redacted = redactor.redactObject(tc.input);
    const value = Object.values(redacted)[0];
    assert(value === tc.expected, `敏感字段 ${tc.name}`);
  }

  // 非敏感字段保留
  const normalObj = { data: 'value', count: 42, flag: true };
  const redactedNormal = redactor.redactObject(normalObj);
  assert(redactedNormal.data === 'value', '普通字符串保留');
  assert(redactedNormal.count === 42, '数字保留');
  assert(redactedNormal.flag === true, '布尔保留');

  section('1.3 Redactor — hasPII 连续调用（Bug #1 修复验证）');

  // 连续调用 hasPII 不应因正则状态而误判
  const piiText = 'email test@example.com here';
  const result1 = redactor.hasPII(piiText);
  const result2 = redactor.hasPII(piiText);
  const result3 = redactor.hasPII(piiText);
  assertEqual(result1, true, 'hasPII 第1次');
  assertEqual(result2, true, 'hasPII 第2次');
  assertEqual(result3, true, 'hasPII 第3次');

  const noPiiText = 'no sensitive data here';
  assertEqual(redactor.hasPII(noPiiText), false, 'hasPII 无PII');
  assertEqual(redactor.hasPII(noPiiText), false, 'hasPII 无PII 连续');

  section('1.4 Redactor — 边界条件');

  // null/undefined
  assertEqual(redactor.redactObject(null), null, 'redactObject(null)');
  assertEqual(redactor.redactObject(undefined), undefined, 'redactObject(undefined)');

  // 非字符串输入
  assertEqual(redactor.redactString('' as any), '', '空字符串');
  assertEqual(redactor.redactObject(42 as any), 42, '数字输入');
  assertEqual(redactor.redactObject(true as any), true, '布尔输入');

  // 数组
  const arr = ['a@b.com', 'normal', 123];
  const redactedArr = redactor.redactObject(arr);
  assert(!redactedArr.includes('a@b.com'), '数组邮箱脱敏');
  assert(redactedArr.includes('normal'), '数组普通元素保留');
  assert(redactedArr.includes(123), '数组数字保留');

  // 深层嵌套
  const deep = { a: { b: { c: { d: { email: 'x@y.com' } } } } };
  const redactedDeep = redactor.redactObject(deep);
  assert(!JSON.stringify(redactedDeep).includes('x@y.com'), '深层嵌套脱敏');

  // 空对象
  assertEqual(JSON.stringify(redactor.redactObject({})), '{}', '空对象');

  section('1.5 Redactor — 自定义正则');

  const customRedactor = new Redactor({
    patterns: [],
    custom: [/内部编号[A-Z]{3}\d{4}/g],
  });
  const customResult = customRedactor.redactString('员工内部编号ABC1234已完成');
  assert(!customResult.includes('ABC1234'), '自定义正则脱敏');
  assert(customResult.includes('[REDACTED]'), '自定义替换标记');

  // 自定义替换字符串
  const customReplace = new Redactor({
    patterns: ['email'],
    replacement: '***',
  });
  const customReplResult = customReplace.redactString('email a@b.com');
  assert(customReplResult.includes('***'), '自定义替换字符串');
  assert(!customReplResult.includes('[REDACTED]'), '不使用默认标记');

  // ==================
  // 2. Signer 签名模块
  // ==================
  section('2. Signer — 基础签名');

  const keys = Signer.generateKeyPair();
  assert(keys.publicKey.length > 0, '公钥非空');
  assert(keys.secretKey.length > 0, '私钥非空');

  const signer = new Signer(keys.secretKey);
  const msg = 'test-message-123';
  const sig = signer.sign(msg);
  assert(sig.length > 0, '签名生成');
  assert(Signer.verify(msg, sig, keys.publicKey), '签名验证通过');

  section('2.1 Signer — 篡改检测');

  assert(!Signer.verify(msg + 'x', sig, keys.publicKey), '消息篡改检测');
  assert(!Signer.verify(msg, sig + 'x', keys.publicKey), '签名篡改检测');
  const wrongKeys = Signer.generateKeyPair();
  assert(!Signer.verify(msg, sig, wrongKeys.publicKey), '错误公钥检测');

  section('2.2 Signer — 边界条件');

  // 空字符串签名
  const emptySig = signer.sign('');
  assert(emptySig.length > 0, '空字符串可签名');
  assert(Signer.verify('', emptySig, keys.publicKey), '空字符串验证');

  // 长字符串签名
  const longMsg = 'x'.repeat(100000);
  const longSig = signer.sign(longMsg);
  assert(Signer.verify(longMsg, longSig, keys.publicKey), '长字符串验证');

  // Unicode
  const unicodeMsg = '你好🌍🎉测试';
  const unicodeSig = signer.sign(unicodeMsg);
  assert(Signer.verify(unicodeMsg, unicodeSig, keys.publicKey), 'Unicode验证');

  section('2.3 Signer — 参数校验（Bug #4 修复验证）');

  // verify 参数校验不抛异常
  assertEqual(Signer.verify(123 as any, sig, keys.publicKey), false, 'verify 非字符串data');
  assertEqual(Signer.verify(msg, 123 as any, keys.publicKey), false, 'verify 非字符串sig');
  assertEqual(Signer.verify(msg, sig, 123 as any), false, 'verify 非字符串key');
  assertEqual(Signer.verify(msg, '', keys.publicKey), false, 'verify 空sig');
  assertEqual(Signer.verify(msg, sig, ''), false, 'verify 空key');
  assertEqual(Signer.verify(msg, '!!!', keys.publicKey), false, 'verify 无效base64 sig');

  // setKey 校验
  assertThrows(() => signer.setKey(''), 'setKey 空字符串抛异常');
  assertThrows(() => signer.setKey('invalid'), 'setKey 无效key抛异常');

  // sign 无密钥
  const emptySigner = new Signer();
  assertThrows(() => emptySigner.sign('test'), 'sign 无密钥抛异常');

  section('2.4 Signer — 哈希');

  assertEqual(Signer.hash('hello'), Signer.hash('hello'), '哈希一致性');
  assert(Signer.hash('hello') !== Signer.hash('world'), '哈希区分性');
  assertEqual(Signer.hash(Buffer.from('hello')), Signer.hash('hello'), 'Buffer/string一致性');

  // ==================
  // 3. Recorder 录制模块
  // ==================
  section('3. Recorder — 构造校验（Bug #5 修复验证）');

  assertThrows(() => new Recorder({ agentId: '' }), '空agentId抛异常');
  assertThrows(() => new Recorder({ agentId: '   ' }), '空白agentId抛异常');
  assertThrows(() => new Recorder({ agentId: null as any }), 'null agentId抛异常');
  assertThrows(() => new Recorder({ agentId: undefined as any }), 'undefined agentId抛异常');
  assertNoThrow(() => new Recorder({ agentId: 'valid-id' }), '合法agentId不抛异常');
  assertNoThrow(() => new Recorder({ agentId: '  trimmed  ' }), '有空格agentId自动trim');

  section('3.1 Recorder — record() 参数校验');

  const recorder = new Recorder({ agentId: 'test-agent', signingKey: keys.secretKey });

  // 必需参数
  await assertRejects(() => recorder.record(null as any), 'record(null)抛异常');
  await assertRejects(() => recorder.record(undefined as any), 'record(undefined)抛异常');
  await assertRejects(() => recorder.record({ input: null, output: { a: 1 } } as any), 'input=null抛异常');
  await assertRejects(() => recorder.record({ input: { a: 1 }, output: null } as any), 'output=null抛异常');

  // 类型校验
  await assertRejects(() => recorder.record({ type: 'invalid' as any, input: {}, output: {} }), '无效type抛异常');
  await assertRejects(() => recorder.record({ input: {}, output: {}, duration: -1 }), '负duration抛异常');
  await assertRejects(() => recorder.record({ input: {}, output: {}, duration: NaN }), 'NaN duration抛异常');

  section('3.2 Recorder — 正常录制');

  const rec2 = new Recorder({ agentId: 'rec2', signingKey: keys.secretKey });
  const rec1 = await rec2.record({
    type: 'decision',
    input: { question: '测试' },
    reasoning: '推理过程',
    output: { answer: '回答' },
    duration: 100,
  });
  assert(rec1.id.length > 0, '记录ID');
  assertEqual(rec1.agentId, 'rec2', 'Agent ID');
  assert(rec1.timestamp.length > 0, '时间戳');
  assertEqual(rec1.type, 'decision', '类型');
  assert(rec1.hash?.length === 64, 'SHA256哈希长度64');
  assert(!!rec1.signature && rec1.signature.length > 0, '签名存在');
  assertEqual(rec2.count, 1, '计数器');

  // duration=0 是有效值（Bug #6 修复验证）
  await rec2.record({ input: { a: 1 }, output: { b: 2 }, duration: 0 });
  assertEqual(rec2.count, 2, 'duration=0录制后计数');

  section('3.3 Recorder — 批量录制');

  const rec3 = new Recorder({ agentId: 'batch-test' });
  await rec3.recordBatch([
    { input: { a: 1 }, output: { b: 2 } },
    { input: { a: 3 }, output: { b: 4 } },
  ]);
  assertEqual(rec3.count, 2, '批量录制计数');

  // 批量参数校验
  await assertRejects(() => recorder.recordBatch(null as any), 'recordBatch(null)抛异常');

  section('3.4 Recorder — getRecords 返回副本');

  const rec4 = new Recorder({ agentId: 'copy-test' });
  await rec4.record({ input: { a: 1 }, output: { b: 2 } });
  const records1 = rec4.getRecords();
  records1.push({} as any);
  const records2 = rec4.getRecords();
  assertEqual(records2.length, rec4.count, 'getRecords返回副本不影响内部');

  section('3.5 Recorder — 按类型筛选');

  const errors = recorder.getRecordsByType('error');
  assert(Array.isArray(errors), '返回数组');
  assertThrows(() => recorder.getRecordsByType('invalid' as any), '无效类型抛异常');

  section('3.6 Recorder — 脱敏集成');

  const redactRecorder = new Recorder({
    agentId: 'redact-test',
    redact: { patterns: ['email'] },
  });
  const piiRec = await redactRecorder.record({
    input: { user: 'user@test.com' },
    output: { sent: true },
  });
  assert(!JSON.stringify(piiRec.input).includes('user@test.com'), '录制时邮箱被脱敏');

  // ==================
  // 4. Reporter 报告模块
  // ==================
  section('4. Reporter — 构造校验');

  assertThrows(() => new Reporter('', signer), '空agentId抛异常');
  assertThrows(() => new Reporter('a', null as any), 'null signer抛异常');

  section('4.1 Reporter — 报告生成');

  const reporter = new Reporter('report-test', signer);
  const box = new LobsterBlackbox({ agentId: 'report-box' });
  
  // 准备12条记录（>10 才触发错误激增检测）
  for (let i = 0; i < 12; i++) {
    await box.record({
      type: i < 10 ? 'decision' : 'error',
      input: { i },
      output: { ok: i < 10 },
      duration: i * 100,
    });
  }

  const report = box.generateReport();
  assert(report.id.length > 0, '报告ID');
  assertEqual(report.agentId, 'report-box', '报告Agent ID');
  assertEqual(report.summary.totalDecisions, 12, '总决策数');
  assertEqual(report.summary.totalErrors, 2, '错误数');
  assert(report.generatedAt.length > 0, '生成时间');

  section('4.2 Reporter — 异常检测');

  // 12条记录中2个错误 = 16.7% > 10% → 触发错误激增
  const errorSpike = report.anomalies.find(a => a.type === 'error_spike');
  assert(errorSpike !== undefined, '错误激增检测');

  // 高延迟检测
  const slowBox = new LobsterBlackbox({ agentId: 'slow-box' });
  await slowBox.record({ input: {}, output: {}, duration: 15000 });
  const slowReport = slowBox.generateReport();
  const highLat = slowReport.anomalies.find(a => a.type === 'high_latency');
  assert(highLat !== undefined, '高延迟检测');
  assertEqual(highLat?.severity, 'high', '高延迟severity=high');

  // critical 延迟
  const criticalBox = new LobsterBlackbox({ agentId: 'critical-box' });
  await criticalBox.record({ input: {}, output: {}, duration: 35000 });
  const criticalReport = criticalBox.generateReport();
  const criticalLat = criticalReport.anomalies.find(a => a.type === 'high_latency');
  assertEqual(criticalLat?.severity, 'critical', '超长延迟severity=critical');

  section('4.3 Reporter — 边界条件');

  // 空记录报告
  const emptyBox = new LobsterBlackbox({ agentId: 'empty' });
  const emptyReport = emptyBox.generateReport();
  assertEqual(emptyReport.summary.totalDecisions, 0, '空报告总决策=0');
  assertEqual(emptyReport.summary.avgDuration, 0, '空报告avgDuration=0');
  assertEqual(emptyReport.anomalies.length, 0, '空报告无异常');

  // duration=0 被统计（Bug #6 修复验证）
  const zeroBox = new LobsterBlackbox({ agentId: 'zero' });
  await zeroBox.record({ input: {}, output: {}, duration: 0 });
  await zeroBox.record({ input: {}, output: {}, duration: 100 });
  const zeroReport = zeroBox.generateReport();
  assertEqual(zeroReport.summary.avgDuration, 50, 'duration=0被正确统计 (0+100)/2=50');

  section('4.4 Reporter — 签名验证');

  if (report.signature) {
    assert(LobsterBlackbox.verifyReport(report, keys.publicKey), '报告签名验证');
  }

  // 篡改报告
  const tamperedReport = { ...report, signature: 'invalid' };
  assert(!LobsterBlackbox.verifyReport(tamperedReport, keys.publicKey), '篡改报告拒绝');

  // 空签名
  const noSigReport = { ...report, signature: undefined };
  assert(!LobsterBlackbox.verifyReport(noSigReport, keys.publicKey), '无签名报告拒绝');

  section('4.5 Reporter — 参数校验');

  assertThrows(() => reporter.toJSON(null as any), 'toJSON(null)抛异常');
  assertThrows(() => reporter.toText(null as any), 'toText(null)抛异常');
  assertEqual(Reporter.verifyReport(null as any, keys.publicKey), false, 'verifyReport(null)返回false');
  assertEqual(Reporter.verifyReport(report, ''), false, 'verifyReport空key返回false');

  // ==================
  // 5. LobsterBlackbox 主类
  // ==================
  section('5. LobsterBlackbox — 集成');

  const mainBox = new LobsterBlackbox({
    agentId: 'main-test',
    redact: { patterns: ['email'] },
    signingKey: keys.secretKey,
  });

  await mainBox.record({
    input: { user: 'admin@test.com' },
    output: { result: 'ok' },
  });

  assertEqual(mainBox.count, 1, '主类录制');
  const mainReport = mainBox.generateReport();
  assertEqual(mainReport.summary.totalDecisions, 1, '主类报告');

  // JSON 输出
  const json = mainBox.toJSON(mainReport);
  assert(json.startsWith('{'), 'JSON格式正确');
  assert(JSON.parse(json).id === mainReport.id, 'JSON可解析');

  // 文本输出
  const text = mainBox.toText(mainReport);
  assert(text.includes('审计报告'), '文本包含标题');

  // clear
  mainBox.clear();
  assertEqual(mainBox.count, 0, '清空后计数为0');

  section('5.1 LobsterBlackbox — 静态方法');

  const staticKeys = LobsterBlackbox.generateKeyPair();
  assert(staticKeys.publicKey.length > 0, '静态generateKeyPair');

  // ==================
  // 6. 性能基准
  // ==================
  section('6. 性能');

  const perfBox = new LobsterBlackbox({ agentId: 'perf' });
  const perfStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    await perfBox.record({ input: { i }, output: { ok: true } });
  }
  const perfDur = Date.now() - perfStart;
  const perRec = perfDur / 1000;
  console.log(`  ℹ️ 录制: ${perRec.toFixed(2)}ms/条 (1000条/${perfDur}ms)`);
  assert(perRec < 10, '录制 < 10ms/条');

  const rptStart = Date.now();
  perfBox.generateReport();
  const rptDur = Date.now() - rptStart;
  console.log(`  ℹ️ 报告: ${rptDur}ms (1000条)`);
  assert(rptDur < 500, '报告 < 500ms');

  // ==================
  // 总结
  // ==================
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 测试结果: ${passed}✅ ${failed}❌ (共 ${passed + failed} 项)`);
  if (failed === 0) {
    console.log('🎉 零 Bug！全部通过！');
  } else {
    console.log(`\n❌ 失败项:`);
    for (const f of failures) {
      console.log(`   - ${f}`);
    }
    process.exit(1);
  }

  // ==================
  // 7. 配置验证
  // ==================
  section('7. 配置验证');

  // 空配置
  let threw = false;
  try { new LobsterBlackbox(null as any); } catch (e) { threw = e instanceof BlackboxError; }
  assert(threw, 'null配置抛BlackboxError');

  threw = false;
  try { new LobsterBlackbox(undefined as any); } catch (e) { threw = e instanceof BlackboxError; }
  assert(threw, 'undefined配置抛BlackboxError');

  // 空agentId
  threw = false;
  try { new LobsterBlackbox({ agentId: '' }); } catch (e) {
    threw = e instanceof BlackboxError && (e as BlackboxError).code === BlackboxErrorCode.MISSING_AGENT_ID;
  }
  assert(threw, '空agentId抛MISSING_AGENT_ID');

  // cloud模式无apiKey
  threw = false;
  try { new LobsterBlackbox({ agentId: 'test', mode: 'cloud' }); } catch (e) {
    threw = e instanceof BlackboxError && (e as BlackboxError).code === BlackboxErrorCode.MISSING_API_KEY;
  }
  assert(threw, 'cloud无apiKey抛MISSING_API_KEY');

  // cloud模式有apiKey不抛
  assertNoThrow(() => new LobsterBlackbox({ agentId: 'test', mode: 'cloud', apiKey: 'test-key' }), 'cloud有apiKey不抛异常');

  // maxRecords无效
  threw = false;
  try { new LobsterBlackbox({ agentId: 'test', maxRecords: -1 }); } catch (e) { threw = e instanceof BlackboxError; }
  assert(threw, '负数maxRecords抛异常');

  threw = false;
  try { new LobsterBlackbox({ agentId: 'test', maxRecords: NaN }); } catch (e) { threw = e instanceof BlackboxError; }
  assert(threw, 'NaN maxRecords抛异常');

  // maxInputSize无效
  threw = false;
  try { new LobsterBlackbox({ agentId: 'test', maxInputSize: 0 }); } catch (e) { threw = e instanceof BlackboxError; }
  assert(threw, 'zero maxInputSize抛异常');

  // 合法配置
  assertNoThrow(() => new LobsterBlackbox({ agentId: 'valid' }), '合法最小配置不抛异常');
  assertNoThrow(() => new LobsterBlackbox({ agentId: 'valid', maxRecords: 100, maxInputSize: 5000 }), '全参数配置不抛异常');

  section('7.1 BlackboxError');

  const err = new BlackboxError(BlackboxErrorCode.MISSING_AGENT_ID, 'test msg');
  assertEqual(err.code, BlackboxErrorCode.MISSING_AGENT_ID, 'error code');
  assertEqual(err.message, 'test msg', 'error message');
  assertEqual(err.name, 'BlackboxError', 'error name');
  const errJson = err.toJSON();
  assertEqual(errJson.code, BlackboxErrorCode.MISSING_AGENT_ID, 'toJSON code');
  assertEqual(errJson.message, 'test msg', 'toJSON message');

  // 错误链
  const cause = new Error('root cause');
  const chainErr = new BlackboxError(BlackboxErrorCode.UNKNOWN, 'wrapped', cause);
  assertEqual(chainErr.cause, cause, 'error cause');
  assertEqual(chainErr.toJSON().cause, 'root cause', 'toJSON cause');

  section('7.2 Reporter — Markdown 输出');

  const mdBox = new LobsterBlackbox({ agentId: 'md-test' });
  await mdBox.record({ input: { q: 'hello' }, output: { a: 'world' }, duration: 50 });
  const mdReport = mdBox.generateReport();
  const md = mdBox.toMarkdown(mdReport);
  assert(md.includes('# 🦞'), 'Markdown包含标题');
  assert(md.includes('📊 统计摘要'), 'Markdown包含统计');
  assert(md.includes('| 指标 | 数值 |'), 'Markdown包含表格');
  assert(md.includes('总决策数'), 'Markdown包含决策数');

  section('7.3 Reporter — 异常检测 Markdown');

  const md2Box = new LobsterBlackbox({ agentId: 'md2-test' });
  await md2Box.record({ input: {}, output: {}, duration: 15000 });
  const md2Report = md2Box.generateReport();
  const md2 = md2Box.toMarkdown(md2Report);
  assert(md2.includes('异常检测'), 'Markdown包含异常检测');
}

// 辅助：assertRejects for async
function assertRejects(fn: () => Promise<any>, name: string): Promise<void> {
  return fn().then(
    () => { assert(false, `${name} (expected to reject but didn't)`); },
    () => { assert(true, name); }
  );
}

// ============================================================
// 7. 对抗性评测引擎（从 adversarial-test 导入）
// ============================================================
import { runAdversarialTests } from './adversarial-test';

async function runAll(): Promise<void> {
  await runTests();

  // 注意：adversarial-test 有自己的测试框架和计数器，会独立输出结果
  console.log('\n\n');
  await runAdversarialTests();
}

runAll().catch(err => {
  console.error('测试框架异常:', err);
  process.exit(1);
});
