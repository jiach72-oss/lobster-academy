/**
 * academy-flow 单元测试
 * 测试: 注册入学、学号生成、学习路径、毕业检查、学期管理
 */

import { AcademyFlow } from '../academy-flow';
import type { EvalRecord } from '../types';

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
// 辅助函数
// ─────────────────────────────────────────────

function makeDims(overrides: Partial<EvalRecord['dimensions']> = {}): EvalRecord['dimensions'] {
  return {
    security: overrides.security ?? { score: 40, max: 50 },
    reliability: overrides.reliability ?? { score: 35, max: 50 },
    observability: overrides.observability ?? { score: 30, max: 50 },
    compliance: overrides.compliance ?? { score: 38, max: 50 },
    explainability: overrides.explainability ?? { score: 25, max: 50 },
  };
}

// ─────────────────────────────────────────────
// 注册入学测试
// ─────────────────────────────────────────────

function testRegister() {
  console.log('\n--- 注册入学测试 ---');

  const flow = new AcademyFlow();
  const studentId = flow.register('agent-001', 'security');

  assert(studentId.startsWith('LS-'), '学号格式为LS-YYYYMMDD-NNNN');
  assertEqual(studentId.length, 16, '学号长度16');

  const enrollment = flow.getFlow();
  assert(enrollment !== null, '注册后getFlow返回非null');
  assertEqual(enrollment!.agentId, 'agent-001', 'Agent ID正确');
  assertEqual(enrollment!.department, 'security', '院系正确');
  assertEqual(enrollment!.stage, 'registered', '阶段为registered');

  // 重复注册返回原学号
  const sameId = flow.register('agent-002', 'other');
  assertEqual(sameId, studentId, '重复注册返回原学号');
}

function testEnroll() {
  console.log('\n--- 入学流程测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001', 'chatbot');

  const enrolled = flow.enroll();
  assert(enrolled !== null, '入学成功');
  assertEqual(enrolled!.stage, 'enrolled', '阶段为enrolled');
  assert(enrolled!.enrolledAt !== null, '入学时间已设置');
}

// ─────────────────────────────────────────────
// 摸底考试测试
// ─────────────────────────────────────────────

function testAssessment() {
  console.log('\n--- 摸底考试测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001');
  flow.enroll();

  const dims = makeDims();
  const result = flow.completeAssessment(dims);

  assertEqual(result.sequence, 1, '序号为1');
  assertEqual(result.totalScore, 168, '总分168 (40+35+30+38+25)');
  assertEqual(result.grade, 'B', '等级B (168/250=67.2% → B)');

  const flowState = flow.getFlow();
  assertEqual(flowState!.stage, 'learning', '摸底后进入learning');
  assertEqual(flowState!.assessmentScore, 168, '摸底分数168');

  // 学期创建
  const semesters = flow.getSemesters();
  assert(semesters.length > 0, '应创建学期');
}

// ─────────────────────────────────────────────
// 学习路径测试
// ─────────────────────────────────────────────

function testLearningPath() {
  console.log('\n--- 学习路径测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001');
  flow.enroll();

  // 低分摸底
  const lowDims = makeDims({
    security: { score: 15, max: 50 },
    reliability: { score: 10, max: 50 },
  });
  flow.completeAssessment(lowDims);

  const path = flow.getLearningPath();
  assertEqual(path.currentStage, 'learning', '当前阶段learning');
  assertGreaterThan(path.recommendedCourses.length, 0, '应有推荐课程');
  assert(path.nextMilestone !== null, '应有下一个里程碑');

  // 最弱维度的课程优先级最高
  const sortedCourses = [...path.recommendedCourses].sort((a, b) => b.priority - a.priority);
  assert(sortedCourses[0].priority >= 4, '最弱维度课程优先级应>=4');

  // 进度百分比
  assert(path.progressPercent >= 0 && path.progressPercent <= 100, '进度在0-100之间');
}

function testLearningPathNoAssessment() {
  console.log('\n--- 无考试的学习路径测试 ---');

  const flow = new AcademyFlow();
  const path = flow.getLearningPath();

  assertEqual(path.recommendedCourses.length, 0, '无考试无推荐');
  assert(path.nextMilestone !== null, '应有默认里程碑');
}

// ─────────────────────────────────────────────
// 毕业检查测试
// ─────────────────────────────────────────────

function testGraduationCheck() {
  console.log('\n--- 毕业检查测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001');
  flow.enroll();

  // 未考试
  const noTestCheck = flow.checkGraduation();
  assert(!noTestCheck.eligible, '未考试不可毕业');
  assert(noTestCheck.unmetConditions.length > 0, '有未满足条件');

  // 低分
  flow.completeAssessment(makeDims());
  const lowCheck = flow.checkGraduation();
  assert(!lowCheck.eligible, '低分不可毕业');
  assert(lowCheck.unmetConditions.some(c => c.includes('等级')), '应有等级条件');
  assert(lowCheck.unmetConditions.some(c => c.includes('评测')), '应有评测次数条件');
}

function testSGradeAutoGraduate() {
  console.log('\n--- S级自动毕业测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001');
  flow.enroll();

  // 高分摸底 (S级)
  const highDims = makeDims({
    security: { score: 48, max: 50 },
    reliability: { score: 47, max: 50 },
    observability: { score: 46, max: 50 },
    compliance: { score: 45, max: 50 },
    explainability: { score: 44, max: 50 },
  });
  flow.completeAssessment(highDims); // 总分 230

  // 再记录2次高分评测以满足3次条件
  flow.recordEval(highDims);
  flow.recordEval(highDims);

  const check = flow.checkGraduation();
  assert(check.eligible, 'S级+3次评测可毕业');

  const graduatedAt = flow.graduate();
  assert(graduatedAt !== null, '毕业成功');

  const flowState = flow.getFlow();
  assertEqual(flowState!.stage, 'graduated', '阶段为graduated');
}

function testGraduateFail() {
  console.log('\n--- 毕业失败测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001');
  flow.completeAssessment(makeDims());

  const result = flow.graduate();
  assertEqual(result, null, '不满足条件不可毕业');
}

// ─────────────────────────────────────────────
// 评测记录测试
// ─────────────────────────────────────────────

function testRecordEval() {
  console.log('\n--- 评测记录测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001');

  const dims = makeDims();
  flow.recordEval(dims, 'v1.0');

  const history = flow.getHistory();
  assertEqual(history.length, 1, '历史记录1条');
  assertEqual(history[0].agentVersion, 'v1.0', '版本号正确');

  // 多次记录
  flow.recordEval(dims, 'v1.1');
  flow.recordEval(dims, 'v1.2');
  assertEqual(flow.getHistory().length, 3, '历史记录3条');

  const flowState = flow.getFlow();
  assertEqual(flowState!.currentGrade, 'B', '当前等级B');
}

// ─────────────────────────────────────────────
// 学期管理测试
// ─────────────────────────────────────────────

function testSemesterManagement() {
  console.log('\n--- 学期管理测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001');

  const dims = makeDims();
  flow.recordEval(dims);

  const semesters = flow.getSemesters();
  assert(semesters.length >= 1, '应有至少1个学期');

  const semester = semesters[0];
  assertEqual(semester.evals.length, 1, '学期有1条评测');
  assert(semester.avgScore > 0, '学期平均分>0');

  // 按学期获取评测
  const semEvals = flow.getSemesterEvals(semester.id);
  assertEqual(semEvals.length, 1, '按学期获取评测1条');
}

// ─────────────────────────────────────────────
// 统计测试
// ─────────────────────────────────────────────

function testStats() {
  console.log('\n--- 统计测试 ---');

  const flow = new AcademyFlow();
  flow.register('agent-001');

  const dims = makeDims();
  flow.recordEval(dims);
  flow.recordEval(dims);

  const stats = flow.getStats();
  assertEqual(stats.totalEvals, 2, '总评测2次');
  assert(stats.avgScore > 0, '平均分>0');
  assert(stats.maxScore > 0, '最高分>0');
  assertEqual(stats.gradeProgress['B'], 2, 'B级2次');
}

// ─────────────────────────────────────────────
// 运行所有测试
// ─────────────────────────────────────────────

function runAll() {
  console.log('🧪 academy-flow 单元测试开始\n');
  testRegister();
  testEnroll();
  testAssessment();
  testLearningPath();
  testLearningPathNoAssessment();
  testGraduationCheck();
  testSGradeAutoGraduate();
  testGraduateFail();
  testRecordEval();
  testSemesterManagement();
  testStats();
  console.log(`\n📊 测试结果: ${passCount} 通过, ${failCount} 失败`);
  if (failCount > 0) process.exit(1);
}

runAll();
