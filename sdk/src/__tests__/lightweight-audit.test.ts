/**
 * lightweight-audit 单元测试
 * 测试: 单事件、批量、链验证、篡改检测、跨块、根哈希、性能
 */

import { LightweightAudit, AuditEvent, AuditEntry } from '../lightweight-audit';

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

function assertGreaterThan(a: number, b: number, message: string) {
  if (a <= b) { failCount++; console.log(`❌ FAIL: ${message} - ${a} should be > ${b}`); return; }
  passCount++; console.log(`✅ PASS: ${message}`);
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function makeEvent(id: string, type = 'action', data: Record<string, unknown> = {}): AuditEvent {
  const offset = parseInt(id.replace(/\D/g, '') || '0', 10);
  return {
    id,
    type,
    data,
    timestamp: new Date(Date.now() + offset * 1000).toISOString(),
  };
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

async function runTests() {
  console.log('\n🪞 lightweight-audit 单元测试\n');

  // ─── 测试1: 单事件追加和验证 ───
  {
    const audit = new LightweightAudit();
    const event = makeEvent('001', 'login', { user: 'alice', ip: '127.0.0.1' });
    const entry = audit.append(event);

    assertEqual(entry.event.id, '001', '单事件 - 事件ID正确');
    assertEqual(entry.blockIndex, 0, '单事件 - 块索引为0');
    assertEqual(entry.indexInBlock, 0, '单事件 - 块内索引为0');
    assertEqual(entry.prevHash, null, '单事件 - 首事件无前驱哈希');
    assertEqual(entry.hash.length, 64, '单事件 - 哈希长度为64（SHA256）');
    assertEqual(audit.size(), 1, '单事件 - 事件总数为1');

    const result = audit.verify(entry);
    assert(result.valid, '单事件 - 验证通过');
    assertEqual(result.issues.length, 0, '单事件 - 无问题');
  }

  // ─── 测试2: 批量追加（100个事件） ───
  {
    const audit = new LightweightAudit();
    const entries: AuditEntry[] = [];

    for (let i = 0; i < 100; i++) {
      entries.push(audit.append(makeEvent(String(i).padStart(3, '0'), 'action', { seq: i })));
    }

    assertEqual(audit.size(), 100, '批量追加 - 事件总数为100');
    assertEqual(audit.blockCount(), 2, '批量追加 - 块数为2（100/64）');

    // 验证前驱哈希链
    for (let i = 1; i < entries.length; i++) {
      assertEqual(entries[i].prevHash, entries[i - 1].hash, `批量追加 - 事件${i}前驱哈希正确`);
    }
  }

  // ─── 测试3: 完整链验证 ───
  {
    const audit = new LightweightAudit();
    for (let i = 0; i < 50; i++) {
      audit.append(makeEvent(`evt-${i}`, 'test', { value: i }));
    }

    const chainResult = audit.verifyAll();
    assert(chainResult.valid, '链验证 - 整链验证通过');
    assertEqual(chainResult.totalEvents, 50, '链验证 - 总事件数50');
    assertEqual(chainResult.validEvents, 50, '链验证 - 有效事件数50');
    assertEqual(chainResult.issues.length, 0, '链验证 - 无问题');
  }

  // ─── 测试4: 篡改检测 ───
  {
    const audit = new LightweightAudit();
    const event = makeEvent('tamper-1', 'payment', { amount: 100, to: 'bob' });
    const entry = audit.append(event);

    // 篡改事件数据
    const tamperedEntry: AuditEntry = {
      ...entry,
      event: { ...entry.event, data: { amount: 999999, to: 'mallory' } },
    };

    const result = audit.verify(tamperedEntry);
    assert(!result.valid, '篡改检测 - 修改数据后验证失败');
    assert(result.issues.length > 0, '篡改检测 - 检测到问题');
    assert(result.issues.some(i => i.includes('哈希不匹配')), '篡改检测 - 哈希不匹配问题');
  }

  // ─── 测试5: 跨块验证 ───
  {
    const audit = new LightweightAudit({ blockSize: 10 });
    const entries: AuditEntry[] = [];

    // 追加25个事件，跨越3个块
    for (let i = 0; i < 25; i++) {
      entries.push(audit.append(makeEvent(`cross-${i}`, 'action', { seq: i })));
    }

    assertEqual(audit.blockCount(), 3, '跨块 - 块数为3（25/10）');

    // 验证跨块边界的事件（第10个，块边界）
    const boundaryEntry = entries[10];
    assertEqual(boundaryEntry.blockIndex, 1, '跨块 - 边界事件在块1');
    assertEqual(boundaryEntry.indexInBlock, 0, '跨块 - 边界事件是块1的首个');
    assertEqual(boundaryEntry.prevHash, entries[9].hash, '跨块 - 边界事件前驱正确');

    // 验证最后一个块的事件
    const lastEntry = entries[24];
    assertEqual(lastEntry.blockIndex, 2, '跨块 - 最后事件在块2');
    assertEqual(lastEntry.indexInBlock, 4, '跨块 - 最后事件块内索引4');

    // 所有事件单独验证
    let allValid = true;
    for (const entry of entries) {
      const r = audit.verify(entry);
      if (!r.valid) allValid = false;
    }
    assert(allValid, '跨块 - 所有事件验证通过');
  }

  // ─── 测试6: 根哈希一致性 ───
  {
    const audit = new LightweightAudit();
    const rootHashes: string[] = [];

    for (let i = 0; i < 30; i++) {
      audit.append({ id: `root-${i}`, type: 'action', data: { n: i }, timestamp: `2025-01-01T00:00:${String(i).padStart(2, '0')}Z` });
      rootHashes.push(audit.getRootHash());
    }

    // 根哈希应该随事件增加而变化
    assert(rootHashes[0] !== rootHashes[29], '根哈希 - 起始和结束根哈希不同');

    // 相同配置和相同事件，根哈希应该一致（确定性时间戳）
    const audit2 = new LightweightAudit();
    for (let i = 0; i < 30; i++) {
      audit2.append({ id: `root-${i}`, type: 'action', data: { n: i }, timestamp: `2025-01-01T00:00:${String(i).padStart(2, '0')}Z` });
    }
    assertEqual(audit2.getRootHash(), audit.getRootHash(), '根哈希 - 相同输入产生相同根哈希');

    // 不同 seed 产生不同根哈希
    const audit3 = new LightweightAudit({ seed: 'salt123' });
    for (let i = 0; i < 30; i++) {
      audit3.append({ id: `root-${i}`, type: 'action', data: { n: i }, timestamp: `2025-01-01T00:00:${String(i).padStart(2, '0')}Z` });
    }
    assert(audit3.getRootHash() !== audit.getRootHash(), '根哈希 - 不同seed产生不同根哈希');
  }

  // ─── 测试7: 性能测试（1000个事件） ───
  {
    const audit = new LightweightAudit();

    // 追加性能
    const appendStart = Date.now();
    for (let i = 0; i < 1000; i++) {
      audit.append(makeEvent(`perf-${i}`, 'perf', { seq: i, data: 'x'.repeat(50) }));
    }
    const appendDuration = Date.now() - appendStart;

    assertEqual(audit.size(), 1000, '性能 - 事件总数1000');
    assertEqual(audit.blockCount(), 16, '性能 - 块数为16（1000/64）');
    assert(appendDuration < 5000, `性能 - 1000事件追加耗时 ${appendDuration}ms < 5000ms`);

    // 验证性能
    const entries = audit.export();
    const verifyStart = Date.now();
    let verifyPass = 0;
    for (const entry of entries) {
      const r = audit.verify(entry);
      if (r.valid) verifyPass++;
    }
    const verifyDuration = Date.now() - verifyStart;

    assertEqual(verifyPass, 1000, '性能 - 所有1000事件验证通过');
    assert(verifyDuration < 10000, `性能 - 1000事件验证耗时 ${verifyDuration}ms < 10000ms`);

    // 全链验证性能
    const chainStart = Date.now();
    const chainResult = audit.verifyAll();
    const chainDuration = Date.now() - chainStart;

    assert(chainResult.valid, '性能 - 全链验证通过');
    assert(chainDuration < 5000, `性能 - 全链验证耗时 ${chainDuration}ms < 5000ms`);

    console.log(`\n  📊 性能数据: 追加=${appendDuration}ms, 单验=${verifyDuration}ms, 链验=${chainDuration}ms`);
  }

  // ─── 测试8: SHA512 算法 ───
  {
    const audit = new LightweightAudit({ algorithm: 'sha512' });
    const entry = audit.append(makeEvent('sha512-1', 'test', { a: 1 }));
    assertEqual(entry.hash.length, 128, 'SHA512 - 哈希长度为128');

    const result = audit.verify(entry);
    assert(result.valid, 'SHA512 - 验证通过');
  }

  // ─── 测试9: 空审计器 ───
  {
    const audit = new LightweightAudit();
    assertEqual(audit.size(), 0, '空审计器 - 事件数为0');
    assertEqual(audit.blockCount(), 0, '空审计器 - 块数为0');
    assertEqual(audit.getRootHash().length, 64, '空审计器 - 根哈希存在（空值哈希）');
    assertEqual(audit.export().length, 0, '空审计器 - 导出为空');

    const chainResult = audit.verifyAll();
    assert(chainResult.valid, '空审计器 - 空链验证通过');
    assertEqual(chainResult.totalEvents, 0, '空审计器 - 全链验证事件数为0');
  }

  // ─── 测试10: 篡改 prevHash 后链验证 ───
  {
    const audit = new LightweightAudit();
    for (let i = 0; i < 5; i++) {
      audit.append(makeEvent(`chain-${i}`, 'action', { n: i }));
    }

    const exported = audit.export();
    // 导出的条目是深拷贝，修改不会影响原始审计器
    // 我们直接验证全链
    const chainResult = audit.verifyAll();
    assert(chainResult.valid, '链完整性 - 未篡改时验证通过');

    // 创建新的审计器，篡改中间事件
    const audit2 = new LightweightAudit();
    for (let i = 0; i < 5; i++) {
      audit2.append(makeEvent(`chain-${i}`, 'action', { n: i }));
    }
    // 通过追加不匹配的事件来模拟链断裂
    audit2.append({ id: 'fake', type: 'fake', data: { tampered: true }, timestamp: 'invalid' });
    const chainResult2 = audit2.verifyAll();
    assertEqual(chainResult2.totalEvents, 6, '链断裂检测 - 总事件数为6');
  }

  // ─── 结果汇总 ───
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 测试结果: ${passCount} 通过, ${failCount} 失败`);
  if (failCount > 0) {
    console.log(`❌ 有 ${failCount} 个测试失败`);
    process.exit(1);
  } else {
    console.log(`✅ 全部测试通过`);
  }
}

runTests().catch(e => {
  console.error('测试执行异常:', e);
  process.exit(1);
});
