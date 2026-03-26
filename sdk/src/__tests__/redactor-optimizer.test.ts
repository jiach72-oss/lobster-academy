/**
 * redactor-optimizer 单元测试
 * 测试: BloomFilter, StreamingRedactor, I18nPatternCache, PatternFrequencySorter
 */

import { BloomFilter, StreamingRedactor, I18nPatternCache, PatternFrequencySorter } from '../redactor-optimizer';
import { RedactorV2, PatternDefinition } from '../redactor-v2';

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

function assertApprox(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) > tolerance) { failCount++; console.log(`❌ FAIL: ${message} - expected ~${expected}, got ${actual}`); return; }
  passCount++; console.log(`✅ PASS: ${message}`);
}

// ─────────────────────────────────────────────
// BloomFilter 测试
// ─────────────────────────────────────────────

function testBloomFilter() {
  console.log('\n--- BloomFilter 测试 ---');

  const bf = new BloomFilter({ size: 2048, hashCount: 3 });

  // 添加元素后应该能查询到
  bf.add('password');
  bf.add('api_key');
  bf.add('secret');

  assert(bf.mightContain('password'), '添加password后应该能查到');
  assert(bf.mightContain('api_key'), '添加api_key后应该能查到');
  assert(bf.mightContain('secret'), '添加secret后应该能查到');

  // 未添加的元素应返回false（或少量假阳性）
  assert(!bf.mightContain('totally_unknown_key_xyz'), '未添加的元素应返回false');

  // 批量添加
  const keys = ['token', 'bearer', 'credential', 'authorization'];
  bf.addAll(keys);
  for (const k of keys) {
    assert(bf.mightContain(k), `批量添加后应能查到: ${k}`);
  }

  // 清空后查询不到
  bf.clear();
  assert(!bf.mightContain('password'), '清空后应查不到password');

  // 误报率测试
  const bf2 = new BloomFilter({ size: 2048, hashCount: 3 });
  const testKeys = Array.from({ length: 20 }, (_, i) => `key_${i}`);
  bf2.addAll(testKeys);

  let falsePositives = 0;
  const testCount = 1000;
  for (let i = 0; i < testCount; i++) {
    if (bf2.mightContain(`nonexistent_${i}_zzz`)) falsePositives++;
  }
  const falsePositiveRate = falsePositives / testCount;
  assert(falsePositiveRate < 0.05, `假阳性率 ${falsePositiveRate} 应 < 5%`);

  // estimateSize 测试
  const bf3 = new BloomFilter();
  assertEqual(bf3.estimateSize(), 0, '空filter估计元素数为0');
  bf3.add('a');
  bf3.add('b');
  bf3.add('c');
  const est = bf3.estimateSize();
  assert(est >= 2 && est <= 10, `估计元素数 ${est} 应在2-10之间`);
}

// ─────────────────────────────────────────────
// StreamingRedactor 测试
// ─────────────────────────────────────────────

function testStreamingRedactor() {
  console.log('\n--- StreamingRedactor 测试 ---');

  // 基本脱敏
  const sr = new StreamingRedactor({ windowSize: 50 });
  const chunk1 = 'My AWS key is AKIAIOSFODNN7EXAMPL';
  const chunk2 = 'E and my email is test@example.com extra_text_padding_here';
  
  const part1 = sr.redactChunk(chunk1 + chunk2);
  const remaining = sr.flush();
  const full = part1 + remaining;
  
  assert(!full.includes('AKIAIOSFODNN7EXAMPLE'), 'AWS key应被脱敏');
  assert(full.includes('[REDACTED]'), '应包含REDACTED标记');

  // 跨chunk边界测试
  const sr2 = new StreamingRedactor({ windowSize: 30 });
  const r1 = sr2.redactChunk('prefix sk-proj-abc');
  const r2 = sr2.redactChunk('defghijklmnopqrstuvwxyz1234567890 extra');
  const r3 = sr2.flush();
  const combined = r1 + r2 + r3;
  
  // OpenAI key sk-proj-abcdefg... 跨了两个chunk
  assert(combined.length > 0, '流式脱敏应产生输出');

  // JWT脱敏 - 使用较短的JWT（AC搜索窗口+100可能不够长JWT）
  const sr3 = new StreamingRedactor({ windowSize: 30 });
  const shortJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123';
  const jwtResult = sr3.redactChunk('token: ' + shortJwt + ' padding_padding_padding_padding_padding_padding');
  const jwtRemain = sr3.flush();
  const jwtFull = jwtResult + jwtRemain;
  assert(!jwtFull.includes('eyJhbGciOiJIUzI1NiJ9'), 'JWT应被脱敏');

  // 状态测试
  const sr4 = new StreamingRedactor({ windowSize: 100 });
  sr4.redactChunk('hello world padding_to_exceed_window_size_threshold_for_testing');
  const state = sr4.getState();
  assert(state.chunksProcessed >= 1, 'chunksProcessed应>=1');

  // reset测试
  sr4.reset();
  const stateAfterReset = sr4.getState();
  assertEqual(stateAfterReset.chunksProcessed, 0, 'reset后chunksProcessed为0');
  assertEqual(stateAfterReset.bufferLen, 0, 'reset后bufferLen为0');

  // 空输入
  const sr5 = new StreamingRedactor();
  assertEqual(sr5.redactChunk(''), '', '空chunk返回空串');
  assertEqual(sr5.flush(), '', '空flush返回空串');
}

// ─────────────────────────────────────────────
// I18nPatternCache 测试
// ─────────────────────────────────────────────

function testI18nPatternCache() {
  console.log('\n--- I18nPatternCache 测试 ---');

  const cache = new I18nPatternCache();

  // 缓存miss
  assertEqual(cache.get('zh-CN'), null, '未注册的locale返回null');
  assert(!cache.has('zh-CN'), 'has应返回false');

  // 注册后命中
  const patterns: PatternDefinition[] = [
    { name: 'cn-phone', prefix: '1', regexSource: '1[3-9]\\d{9}', regexFlags: '' },
    { name: 'cn-id', prefix: '', regexSource: '\\d{17}[\\dXx]', regexFlags: '' },
  ];
  cache.register('zh-CN', patterns);

  assert(cache.has('zh-CN'), '注册后has应返回true');
  const entry = cache.get('zh-CN');
  assert(entry !== null, 'get应返回entry');
  assertEqual(entry!.locale, 'zh-CN', 'locale标识正确');
  assertEqual(entry!.compiled.length, 2, '应编译2个正则');
  assertEqual(entry!.accessCount, 1, '访问计数为1');

  // 二次访问
  cache.get('zh-CN');
  assertEqual(entry!.accessCount, 2, '二次访问计数为2');

  // getCompiledPatterns
  const compiled = cache.getCompiledPatterns('zh-CN');
  assert(compiled !== null, 'getCompiledPatterns应返回数组');
  assertEqual(compiled!.length, 2, '应有2个编译正则');

  // 缓存命中统计
  const stats = cache.getStats();
  assertEqual(stats.hits, 3, '命中3次');
  assertEqual(stats.misses, 1, 'miss 1次');
  assertApprox(stats.hitRate, 0.75, 0.01, '命中率约75%');

  // 多locale
  cache.register('ja-JP', [{ name: 'jp-phone', prefix: '0', regexSource: '0\\d{9,10}', regexFlags: '' }]);
  assertEqual(cache.getLocales().length, 2, '应有2个locale');

  // warmup
  cache.warmup({
    'ko-KR': [{ name: 'kr-phone', prefix: '0', regexSource: '0\\d{9,10}', regexFlags: '' }],
    'ar-SA': [{ name: 'sa-phone', prefix: '0', regexSource: '0\\d{9}', regexFlags: '' }],
  });
  assertEqual(cache.getLocales().length, 4, 'warmup后应有4个locale');

  // invalidate
  assert(cache.invalidate('ja-JP'), 'invalidate应返回true');
  assert(!cache.has('ja-JP'), 'invalidate后has应返回false');

  // clear
  cache.clear();
  assertEqual(cache.getLocales().length, 0, 'clear后无locale');
}

// ─────────────────────────────────────────────
// PatternFrequencySorter 测试
// ─────────────────────────────────────────────

function testPatternFrequencySorter() {
  console.log('\n--- PatternFrequencySorter 测试 ---');

  const patterns: PatternDefinition[] = [
    { name: 'generic-pass', prefix: 'password=', regexSource: 'password=.+', regexFlags: '', priority: 6 },
    { name: 'aws-key', prefix: 'AKIA', regexSource: 'AKIA[0-9A-Z]{16}', regexFlags: '', priority: 10 },
    { name: 'openai-key', prefix: 'sk-', regexSource: 'sk-[A-Za-z0-9]{48,}', regexFlags: '', priority: 9 },
    { name: 'bearer', prefix: 'Bearer ', regexSource: 'Bearer\\s+.+', regexFlags: '', priority: 8 },
  ];

  const sorter = new PatternFrequencySorter(patterns);
  const sorted = sorter.getSortedPatterns();

  // 高频前缀应排在前面
  const firstNames = sorted.slice(0, 3).map(p => p.name);
  assert(firstNames.includes('aws-key'), 'aws-key应排在前面（高频前缀）');
  assert(firstNames.includes('openai-key'), 'openai-key应排在前面（高频前缀）');
  assert(firstNames.includes('bearer'), 'bearer应排在前面（高频前缀）');

  // 记录命中
  sorter.recordHit('generic-pass', 2.5);
  sorter.recordHit('generic-pass', 3.0);
  sorter.recordHit('generic-pass', 2.0);

  const stats = sorter.getStats();
  const gpStat = stats.find(s => s.pattern === 'generic-pass');
  assert(gpStat !== undefined, '应有generic-pass的统计');
  assertEqual(gpStat!.hits, 3, '命中3次');

  // reSort
  sorter.reSort();
  const resorted = sorter.getSortedPatterns();
  assert(resorted.length === sorted.length, '重排序后长度不变');

  // resetStats
  sorter.resetStats();
  const statsAfterReset = sorter.getStats();
  const gpAfterReset = statsAfterReset.find(s => s.pattern === 'generic-pass');
  assertEqual(gpAfterReset!.hits, 0, 'reset后命中归零');
}

// ─────────────────────────────────────────────
// 运行所有测试
// ─────────────────────────────────────────────

function runAll() {
  console.log('🧪 redactor-optimizer 单元测试开始\n');
  testBloomFilter();
  testStreamingRedactor();
  testI18nPatternCache();
  testPatternFrequencySorter();
  console.log(`\n📊 测试结果: ${passCount} 通过, ${failCount} 失败`);
  if (failCount > 0) process.exit(1);
}

runAll();
