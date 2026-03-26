/**
 * tiered-storage P2 单元测试
 * 测试: TieredStorage路由、MemoryAdapter、ConsistentHashingRouter、ShardedTieredStorage
 */

import {
  TieredStorage,
  MemoryAdapter,
  ConsistentHashingRouter,
  ShardedTieredStorage,
  StorageEntry,
  StorageQuery,
  createDefaultStorage,
} from '../storage/tiered-storage';

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
// MemoryAdapter 测试
// ─────────────────────────────────────────────

async function testMemoryAdapter() {
  console.log('\n--- MemoryAdapter 测试 ---');

  const adapter = new MemoryAdapter(3600);

  // 保存
  const entry: StorageEntry = {
    id: 'test-1',
    data: { msg: 'hello' },
    timestamp: new Date().toISOString(),
  };
  const saveResult = await adapter.save(entry);
  assert(saveResult.success, '保存成功');

  // 获取
  const getResult = await adapter.get('test-1');
  assert(getResult.success, '获取成功');
  assertEqual((getResult.data as any).msg, 'hello', '数据正确');
  assertEqual(getResult.tier, 'hot', '来源为hot层');

  // 不存在
  const notFound = await adapter.get('nonexistent');
  assert(!notFound.success, '不存在返回失败');

  // 查询
  await adapter.save({ id: 'test-2', data: { msg: 'world' }, timestamp: new Date().toISOString() });
  const queryResult = await adapter.query({});
  assert(queryResult.success, '查询成功');
  assertEqual(queryResult.count, 2, '查询到2条');

  // ID过滤查询
  const idQuery = await adapter.query({ id: 'test-1' });
  assertEqual(idQuery.count, 1, 'ID过滤找到1条');

  // 删除
  const delResult = await adapter.delete('test-1');
  assert(delResult.success, '删除成功');
  const afterDel = await adapter.get('test-1');
  assert(!afterDel.success, '删除后获取失败');

  // 清空
  await adapter.clear();
  const afterClear = await adapter.query({});
  assertEqual(afterClear.count, 0, '清空后无数据');

  // isAvailable
  assert(await adapter.isAvailable(), 'MemoryAdapter始终可用');
}

async function testMemoryAdapterTTL() {
  console.log('\n--- MemoryAdapter TTL 测试 ---');

  const adapter = new MemoryAdapter(1); // 1秒TTL

  await adapter.save({ id: 'ttl-1', data: { msg: 'expires' }, timestamp: new Date().toISOString() });

  // 立即获取应该成功
  const immediate = await adapter.get('ttl-1');
  assert(immediate.success, '立即获取成功');

  // 等待过期
  await new Promise(resolve => setTimeout(resolve, 1100));

  const expired = await adapter.get('ttl-1');
  assert(!expired.success, '过期后获取失败');

  // cleanup
  await adapter.save({ id: 'ttl-2', data: {}, timestamp: new Date().toISOString() });
  await new Promise(resolve => setTimeout(resolve, 1100));
  const cleaned = adapter.cleanup();
  assertGreaterThan(cleaned, 0, 'cleanup清理了过期条目');
}

async function testMemoryAdapterQueryPagination() {
  console.log('\n--- MemoryAdapter 分页查询测试 ---');

  const adapter = new MemoryAdapter(3600);

  for (let i = 0; i < 10; i++) {
    await adapter.save({
      id: `page-${i}`,
      data: { index: i },
      timestamp: new Date(2026, 0, i + 1).toISOString(),
    });
  }

  // offset + limit
  const page1 = await adapter.query({ offset: 0, limit: 3 });
  assertEqual(page1.count, 3, 'limit=3返回3条');

  const page2 = await adapter.query({ offset: 3, limit: 3 });
  assertEqual(page2.count, 3, 'offset=3, limit=3返回3条');

  // 时间范围
  const timeQuery = await adapter.query({
    from: new Date(2026, 0, 3).toISOString(),
    to: new Date(2026, 0, 6).toISOString(),
  });
  assert(timeQuery.count! > 0, '时间范围查询有结果');
}

// ─────────────────────────────────────────────
// TieredStorage 测试
// ─────────────────────────────────────────────

async function testTieredStorage() {
  console.log('\n--- TieredStorage 测试 ---');

  const hot = new MemoryAdapter(3600, 'hot');
  const warm = new MemoryAdapter(86400, 'warm');

  const storage = new TieredStorage({
    adapters: [hot, warm],
    enableFallback: true,
  });

  // 保存
  const entry: StorageEntry = {
    id: 'ts-1',
    data: { msg: 'tiered' },
    timestamp: new Date().toISOString(),
  };
  const saveResult = await storage.save(entry);
  assert(saveResult.success, 'TieredStorage保存成功');

  // 获取（从hot层）
  const getResult = await storage.get('ts-1');
  assert(getResult.success, '获取成功');
  assertEqual(getResult.tier, 'hot', '从hot层获取');

  // 查询
  const queryResult = await storage.query({});
  assert(queryResult.success, '查询成功');
  assert(queryResult.count! > 0, '查询有结果');

  // 删除
  const delResult = await storage.delete('ts-1');
  assert(delResult.success, '删除成功');

  // 健康检查
  const health = await storage.healthCheck();
  assertEqual(health.length, 2, '2个适配器');
  assert(health.every(h => h.available), '所有适配器可用');

  // 统计
  const stats = storage.getStats();
  assertGreaterThan(stats.writeCounts.hot, 0, '有hot层写入');

  // 适配器信息
  const adapters = storage.getAdapters();
  assertEqual(adapters.length, 2, '2个适配器');
  assertEqual(adapters[0].tier, 'hot', '第一个是hot');
  assertEqual(adapters[1].tier, 'warm', '第二个是warm');
}

async function testTieredStorageFallback() {
  console.log('\n--- TieredStorage 降级测试 ---');

  // 创建一个不可用的适配器作为hot层
  const brokenAdapter = new MemoryAdapter(3600);
  const origIsAvailable = brokenAdapter.isAvailable.bind(brokenAdapter);
  (brokenAdapter as any).isAvailable = async () => false;

  const warm = new MemoryAdapter(3600);

  const storage = new TieredStorage({
    adapters: [brokenAdapter as any, warm],
    enableFallback: true,
  });

  await storage.save({ id: 'fb-1', data: {}, timestamp: new Date().toISOString() });

  // 从warm层获取
  const result = await storage.get('fb-1');
  assert(result.success, '降级后从warm层获取成功');
}

async function testTieredStorageBatch() {
  console.log('\n--- TieredStorage 批量保存测试 ---');

  const storage = createDefaultStorage();

  const entries: StorageEntry[] = Array.from({ length: 5 }, (_, i) => ({
    id: `batch-${i}`,
    data: { index: i },
    timestamp: new Date().toISOString(),
  }));

  const result = await storage.saveBatch(entries);
  assertEqual(result.count, 5, '批量保存5条');

  await storage.clear();
}

async function testTieredStorageClear() {
  console.log('\n--- TieredStorage 清空测试 ---');

  const storage = createDefaultStorage();
  await storage.save({ id: 'clear-1', data: {}, timestamp: new Date().toISOString() });
  await storage.clear();

  const result = await storage.query({});
  assertEqual(result.count, 0, '清空后无数据');
}

// ─────────────────────────────────────────────
// ConsistentHashingRouter 测试
// ─────────────────────────────────────────────

function testConsistentHashingRouter() {
  console.log('\n--- ConsistentHashingRouter 测试 ---');

  const adapter1 = new MemoryAdapter();
  const adapter2 = new MemoryAdapter();

  const router = new ConsistentHashingRouter({
    shards: [
      { shardId: 'shard-1', adapter: adapter1, virtualNodeCount: 150 },
      { shardId: 'shard-2', adapter: adapter2, virtualNodeCount: 150 },
    ],
  });

  // 路由一致性
  const route1 = router.route('agent-001');
  const route2 = router.route('agent-001');
  assertEqual(route1.shardId, route2.shardId, '同一agent路由到同一分片');
  assert(route1.hashValue.length > 0, '哈希值非空');

  // 不同agent可能路由到不同分片
  const routes = new Set<string>();
  for (let i = 0; i < 100; i++) {
    routes.add(router.route(`agent-${i}`).shardId);
  }
  assertEqual(routes.size, 2, '100个agent应分散到2个分片');

  // getAdapter
  const adapter = router.getAdapter('agent-001');
  assert(adapter !== undefined, '获取适配器成功');

  // 分片统计
  const stats = router.getRingStats();
  assertEqual(stats.totalVirtualNodes, 300, '总虚拟节点300');
  assertEqual(Object.keys(stats.shardDistribution).length, 2, '2个分片');

  // getShards
  const shards = router.getShards();
  assertEqual(shards.length, 2, '2个分片');
}

function testConsistentHashingAddRemove() {
  console.log('\n--- ConsistentHashing 动态扩缩容测试 ---');

  const adapter1 = new MemoryAdapter();
  const adapter2 = new MemoryAdapter();
  const adapter3 = new MemoryAdapter();

  const router = new ConsistentHashingRouter({
    shards: [
      { shardId: 'shard-1', adapter: adapter1, virtualNodeCount: 100 },
      { shardId: 'shard-2', adapter: adapter2, virtualNodeCount: 100 },
    ],
  });

  // 记录扩容前的路由
  const beforeRoutes = new Map<string, string>();
  for (let i = 0; i < 50; i++) {
    const agentId = `agent-${i}`;
    beforeRoutes.set(agentId, router.route(agentId).shardId);
  }

  // 添加分片
  router.addShard({ shardId: 'shard-3', adapter: adapter3, virtualNodeCount: 100 });
  assertEqual(router.getShards().length, 3, '扩容后3个分片');

  // 验证大部分路由未变（一致性哈希特性）
  let changed = 0;
  for (let i = 0; i < 50; i++) {
    const agentId = `agent-${i}`;
    const newRoute = router.route(agentId).shardId;
    if (newRoute !== beforeRoutes.get(agentId)) changed++;
  }
  const changeRate = changed / 50;
  assert(changeRate < 0.5, `扩容后路由变化率 ${changeRate} < 50%`);

  // 移除分片
  const removed = router.removeShard('shard-3');
  assert(removed, '移除成功');
  assertEqual(router.getShards().length, 2, '缩容后2个分片');

  // 移除不存在的分片
  assert(!router.removeShard('nonexistent'), '移除不存在返回false');
}

// ─────────────────────────────────────────────
// ShardedTieredStorage 测试
// ─────────────────────────────────────────────

async function testShardedTieredStorage() {
  console.log('\n--- ShardedTieredStorage 测试 ---');

  const adapter1 = new MemoryAdapter(3600);
  const adapter2 = new MemoryAdapter(3600);

  const sharded = new ShardedTieredStorage({
    shards: [
      { shardId: 'shard-1', adapter: adapter1, virtualNodeCount: 100 },
      { shardId: 'shard-2', adapter: adapter2, virtualNodeCount: 100 },
    ],
  });

  // 保存
  const saveResult = await sharded.saveForAgent('agent-001', {
    id: 'sharded-1',
    data: { msg: 'hello' },
    timestamp: new Date().toISOString(),
  });
  assert(saveResult.success, 'ShardedTieredStorage保存成功');

  // 获取
  const getResult = await sharded.getForAgent('agent-001', 'sharded-1');
  assert(getResult.success, '获取成功');

  // 查询
  const queryResult = await sharded.queryForAgent('agent-001', {});
  assert(queryResult.success, '查询成功');

  // 路由信息
  const route = sharded.routeAgent('agent-001');
  assert(route.shardId.length > 0, '路由结果有shardId');

  // 统计
  const stats = sharded.getRingStats();
  assertGreaterThan(stats.totalVirtualNodes, 0, '虚拟节点数>0');

  // 动态添加分片
  const adapter3 = new MemoryAdapter();
  sharded.addShard({ shardId: 'shard-3', adapter: adapter3, virtualNodeCount: 100 });
  assertEqual(sharded.getShards().length, 3, '添加后3个分片');
}

// ─────────────────────────────────────────────
// createDefaultStorage 测试
// ─────────────────────────────────────────────

async function testCreateDefaultStorage() {
  console.log('\n--- createDefaultStorage 测试 ---');

  const storage = createDefaultStorage(7200);
  await storage.save({ id: 'default-1', data: {}, timestamp: new Date().toISOString() });

  const result = await storage.get('default-1');
  assert(result.success, '默认存储获取成功');

  await storage.clear();
}

// ─────────────────────────────────────────────
// 运行所有测试
// ─────────────────────────────────────────────

async function runAll() {
  console.log('🧪 tiered-storage-p2 单元测试开始\n');
  await testMemoryAdapter();
  await testMemoryAdapterTTL();
  await testMemoryAdapterQueryPagination();
  await testTieredStorage();
  await testTieredStorageFallback();
  await testTieredStorageBatch();
  await testTieredStorageClear();
  testConsistentHashingRouter();
  testConsistentHashingAddRemove();
  await testShardedTieredStorage();
  await testCreateDefaultStorage();
  console.log(`\n📊 测试结果: ${passCount} 通过, ${failCount} 失败`);
  if (failCount > 0) process.exit(1);
}

runAll();
