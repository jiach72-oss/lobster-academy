/**
 * 狄利克雷分布行为建模模块单元测试
 * 测试: ToolTransitionMatrix, DirichletModel, mahalanobisDistance
 */

import {
  ToolTransitionMatrix,
  DirichletModel,
  mahalanobisDistance,
} from '../dirichlet-model';
import type { ToolCallSequence, BehaviorAnalysis } from '../dirichlet-model';

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

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    failCount++;
    console.log(`❌ FAIL: ${message} - expected ~${expected}, got ${actual} (tolerance ${tolerance})`);
    return;
  }
  passCount++; console.log(`✅ PASS: ${message}`);
}

function assertGreaterThan(a: number, b: number, message: string) {
  if (a <= b) { failCount++; console.log(`❌ FAIL: ${message} - ${a} should be > ${b}`); return; }
  passCount++; console.log(`✅ PASS: ${message}`);
}

// ═══════════════════════════════════════════
// 1. 转移矩阵构建正确性
// ═══════════════════════════════════════════
console.log('\n=== 转移矩阵测试 ===');

// 1.1 基本构建
{
  const matrix = new ToolTransitionMatrix(['search', 'calculate', 'write']);
  matrix.record('search', 'calculate');
  matrix.record('search', 'write');
  matrix.record('calculate', 'write');

  const probs = matrix.getProbabilities();
  assertEqual(probs.length, 3, '矩阵为 3×3');

  // search → (calculate, write) 各1次，概率各 0.5
  assertClose(probs[0][0], 0, 0.01, 'search→search 概率为 0');
  assertClose(probs[0][1], 0.5, 0.01, 'search→calculate 概率为 0.5');
  assertClose(probs[0][2], 0.5, 0.01, 'search→write 概率为 0.5');
}

// 1.2 归一化
{
  const matrix = new ToolTransitionMatrix(['a', 'b']);
  matrix.record('a', 'b');
  matrix.record('a', 'b');
  matrix.record('a', 'a');

  const probs = matrix.getProbabilities();
  assertClose(probs[0][0], 1 / 3, 0.01, 'a→a 概率为 1/3');
  assertClose(probs[0][1], 2 / 3, 0.01, 'a→b 概率为 2/3');
}

// 1.3 无转移时均匀分布
{
  const matrix = new ToolTransitionMatrix(['a', 'b', 'c']);
  const probs = matrix.getProbabilities();
  assertClose(probs[0][0], 1 / 3, 0.01, '无转移时均匀分布');
}

// 1.4 重置功能
{
  const matrix = new ToolTransitionMatrix(['a', 'b']);
  matrix.record('a', 'b');
  matrix.reset();
  const probs = matrix.getProbabilities();
  assertClose(probs[0][0], 0.5, 0.01, 'reset 后均匀分布');
}

// 1.5 未知工具忽略
{
  const matrix = new ToolTransitionMatrix(['a', 'b']);
  matrix.record('a', 'unknown'); // 忽略
  matrix.record('unknown', 'b'); // 忽略
  matrix.record('a', 'b');

  const probs = matrix.getProbabilities();
  assertClose(probs[0][1], 1.0, 0.01, '未知工具转移被忽略');
}

// ═══════════════════════════════════════════
// 2. 狄利克雷分布拟合测试
// ═══════════════════════════════════════════
console.log('\n=== 狄利克雷分布拟合测试 ===');

// 2.1 训练和指纹
{
  const model = new DirichletModel(['search', 'calculate', 'write']);
  const sequences: ToolCallSequence[] = [
    { tools: ['search', 'calculate', 'write'] },
    { tools: ['search', 'write', 'calculate'] },
    { tools: ['search', 'calculate', 'write'] },
    { tools: ['calculate', 'write', 'search'] },
    { tools: ['search', 'calculate', 'write'] },
    { tools: ['write', 'search', 'calculate'] },
    { tools: ['search', 'calculate', 'write'] },
    { tools: ['calculate', 'search', 'write'] },
    { tools: ['search', 'write', 'calculate'] },
    { tools: ['search', 'calculate', 'write'] },
  ];

  model.train(sequences);
  const fingerprint = model.getFingerprint();
  assert(fingerprint.length > 0, '训练后指纹非空');
  assertEqual(fingerprint.length, 9, '指纹维度为 3×3=9');
}

// 2.2 正常行为检测
{
  const model = new DirichletModel(['search', 'calculate', 'write']);
  const normalSequences: ToolCallSequence[] = Array.from({ length: 15 }, () => ({
    tools: ['search', 'calculate', 'write'],
  }));
  model.train(normalSequences);

  const result = model.detect({ tools: ['search', 'calculate', 'write'] });
  assert(result.normal, '正常行为应被识别为 normal');
  assertEqual(result.riskLevel, 'safe', '正常行为风险等级为 safe');
}

// 2.3 异常行为检测
{
  const model = new DirichletModel(['search', 'calculate', 'write']);
  const normalSequences: ToolCallSequence[] = Array.from({ length: 15 }, () => ({
    tools: ['search', 'calculate', 'write'],
  }));
  model.train(normalSequences);

  // 异常序列：从未见过的工具
  const result = model.detect({ tools: ['search', 'hack', 'exploit'] });
  // hack 不在工具列表中，会被忽略，但转移模式不同
  assert(result.mahalanobisDistance !== undefined, '马氏距离已计算');
}

// 2.4 样本不足时返回安全
{
  const model = new DirichletModel(['a', 'b'], { minSamples: 10 });
  model.train([{ tools: ['a', 'b'] }]);

  const result = model.detect({ tools: ['a', 'b'] });
  assert(result.normal, '样本不足时返回 normal=true');
  assertEqual(result.riskLevel, 'safe', '样本不足时 riskLevel=safe');
}

// ═══════════════════════════════════════════
// 3. 马氏距离计算测试
// ═══════════════════════════════════════════
console.log('\n=== 马氏距离计算测试 ===');

// 3.1 相同点距离为 0
{
  const mu = [1, 2, 3];
  const sigmaInv = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const dist = mahalanobisDistance(mu, mu, sigmaInv);
  assertClose(dist, 0, 0.001, '相同点马氏距离为 0');
}

// 3.2 单位协方差矩阵时等于欧氏距离
{
  const mu = [0, 0];
  const x = [3, 4];
  const sigmaInv = [
    [1, 0],
    [0, 1],
  ];
  const dist = mahalanobisDistance(x, mu, sigmaInv);
  assertClose(dist, 5, 0.001, '单位协方差矩阵时等于欧氏距离(3,4→5)');
}

// 3.3 不同方向上的缩放
{
  const mu = [0, 0];
  const x = [1, 0];
  // 协方差在 x 方向为 0.25（σ²），逆矩阵为 4
  const sigmaInv = [
    [4, 0],
    [0, 1],
  ];
  const dist = mahalanobisDistance(x, mu, sigmaInv);
  // D² = 1² × 4 = 4, D = 2
  assertClose(dist, 2, 0.001, '缩放后马氏距离为 2');
}

// 3.4 二维空间中的距离
{
  const mu = [1, 1];
  const x = [4, 5];
  const sigmaInv = [
    [1, 0],
    [0, 1],
  ];
  const dist = mahalanobisDistance(x, mu, sigmaInv);
  assertClose(dist, 5, 0.001, '二维欧氏距离 sqrt(9+16)=5');
}

// ═══════════════════════════════════════════
// 4. 异常检测准确率测试
// ═══════════════════════════════════════════
console.log('\n=== 异常检测准确率测试 ===');

// 4.1 对已知正常模式的准确识别
{
  const model = new DirichletModel(['search', 'calculate', 'write']);
  const normalPattern: ToolCallSequence[] = Array.from({ length: 20 }, () => ({
    tools: ['search', 'calculate', 'write'],
  }));
  model.train(normalPattern);

  let correctCount = 0;
  for (const seq of normalPattern) {
    const result = model.detect(seq);
    if (result.normal) correctCount++;
  }
  assertEqual(correctCount, normalPattern.length, '所有正常序列被正确识别');
}

// 4.2 不同风险等级
{
  const model = new DirichletModel(['a', 'b', 'c'], { anomalyThreshold: 2.0 });
  model.train(Array.from({ length: 20 }, () => ({ tools: ['a', 'b', 'c'] })));

  const result = model.detect({ tools: ['a', 'b', 'c'] });
  assert(['safe', 'warning', 'alert', 'critical'].includes(result.riskLevel),
    `风险等级 ${result.riskLevel} 为有效值`);
}

// 4.3 deviantTools 识别（未知工具）
{
  const model = new DirichletModel(['search', 'calculate'], { minSamples: 1 });
  model.train([{ tools: ['search', 'calculate'] }]);
  // 使用不在列表中的工具
  const result = model.detect({ tools: ['search', 'unknown_tool'] });
  assert(result.deviantTools.includes('unknown_tool'), '未知工具应在 deviantTools 中');
}

// ═══════════════════════════════════════════
// 5. 在线学习更新测试
// ═══════════════════════════════════════════
console.log('\n=== 在线学习更新测试 ===');

// 5.1 在线更新
{
  const model = new DirichletModel(['a', 'b', 'c']);
  model.train(Array.from({ length: 12 }, () => ({ tools: ['a', 'b', 'c'] })));

  const fpBefore = [...model.getFingerprint()];

  // 在线更新
  model.update({ tools: ['a', 'c', 'b'] });
  model.update({ tools: ['c', 'b', 'a'] });

  const fpAfter = model.getFingerprint();
  assert(fpAfter.length === fpBefore.length, '更新后指纹维度不变');
}

// 5.2 关闭在线学习
{
  const model = new DirichletModel(['a', 'b'], { onlineLearning: false });
  model.train(Array.from({ length: 15 }, () => ({ tools: ['a', 'b'] })));

  const fpBefore = [...model.getFingerprint()];
  model.update({ tools: ['b', 'a'] }); // 应该无效
  const fpAfter = model.getFingerprint();

  // 指纹不应变化（因为 onlineLearning=false）
  const changed = fpBefore.some((v, i) => Math.abs(v - fpAfter[i]) > 0.001);
  assert(!changed, '关闭在线学习后指纹不变');
}

// 5.3 导出/导入
{
  const model = new DirichletModel(['a', 'b', 'c']);
  model.train(Array.from({ length: 15 }, () => ({ tools: ['a', 'b', 'c'] })));

  const snapshot = model.export();
  assertEqual(snapshot.tools.length, 3, '快照包含工具列表');
  assertGreaterThan(snapshot.sampleCount, 0, '快照包含样本计数');
  assert(snapshot.alphaMatrix.length > 0, '快照包含 alpha 矩阵');

  const model2 = new DirichletModel(['a', 'b', 'c']);
  model2.import(snapshot);

  const fp1 = model.getFingerprint();
  const fp2 = model2.getFingerprint();
  assertEqual(fp1.length, fp2.length, '导入后指纹维度一致');

  const allMatch = fp1.every((v, i) => Math.abs(v - fp2[i]) < 0.001);
  assert(allMatch, '导入后指纹值一致');
}

// 5.4 BehaviorAnalysis 结构完整性
{
  const model = new DirichletModel(['a', 'b']);
  model.train(Array.from({ length: 15 }, () => ({ tools: ['a', 'b'] })));

  const result = model.detect({ tools: ['a', 'b'] });
  assertEqual(typeof result.normal, 'boolean', 'normal 为布尔值');
  assertEqual(typeof result.mahalanobisDistance, 'number', 'mahalanobisDistance 为数字');
  assert(['safe', 'warning', 'alert', 'critical'].includes(result.riskLevel), 'riskLevel 有效');
  assert(Array.isArray(result.deviantTools), 'deviantTools 为数组');
  assert(Array.isArray(result.fingerprint), 'fingerprint 为数组');
}

// ─────────────────────────────────────────────
// 汇总
// ─────────────────────────────────────────────
console.log(`\n${'='.repeat(40)}`);
console.log(`狄利克雷模型测试: ${passCount} 通过, ${failCount} 失败`);
console.log(`${'='.repeat(40)}`);

if (failCount > 0) {
  process.exit(1);
}
