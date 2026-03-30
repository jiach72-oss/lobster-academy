/**
 * 明镜 Blackbox — 红队第二轮
 * 覆盖：Redos、插件层、CLI注入、内存安全、错误泄露、边界条件
 */

import { LobsterBlackbox } from '../src/index';
import { Redactor } from '../src/redactor';
import { Signer } from '../src/signer';
import { Recorder } from '../src/recorder';
import { Reporter } from '../src/reporter';

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

async function run(): Promise<void> {
  console.log('🪞 明镜 — 红队第二轮攻防');
  console.log('═════════════════════════════════════════════════\n');

  // ============================================
  // 攻击组5: Redos (正则表达式拒绝服务)
  // ============================================
  section('攻击组5: ReDoS 正则炸弹');

  const redactor = new Redactor({ patterns: ['email', 'phone', 'creditCard'] });

  // 攻击5.1: 灾难性回溯 - 邮箱正则
  const evilEmail = 'a' + '@'.repeat(100) + '.' + 'b'.repeat(100);
  const start1 = Date.now();
  redactor.redactString(evilEmail);
  const dur1 = Date.now() - start1;
  attack('邮箱ReDoS', dur1 > 2000, 'HIGH',
    `邪恶邮箱模式耗时${dur1}ms（正则灾难性回溯）`);

  // 攻击5.2: 灾难性回溯 - 电话正则
  const evilPhone = '+' + '1'.repeat(200);
  const start2 = Date.now();
  redactor.redactString(evilPhone);
  const dur2 = Date.now() - start2;
  attack('电话ReDoS', dur2 > 2000, 'HIGH',
    `邪恶电话模式耗时${dur2}ms`);

  // 攻击5.3: 超长纯数字串
  const longDigits = '1'.repeat(10000);
  const start3 = Date.now();
  redactor.redactString(longDigits);
  const dur3 = Date.now() - start3;
  attack('万位数字串', dur3 > 1000, 'MEDIUM',
    `10000位数字串处理耗时${dur3}ms`);

  // 攻击5.4: 脱敏后内容又匹配模式（无限替换）
  const redactor2 = new Redactor({ patterns: ['email'] });
  // 如果 [REDACTED] 包含邮箱模式会导致无限循环
  const r4 = redactor2.redactString('test@example.com');
  attack('脱敏递归', r4.length > 1000, 'HIGH',
    `脱敏结果长度${r4.length}（应为短字符串）`);

  // 攻击5.5: 大量PII密集文本
  const densePII = Array.from({ length: 1000 }, (_, i) => `user${i}@test.com`).join(' ');
  const start5 = Date.now();
  redactor.redactString(densePII);
  const dur5 = Date.now() - start5;
  attack('千个邮箱密集', dur5 > 3000, 'MEDIUM',
    `1000个邮箱脱敏耗时${dur5}ms`);

  // 攻击5.6: 脱敏替换后剩余敏感字符
  const partial = redactor.redactString('我的邮箱是 a@b.com 电话是 13812345678');
  const stillContainsPII = partial.includes('a@b.com') || partial.includes('13812345678');
  attack('多PII同时脱敏', stillContainsPII, 'HIGH',
    `多个PII同时存在时脱敏不完整: "${partial}"`);

  // 攻击5.7: 嵌套JSON脱敏
  const nestedJSON = {
    outer: {
      inner: {
        email: 'deep@nested.com',
        more: { phone: '13800001111' },
      },
    },
    flat: { card: '4111111111111111' },
  };
  const redactedNested = redactor.redactObject(nestedJSON);
  const nestedStr = JSON.stringify(redactedNested);
  const nestedLeaked = nestedStr.includes('deep@nested.com') ||
    nestedStr.includes('13800001111') || nestedStr.includes('4111111111111111');
  attack('深层嵌套脱敏', nestedLeaked, 'HIGH',
    `三层嵌套脱敏不完整: ${nestedStr.substring(0, 100)}`);

  // ============================================
  // 攻击组6: Signer 边界与异常
  // ============================================
  section('攻击组6: Signer 边界与异常');

  const keys = Signer.generateKeyPair();
  const signer = new Signer(keys.secretKey);

  // 攻击6.1: 空字符串签名
  try {
    const sig = signer.sign('');
    const valid = Signer.verify('', sig, keys.publicKey);
    attack('空字符串签名', !valid, 'LOW',
      '空字符串签名验证应有意义');
  } catch {
    attack('空字符串签名', false, 'LOW', '空字符串被拒绝');
  }

  // 攻击6.2: 仅空格签名
  const spaceSig = signer.sign('   ');
  attack('空格签名复用', Signer.verify('\t', spaceSig, keys.publicKey), 'MEDIUM',
    '不同空白字符的签名互通');

  // 攻击6.3: 特殊字符签名
  const specialChars = '\x00\x01\x02\x03\xFF\xFE\xFD';
  const specialSig = signer.sign(specialChars);
  const specialValid = Signer.verify(specialChars, specialSig, keys.publicKey);
  attack('二进制签名', !specialValid, 'MEDIUM',
    '二进制特殊字符签名验证失败');

  // 攻击6.4: Unicode签名
  const unicodeData = '中文数据🎉🎊🎈emoji测试';
  const unicodeSig = signer.sign(unicodeData);
  attack('Unicode签名', !Signer.verify(unicodeData, unicodeSig, keys.publicKey), 'MEDIUM',
    'Unicode签名验证失败');

  // 攻击6.5: 哈希确定性（相同输入产生相同哈希）
  const hash1 = Signer.hash('deterministic-test');
  const hash2 = Signer.hash('deterministic-test');
  attack('哈希不确定性', hash1 !== hash2, 'CRITICAL',
    '相同输入产生不同哈希值');

  // 攻击6.6: 签名与哈希混用
  try {
    const sig = signer.sign('data');
    // 尝试把签名当哈希验证
    const asHash = Signer.hash('data');
    attack('签名哈希混用', sig === asHash, 'MEDIUM',
      '签名值与哈希值相同，可被混淆');
  } catch {
    attack('签名哈希混用', false, 'MEDIUM', '异常捕获');
  }

  // 攻击6.7: generateKeyPair 随机性
  const pair1 = Signer.generateKeyPair();
  const pair2 = Signer.generateKeyPair();
  attack('密钥对相同', pair1.publicKey === pair2.publicKey && pair1.secretKey === pair2.secretKey, 'CRITICAL',
    '两次生成的密钥对完全相同');

  // 攻击6.8: 公钥从私钥可推导
  // Ed25519的公钥确实从私钥推导，但不应暴露私钥
  const rawKeys = Signer.generateKeyPair();
  // 检查 secretKey 是否包含在输出中
  const testReport = new LobsterBlackbox({ agentId: 'test', signingKey: rawKeys.secretKey });
  await testReport.record({ input: {}, output: {} });
  const report = testReport.generateReport();
  const reportStr = JSON.stringify(report);
  attack('私钥泄露', reportStr.includes(rawKeys.secretKey), 'CRITICAL',
    '报告中包含签名私钥明文');

  // 攻击6.9: 空公钥验证
  const emptyKeyValid = Signer.verify('data', signer.sign('data'), '');
  attack('空公钥验证', emptyKeyValid, 'HIGH',
    '空公钥验证返回true（应返回false）');

  // 攻击6.10: Base64填充攻击
  const badB64 = signer.sign('test') + '===!!!';
  const b64Result = Signer.verify('test', badB64, keys.publicKey);
  attack('Base64填充攻击', b64Result, 'MEDIUM',
    '异常Base64验证返回true（应返回false）');

  // ============================================
  // 攻击组7: Recorder 内存安全与边界
  // ============================================
  section('攻击组7: Recorder 内存安全');

  const recorder = new Recorder({ agentId: 'mem-test', signingKey: keys.secretKey });

  // 攻击7.1: 内存无限增长 → 验证 maxRecords 限制生效
  const limitRecorder = new Recorder({ agentId: 'limit-test', signingKey: keys.secretKey, maxRecords: 100 });
  try {
    for (let i = 0; i < 101; i++) {
      await limitRecorder.record({ input: { i }, output: { i } });
    }
    attack('记录无限增长', true, 'HIGH', 'maxRecords=100时仍接受了101条记录');
  } catch (e) {
    attack('记录无限增长', false, 'HIGH', '第101条记录被RangeError拒绝');
  }

  // 攻击7.2: 单条超大数据 → 验证 maxInputSize 限制
  const sizeLimitRecorder = new Recorder({ agentId: 'size-test', signingKey: keys.secretKey, maxInputSize: 1000 });
  try {
    await sizeLimitRecorder.record({ input: { data: 'X'.repeat(2000) }, output: { ok: true } });
    attack('输入大小限制', true, 'HIGH', 'maxInputSize=1000时仍接受了2000字符');
  } catch (e) {
    attack('输入大小限制', false, 'HIGH', '超大输入被RangeError拒绝');
  }

  // 攻击7.3: 清理机制
  const cleanRecorder = new Recorder({ agentId: 'clean-test', signingKey: keys.secretKey });
  await cleanRecorder.record({ input: { x: 1 }, output: { y: 1 } });
  // 检查是否有 destroy/clear 方法
  const hasClean = 'clear' in cleanRecorder || 'destroy' in cleanRecorder || 'dispose' in cleanRecorder;
  attack('清理机制缺失', !hasClean, 'MEDIUM',
    'Recorder没有clear/destroy/dispose方法，内存无法释放');

  // 攻击7.4: NaN/Infinity 在对象中
  const nanRecorder = new Recorder({ agentId: 'nan-test', signingKey: keys.secretKey });
  try {
    const nanRec = await nanRecorder.record({
      input: { nan: NaN, inf: Infinity, negInf: -Infinity },
      output: {},
    });
    // JSON.stringify(NaN) === 'null', JSON.stringify(Infinity) === 'null'
    const nanHash = nanRec.hash;
    const normalRec = await nanRecorder.record({
      input: { nan: null, inf: null, negInf: null },
      output: {},
    });
    attack('NaN==null哈希碰撞', nanHash === normalRec.hash, 'MEDIUM',
      'NaN和null产生相同哈希（JSON序列化行为）');
  } catch {
    attack('NaN==null哈希碰撞', false, 'MEDIUM', '异常捕获');
  }

  // 攻击7.5: Symbol属性
  const symRecorder = new Recorder({ agentId: 'sym-test', signingKey: keys.secretKey });
  const symObj: any = { normal: 1 };
  symObj[Symbol('hidden')] = 'secret';
  const symRec = await symRecorder.record({ input: symObj, output: {} });
  const symStr = JSON.stringify(symRec);
  attack('Symbol泄露', symStr.includes('secret'), 'MEDIUM',
    'Symbol属性值被泄露');

  // 攻击7.6: Function属性
  const fnRecorder = new Recorder({ agentId: 'fn-test', signingKey: keys.secretKey });
  const fnObj: any = { normal: 1, evil: function() { return 'hacked'; } };
  const fnRec = await fnRecorder.record({ input: fnObj, output: {} });
  attack('Function序列化', JSON.stringify(fnRec).includes('hacked'), 'MEDIUM',
    'Function属性值被泄露');

  // 攻击7.7: 定时器/事件泄漏（检查Recorder是否注册了监听器）
  const listenersBefore = process.listenerCount('exit');
  const leakyRecorder = new Recorder({ agentId: 'leak-test', signingKey: keys.secretKey });
  await leakyRecorder.record({ input: {}, output: {} });
  const listenersAfter = process.listenerCount('exit');
  attack('事件监听器泄漏', listenersAfter > listenersBefore, 'LOW',
    `process.exit监听器从${listenersBefore}增加到${listenersAfter}`);

  // ============================================
  // 攻击组8: Reporter 报告级攻击
  // ============================================
  section('攻击组8: Reporter 报告级攻击');

  // 攻击8.1: 平均值计算溢出
  const reporterBox = new LobsterBlackbox({ agentId: 'math-test', signingKey: keys.secretKey });
  for (let i = 0; i < 100; i++) {
    await reporterBox.record({
      input: {},
      output: {},
      duration: Number.MAX_SAFE_INTEGER,
    });
  }
  const mathReport = reporterBox.generateReport();
  const avgDuration = mathReport.summary.avgDuration;
  attack('平均值溢出',
    !isFinite(avgDuration) || avgDuration < 0,
    'HIGH',
    `avgDuration=${avgDuration}（100个MAX_SAFE_INTEGER求平均溢出）`);

  // 攻击8.2: 报告周期边界
  const periodBox = new LobsterBlackbox({ agentId: 'period-test', signingKey: keys.secretKey });
  await periodBox.record({ input: {}, output: {} });
  const futureReport = periodBox.generateReport({ from: '2000-01-01T00:00:00Z', to: '2000-01-02T00:00:00Z' });
  attack('过去时间段报告', futureReport.summary.totalDecisions !== 0, 'LOW',
    `2000年的报告应该返回0条，实际返回${futureReport.summary.totalDecisions}条`);

  // 攻击8.3: 空报告签名
  const emptyBox = new LobsterBlackbox({ agentId: 'empty-test', signingKey: keys.secretKey });
  const emptyReport = emptyBox.generateReport();
  attack('空报告签名', !LobsterBlackbox.verifyReport(emptyReport, keys.publicKey), 'MEDIUM',
    '空报告签名验证失败');

  // 攻击8.4: 报告JSON超大
  const bigReportBox = new LobsterBlackbox({ agentId: 'big-report', signingKey: keys.secretKey });
  for (let i = 0; i < 1000; i++) {
    await bigReportBox.record({
      input: { data: 'x'.repeat(100) },
      output: { result: 'y'.repeat(100) },
    });
  }
  const bigReport = bigReportBox.generateReport();
  const jsonSize = JSON.stringify(bigReport).length;
  attack('报告JSON巨大', jsonSize > 10_000_000, 'MEDIUM',
    `报告JSON大小: ${(jsonSize / 1024).toFixed(0)}KB`);

  // 攻击8.5: serialize → deserialize → verify
  const serBox = new LobsterBlackbox({ agentId: 'ser-test', signingKey: keys.secretKey });
  await serBox.record({ input: { secret: 'password123' }, output: { token: 'abc' } });
  const serReport = serBox.generateReport();
  const serJSON = JSON.stringify(serBox.getRecorder().getRecords());
  // 序列化中的敏感数据检查
  const serLeaked = serJSON.includes('password123') || serJSON.includes('abc');
  attack('序列化敏感数据', serLeaked, 'INFO',
    '序列化包含原始敏感数据（这是录制特性，需配合脱敏使用）');

  // ============================================
  // 攻击组9: 已知Bug回归
  // ============================================
  section('攻击组9: 已知Bug回归验证');

  // 回归1: hasPII g标志lastIndex
  const regRedactor = new Redactor({ patterns: ['email'] });
  const reg1 = regRedactor.hasPII('test@test.com');
  const reg2 = regRedactor.hasPII('test@test.com');
  attack('g标志回归', reg1 !== reg2, 'CRITICAL',
    `两次相同检测结果不同: ${reg1} vs ${reg2}`);

  // 回归2: redactObject修改原始对象
  const regObj = { user: { email: 'orig@test.com' } };
  const regRedacted = regRedactor.redactObject(regObj);
  attack('原始对象篡改回归', regObj.user.email !== 'orig@test.com', 'CRITICAL',
    `原始对象被修改: ${regObj.user.email}`);

  // 回归3: 空agentId
  try {
    const emptyAgentBox = new LobsterBlackbox({ agentId: '', signingKey: keys.secretKey });
    await emptyAgentBox.record({ input: {}, output: {} });
    attack('空agentId回归', true, 'MEDIUM', '空agentId被接受');
  } catch {
    attack('空agentId回归', false, 'MEDIUM', '空agentId被正确拒绝');
  }

  // ============================================
  // 总结
  // ============================================
  console.log('\n' + '═'.repeat(60));
  console.log(`⚔️ 第二轮结果: ${passed}🛡️ 防住  ${failed}🔴 破防 (共 ${passed + failed} 次攻击)`);

  if (vulns.length > 0) {
    console.log('\n🔴 发现的漏洞:');
    for (const v of vulns) {
      console.log(`   ${v}`);
    }
  }
  console.log('');
}

run().catch(err => {
  console.error('攻防演练异常:', err);
  process.exit(1);
});
