/**
 * async-writer 单元测试
 * 测试: AsyncWriter, 增量压缩, 分页查询
 */

import { AsyncWriter, WriteEvent, createAsyncWriter } from '../async-writer';

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function makeEvent(id: string, data: Record<string, unknown> = {}, metadata?: Record<string, string>): WriteEvent {
  return {
    id,
    data,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

// ─────────────────────────────────────────────
// AsyncWriter 基础测试
// ─────────────────────────────────────────────

async function testAsyncWriterBasics() {
  console.log('\n--- AsyncWriter 基础测试 ---');

  const written: WriteEvent[] = [];
  const writer = new AsyncWriter({
    bufferSize: 100,
    flush: { intervalMs: 50, countThreshold: 10, enableTimer: false },
    writeFn: async (events) => { written.push(...events); },
  });

  // 写入事件
  writer.write(makeEvent('1', { msg: 'hello' }));
  writer.write(makeEvent('2', { msg: 'world' }));

  const stats = writer.getStats();
  assertEqual(stats.totalWritten, 2, '写入2个事件');
  assertEqual(stats.bufferSize, 2, '缓冲区2个事件');

  // 手动flush
  await writer.flush();
  assertEqual(written.length, 2, 'flush后写了2个事件');
  assertEqual(written[0].id, '1', '第一个事件ID正确');
  assertEqual(written[1].id, '2', '第二个事件ID正确');

  await writer.shutdown();
}

async function testAutoFlush() {
  console.log('\n--- 自动flush测试 ---');

  const written: WriteEvent[] = [];
  const writer = new AsyncWriter({
    bufferSize: 100,
    flush: { intervalMs: 50, countThreshold: 5, enableTimer: false },
    writeFn: async (events) => { written.push(...events); },
  });

  // 写入5个事件触发定量flush
  for (let i = 0; i < 5; i++) {
    writer.write(makeEvent(`evt-${i}`));
  }

  // 等待异步flush完成
  await sleep(50);
  assertEqual(written.length, 5, '定量flush触发，写入5个事件');

  await writer.shutdown();
}

async function testTimerFlush() {
  console.log('\n--- 定时flush测试 ---');

  const written: WriteEvent[] = [];
  const writer = new AsyncWriter({
    bufferSize: 100,
    flush: { intervalMs: 30, countThreshold: 100, enableTimer: true },
    writeFn: async (events) => { written.push(...events); },
  });

  writer.write(makeEvent('timer-1'));
  writer.write(makeEvent('timer-2'));

  // 等待定时器触发
  await sleep(80);
  assertEqual(written.length, 2, '定时flush触发');

  await writer.shutdown();
}

async function testGracefulShutdown() {
  console.log('\n--- Graceful Shutdown 测试 ---');

  const written: WriteEvent[] = [];
  const writer = new AsyncWriter({
    bufferSize: 100,
    flush: { intervalMs: 10000, countThreshold: 1000, enableTimer: false },
    writeFn: async (events) => { written.push(...events); },
  });

  writer.write(makeEvent('shutdown-1'));
  writer.write(makeEvent('shutdown-2'));
  writer.write(makeEvent('shutdown-3'));

  assert(!writer.isShutdown, 'shutdown前isShutdown为false');
  await writer.shutdown();
  assert(writer.isShutdown, 'shutdown后isShutdown为true');
  assertEqual(written.length, 3, 'shutdown应flush所有缓冲事件');

  // shutdown后写入应被忽略
  writer.write(makeEvent('after-shutdown'));
  await sleep(10);
  assertEqual(written.length, 3, 'shutdown后写入被忽略');
}

async function testWriteBatch() {
  console.log('\n--- 批量写入测试 ---');

  const written: WriteEvent[] = [];
  const writer = new AsyncWriter({
    bufferSize: 100,
    flush: { intervalMs: 10, countThreshold: 100, enableTimer: true },
    writeFn: async (events) => { written.push(...events); },
  });

  const events = Array.from({ length: 10 }, (_, i) => makeEvent(`batch-${i}`));
  writer.writeBatch(events);

  await sleep(50);
  assertEqual(written.length, 10, '批量写入10个事件');

  await writer.shutdown();
}

// ─────────────────────────────────────────────
// 环形缓冲区溢出测试
// ─────────────────────────────────────────────

async function testBufferOverflow() {
  console.log('\n--- 缓冲区溢出测试 ---');

  const written: WriteEvent[] = [];
  const writer = new AsyncWriter({
    bufferSize: 5, // 小缓冲区
    flush: { intervalMs: 10000, countThreshold: 1000, enableTimer: false },
    writeFn: async (events) => { written.push(...events); },
  });

  // 写入超过缓冲区大小的事件
  for (let i = 0; i < 10; i++) {
    writer.write(makeEvent(`overflow-${i}`));
  }

  const stats = writer.getStats();
  assertEqual(stats.bufferSize, 5, '缓冲区满后大小为capacity');
  assertEqual(stats.totalWritten, 10, '总写入计数为10');

  // flush后应该有5个事件（最新5个）
  await writer.flush();
  assertEqual(written.length, 5, 'flush出5个事件（缓冲区满了，旧的被覆盖）');

  await writer.shutdown();
}

// ─────────────────────────────────────────────
// 分页查询测试
// ─────────────────────────────────────────────

async function testPagination() {
  console.log('\n--- 分页查询测试 ---');

  const written: WriteEvent[] = [];
  const writer = new AsyncWriter({
    bufferSize: 100,
    flush: { intervalMs: 10000, countThreshold: 1000, enableTimer: false },
    writeFn: async (events) => { written.push(...events); },
  });

  // 写入20个事件，带时间戳
  for (let i = 0; i < 20; i++) {
    const ts = new Date(2026, 0, 1, 0, 0, i).toISOString();
    writer.write({
      id: `page-${i}`,
      data: { index: i },
      timestamp: ts,
      metadata: i % 2 === 0 ? { type: 'even' } : { type: 'odd' },
    });
  }

  // 页码分页 - 第1页
  const page1 = writer.query({ page: 1, pageSize: 5, order: 'desc' });
  assertEqual(page1.data.length, 5, '第1页5条数据');
  assertEqual(page1.pagination.total, 20, '总数20');
  assertEqual(page1.pagination.totalPages, 4, '总页数4');
  assert(page1.pagination.hasNext, '有下一页');
  assert(!page1.pagination.hasPrev, '无上一页');

  // 页码分页 - 第2页
  const page2 = writer.query({ page: 2, pageSize: 5, order: 'desc' });
  assertEqual(page2.data.length, 5, '第2页5条数据');
  assert(page2.pagination.hasPrev, '有上一页');

  // 升序
  const asc = writer.query({ page: 1, pageSize: 3, order: 'asc' });
  assertEqual(asc.data.length, 3, '升序第1页3条');

  // 过滤
  const filtered = writer.query({ filters: { metadata: { type: 'even' } } });
  assertEqual(filtered.data.length, 10, '偶数类型过滤后10条');

  // ID过滤
  const byId = writer.query({ filters: { id: 'page-5' } });
  assertEqual(byId.data.length, 1, 'ID过滤找到1条');
  assertEqual(byId.data[0].id, 'page-5', 'ID过滤结果正确');

  // 游标分页
  const cursorPage1 = writer.query({ pageSize: 5, order: 'desc' });
  if (cursorPage1.pagination.nextCursor) {
    const cursorPage2 = writer.query({ pageSize: 5, cursor: cursorPage1.pagination.nextCursor, order: 'desc' });
    assert(cursorPage2.data.length > 0, '游标分页第二页有数据');
  }

  await writer.shutdown();
}

// ─────────────────────────────────────────────
// 错误处理测试
// ─────────────────────────────────────────────

async function testErrorHandling() {
  console.log('\n--- 错误处理测试 ---');

  let errorCaught = false;
  const writer = new AsyncWriter({
    bufferSize: 100,
    flush: { intervalMs: 10, countThreshold: 3, enableTimer: false },
    writeFn: async () => { throw new Error('写入失败'); },
    onError: (err) => { errorCaught = true; },
  });
  writer.on('error', () => {}); // 防止未处理的error事件导致进程崩溃

  writer.write(makeEvent('err-1'));
  writer.write(makeEvent('err-2'));
  writer.write(makeEvent('err-3'));

  await sleep(50);
  assert(errorCaught, '应捕获到写入错误');

  const stats = writer.getStats();
  assertGreaterThan(stats.writeErrors, 0, 'writeErrors应>0');

  await writer.shutdown();
}

// ─────────────────────────────────────────────
// createAsyncWriter 便捷函数测试
// ─────────────────────────────────────────────

async function testCreateAsyncWriter() {
  console.log('\n--- createAsyncWriter 测试 ---');

  const written: WriteEvent[] = [];
  const writer = createAsyncWriter(async (events) => { written.push(...events); }, 50);

  writer.write(makeEvent('factory-1'));
  await sleep(150);
  
  assertEqual(written.length, 1, 'createAsyncWriter创建的writer正常工作');

  await writer.shutdown();
}

// ─────────────────────────────────────────────
// 运行所有测试
// ─────────────────────────────────────────────

async function runAll() {
  console.log('🧪 async-writer 单元测试开始\n');
  await testAsyncWriterBasics();
  await testAutoFlush();
  await testTimerFlush();
  await testGracefulShutdown();
  await testWriteBatch();
  await testBufferOverflow();
  await testPagination();
  await testErrorHandling();
  await testCreateAsyncWriter();
  console.log(`\n📊 测试结果: ${passCount} 通过, ${failCount} 失败`);
  if (failCount > 0) process.exit(1);
}

runAll();
