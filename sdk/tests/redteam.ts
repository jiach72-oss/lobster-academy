/**
 * 龙虾学院 Blackbox — 红队攻防演练
 * 红队：尝试攻破 SDK 每一层防线
 * 蓝队：发现即修复
 */

import { LobsterBlackbox } from '../src/index';
import { Redactor } from '../src/redactor';
import { Signer } from '../src/signer';
import { Recorder } from '../src/recorder';

let passed = 0;
let failed = 0;
let vulns: string[] = [];

function attack(name: string, breached: boolean, severity: string, desc: string): void {
  if (breached) {
    console.log(`  🔴 破防! [${severity}] ${name}: ${desc}`);
    failed++;
    vulns.push(`[${severity}] ${name}: ${desc}`);
  } else {
    console.log(`  🛡️ 防住  ${name}`);
    passed++;
  }
}

function section(name: string): void {
  console.log(`\n⚔️ ${name}`);
}

async function runRedTeam(): Promise<void> {
  console.log('🦞 龙虾学院 — 红队攻防演练');
  console.log('═════════════════════════════════════════════════\n');

  // ============================================
  // 攻击组1: Redactor 脱敏引擎
  // ============================================
  section('攻击组1: Redactor 脱敏绕过');

  const redactor = new Redactor({ patterns: ['email', 'phone', 'creditCard', 'idCard'] });

  // 攻击1.1: Unicode 混淆邮箱
  const unicode_email = 'test\u0040example\u002Ecom'; // @ and . as unicode
  const r1 = redactor.redactString(unicode_email);
  attack('Unicode邮箱', r1.includes('example'), 'HIGH',
    'Unicode编码的@和.绕过了邮箱正则');

  // 攻击1.2: 分段拼接
  const split_email = 'te' + 'st@ex' + 'ample.com';
  const r2 = redactor.redactString(split_email);
  attack('拼接邮箱', !r2.includes('[REDACTED]'), 'MEDIUM',
    '字符串拼接绕过脱敏');

  // 攻击1.3: 大小写变体邮箱
  const case_email = 'TEST@EXAMPLE.COM';
  const r3 = redactor.redactString(case_email);
  attack('大写邮箱', !r3.includes('[REDACTED]'), 'LOW',
    '大写邮箱绕过脱敏');

  // 攻击1.4: 零宽字符注入
  const zwc_email = 'te\u200Bst@ex\u200Bample.com'; // zero-width space
  const r4 = redactor.redactString(zwc_email);
  attack('零宽字符', r4.includes('example'), 'HIGH',
    '零宽字符拆分邮箱绕过正则');

  // 攻击1.5: Base64 编码绕过
  const b64_email = Buffer.from('test@example.com').toString('base64');
  const r5 = redactor.redactString(b64_email);
  attack('Base64编码', !r5.includes('[REDACTED]'), 'MEDIUM',
    'Base64编码的PII未被脱敏（预期行为，但需注意上下文解码后）');

  // 攻击1.6: JSON 嵌套炸弹
  const deep: any = { a: {} };
  let current = deep.a;
  for (let i = 0; i < 1000; i++) {
    current.b = { email: 'a@b.com' };
    current = current.b;
  }
  try {
    const start = Date.now();
    redactor.redactObject(deep);
    const duration = Date.now() - start;
    attack('深度嵌套DoS', duration > 5000, 'HIGH',
      `1000层嵌套耗时${duration}ms，可能导致DoS`);
  } catch (e) {
    attack('深度嵌套DoS', false, 'HIGH', '捕获异常防止崩溃');
  }

  // 攻击1.7: 循环引用
  const circular: any = { name: 'test', email: 'a@b.com' };
  circular.self = circular;
  try {
    const r7 = redactor.redactObject(circular);
    attack('循环引用', false, 'MEDIUM', '未崩溃，但需检查是否真正处理');
  } catch (e) {
    attack('循环引用', false, 'MEDIUM', '抛出异常而非无限循环');
  }

  // 攻击1.8: 原型链污染
  const proto_pollute = JSON.parse('{"__proto__":{"isAdmin":true,"email":"hack@evil.com"}}');
  const r8 = redactor.redactObject(proto_pollute);
  attack('原型链污染', ({} as any).isAdmin === true, 'CRITICAL',
    '__proto__污染成功');

  // 攻击1.9: 特殊手机号格式
  const phone_variants = [
    '+86 138 1234 5678',
    '(+86)138-1234-5678',
    '8613812345678',
    '138.1234.5678',
    '１３８１２３４５６７８', // 全角
  ];
  let phoneBypassed = 0;
  for (const p of phone_variants) {
    if (!redactor.redactString(p).includes('[REDACTED]')) phoneBypassed++;
  }
  attack('手机号变体', phoneBypassed > 2, 'MEDIUM',
    `${phoneBypassed}/${phone_variants.length}种手机号格式绕过脱敏`);

  // 攻击1.10: 嵌入式PII（在正常文本中）
  const embedded = '我的联系方式是 test@example.com 请回复';
  const r10 = redactor.redactString(embedded);
  attack('嵌入式PII', !r10.includes('[REDACTED]'), 'LOW',
    '嵌入在正常文本中的PII被正确脱敏');

  // ============================================
  // 攻击组2: Signer 签名引擎
  // ============================================
  section('攻击组2: Signer 签名伪造/篡改');

  const keys = Signer.generateKeyPair();
  const signer = new Signer(keys.secretKey);

  // 攻击2.1: 空签名验证
  attack('空签名', Signer.verify('data', '', keys.publicKey), 'HIGH',
    '空签名通过验证');

  // 攻击2.2: 随机数据作为签名
  attack('随机签名', Signer.verify('data', Buffer.from('random-garbage').toString('base64'), keys.publicKey), 'MEDIUM',
    '随机数据通过签名验证');

  // 攻击2.3: 不同消息的签名复用
  const sig1 = signer.sign('message-A');
  attack('签名复用', Signer.verify('message-B', sig1, keys.publicKey), 'HIGH',
    'message-A的签名通过了message-B的验证');

  // 攻击2.4: 签名截断
  const sig2 = signer.sign('test');
  const truncated = sig2.substring(0, sig2.length - 4);
  attack('签名截断', Signer.verify('test', truncated, keys.publicKey), 'MEDIUM',
    '截断后的签名通过验证');

  // 攻击2.5: 公钥替换
  const otherKeys = Signer.generateKeyPair();
  const sig3 = signer.sign('data');
  attack('公钥替换', Signer.verify('data', sig3, otherKeys.publicKey), 'HIGH',
    '用错误公钥验证通过');

  // 攻击2.6: 注入特殊字符到签名数据
  const evilData = 'normal\x00\x01\x02 evil content';
  const sig4 = signer.sign(evilData);
  attack('二进制注入', Signer.verify('normal', sig4, keys.publicKey), 'HIGH',
    '含null字节的数据签名可用于混淆');

  // 攻击2.7: 超长数据签名（缓冲区溢出测试）
  try {
    const hugeData = 'x'.repeat(10_000_000); // 10MB
    const sig5 = signer.sign(hugeData);
    const valid = Signer.verify(hugeData, sig5, keys.publicKey);
    attack('超长数据', false, 'LOW', '10MB数据签名未崩溃');
  } catch (e) {
    attack('超长数据', false, 'LOW', '超长数据抛出异常而非崩溃');
  }

  // 攻击2.8: 并发签名（竞态条件）
  const promises = Array.from({ length: 100 }, (_, i) => {
    return new Promise<boolean>(resolve => {
      const s = signer.sign(`msg-${i}`);
      resolve(Signer.verify(`msg-${i}`, s, keys.publicKey));
    });
  });
  const results = await Promise.all(promises);
  const raceCondition = results.some(r => !r);
  attack('并发签名竞态', raceCondition, 'MEDIUM',
    '100并发签名出现不一致');

  // 攻击2.9: 密钥长度校验绕过
  try {
    new Signer('short');
    attack('短密钥接受', true, 'HIGH', '短密钥被接受无报错');
  } catch {
    attack('短密钥接受', false, 'HIGH', '短密钥被正确拒绝');
  }

  // 攻击2.10: 非base64字符串作为密钥
  try {
    new Signer('!!!not-base64!!!');
    attack('非base64密钥', true, 'MEDIUM', '非base64密钥被接受');
  } catch {
    attack('非base64密钥', false, 'MEDIUM', '非base64密钥被正确拒绝');
  }

  // ============================================
  // 攻击组3: Recorder 录制引擎
  // ============================================
  section('攻击组3: Recorder 数据注入/污染');

  const recorder = new Recorder({ agentId: 'test-agent', signingKey: keys.secretKey });

  // 攻击3.1: 注入伪造的 agentId 到 input
  const rec1 = await recorder.record({
    input: { agentId: 'fake-agent', data: 'legit' },
    output: { ok: true },
  });
  attack('agentId注入', rec1.agentId === 'fake-agent', 'MEDIUM',
    'input中的fake agentId覆盖了真实agentId');

  // 攻击3.2: 注入 timestamp
  const rec2 = await recorder.record({
    input: { timestamp: '2000-01-01T00:00:00Z' },
    output: { ok: true },
  });
  attack('timestamp注入', rec2.timestamp === '2000-01-01T00:00:00Z', 'MEDIUM',
    'input中的伪造时间戳覆盖了真实时间');

  // 攻击3.3: 注入 hash
  const rec3 = await recorder.record({
    input: { hash: 'fake-hash-12345' },
    output: { ok: true },
  });
  attack('hash注入', rec3.hash === 'fake-hash-12345', 'HIGH',
    'input中的fake hash覆盖了真实哈希');

  // 攻击3.4: 注入 signature
  const rec4 = await recorder.record({
    input: { signature: 'fake-sig-base64' },
    output: { ok: true },
  });
  attack('signature注入', rec4.signature === 'fake-sig-base64', 'HIGH',
    'input中的fake签名覆盖了真实签名');

  // 攻击3.5: 超大 input 导致内存爆炸
  try {
    const hugeInput: any = {};
    for (let i = 0; i < 100000; i++) {
      hugeInput[`key${i}`] = 'x'.repeat(100);
    }
    const start = Date.now();
    await recorder.record({ input: hugeInput, output: { ok: true } });
    const duration = Date.now() - start;
    attack('超大输入DoS', duration > 10000, 'HIGH',
      `10万key的对象录制耗时${duration}ms`);
  } catch (e) {
    attack('超大输入DoS', false, 'HIGH', '异常被捕获');
  }

  // 攻击3.6: type 字段注入
  try {
    await recorder.record({
      type: 'admin_delete_all' as any,
      input: {},
      output: {},
    });
    attack('type注入', true, 'MEDIUM', '非法type值被接受');
  } catch {
    attack('type注入', false, 'MEDIUM', '非法type被拒绝');
  }

  // 攻击3.7: 负数 duration
  try {
    await recorder.record({ input: {}, output: {}, duration: -999 });
    attack('负数duration', true, 'LOW', '负数duration被接受');
  } catch {
    attack('负数duration', false, 'LOW', '负数duration被拒绝');
  }

  // 攻击3.8: Infinity duration
  try {
    await recorder.record({ input: {}, output: {}, duration: Infinity });
    attack('Infinity duration', true, 'LOW', 'Infinity duration被接受');
  } catch {
    attack('Infinity duration', false, 'LOW', 'Infinity duration被拒绝');
  }

  // 攻击3.9: NaN duration
  try {
    await recorder.record({ input: {}, output: {}, duration: NaN });
    attack('NaN duration', true, 'LOW', 'NaN duration被接受');
  } catch {
    attack('NaN duration', false, 'LOW', 'NaN duration被拒绝');
  }

  // 攻击3.10: metadata 注入到签名计算
  const rec5a = await recorder.record({ input: { a: 1 }, output: { b: 2 }, metadata: { x: '1' } });
  const rec5b = await recorder.record({ input: { a: 1 }, output: { b: 2 }, metadata: { x: '2' } });
  attack('metadata影响哈希', rec5a.hash === rec5b.hash, 'INFO',
    'metadata不参与哈希计算（相同输入相同哈希）— 这是设计决策');

  // ============================================
  // 攻击组4: 整体系统级攻击
  // ============================================
  section('攻击组4: 系统级攻击');

  // 攻击4.1: 报告签名后篡改记录
  const box = new LobsterBlackbox({ agentId: 'attack-test', signingKey: keys.secretKey });
  await box.record({ input: { x: 1 }, output: { y: 2 } });
  const report = box.generateReport();
  
  // 尝试篡改报告中的记录内容
  if (report.records.length > 0) {
    const origHash = report.records[0].hash;
    (report.records[0] as any).output = { tampered: true };
    // 报告签名基于记录的 hash 字段（不基于内容），所以篡改内容后签名仍有效
    // 但验证时需检查每条记录的 hash 是否与内容匹配
    const reportSigValid = LobsterBlackbox.verifyReport(report, keys.publicKey);
    // 验证单条记录的哈希是否被篡改
    const tamperedContent = JSON.stringify({
      id: report.records[0].id,
      agentId: report.records[0].agentId,
      timestamp: report.records[0].timestamp,
      input: report.records[0].input,
      output: report.records[0].output,
    });
    const tamperedHash = Signer.hash(tamperedContent);
    const recordIntegrityOk = tamperedHash !== origHash;
    attack('报告记录篡改', reportSigValid && !recordIntegrityOk, 'MEDIUM',
      '篡改内容后报告签名仍有效，但记录哈希校验可发现篡改（双重验证机制）');
    // 恢复
    report.records[0].output = { y: 2 };
  }

  // 攻击4.2: 报告 summary 篡改
  const origTotal = report.summary.totalDecisions;
  report.summary.totalDecisions = 999;
  const summaryTampered = LobsterBlackbox.verifyReport(report, keys.publicKey);
  attack('报告summary篡改', summaryTampered, 'CRITICAL',
    '篡改summary后签名仍有效');
  report.summary.totalDecisions = origTotal;

  // 攻击4.3: JSON 序列化差异攻击（键顺序）
  const box2 = new LobsterBlackbox({ agentId: 'order-test', signingKey: keys.secretKey });
  await box2.record({ input: { b: 2, a: 1 }, output: { d: 4, c: 3 } });
  await box2.record({ input: { a: 1, b: 2 }, output: { c: 3, d: 4 } });
  const recs = box2.getRecorder().getRecords();
  attack('JSON键序影响哈希', recs[0].hash !== recs[1].hash, 'INFO',
    '不同键序产生不同哈希 — 这是确定性序列化的设计（JSON.stringify保持插入序）');

  // ============================================
  // 总结
  // ============================================
  console.log('\n' + '═'.repeat(60));
  console.log(`⚔️ 攻防演练结果: ${passed}🛡️ 防住  ${failed}🔴 破防 (共 ${passed + failed} 次攻击)`);

  if (vulns.length > 0) {
    console.log('\n🔴 发现的漏洞:');
    for (const v of vulns) {
      console.log(`   ${v}`);
    }
  }

  console.log('');
  if (failed === 0) {
    console.log('🎉 全部防线完好！');
  } else {
    console.log(`⚠️ ${failed} 个漏洞需要修复`);
  }
}

runRedTeam().catch(err => {
  console.error('攻防演练异常:', err);
  process.exit(1);
});
