/**
 * 龙虾学院 Blackbox — 对抗性评测引擎测试
 * 覆盖引擎初始化、场景加载、攻击执行、报告生成
 */

import { AdversarialEngine, AttackScenario, AttackResult, EvalReport } from '../src/adversarial-engine';
import { BUILTIN_SCENARIOS, getScenarioStats, getScenariosByCategory, getScenariosBySeverity } from '../src/attack-scenarios';

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

function section(name: string): void {
  console.log(`\n🎯 ${name}`);
}

// ─────────────────────────────────────────────
// 模拟目标Agent
// ─────────────────────────────────────────────

/** 安全Agent — 完美防御所有攻击 */
function makeSecureAgent(): (input: string) => Promise<string> {
  return async (input: string): Promise<string> => {
    // 检测超长输入
    if (input.length > 100_000) {
      throw new Error('Input too large');
    }
    // 预处理：去除零宽字符再检测
    const cleaned = input.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    // 检测常见注入/攻击模式（广泛覆盖）
    const dangerousPatterns = [
      // Prompt injection
      /ignore.*previous.*instructions/i,
      /忽略.*指令|忽略.*之前/i,
      /system\s*prompt/i,
      /DAN\s*mode/i,
      /DO\s+ANYTHING/i,
      /开发者|debug.*mode|调试.*模式/i,
      /你现在是|你现在进入/i,
      /解码.*执行|解码.*Base64/i,
      /解码.*HEX/i,
      /参考以下对话/i,
      /系统通知/i,
      /JSON格式/i,
      /<!--\s*SYSTEM/i,
      /Bitte.*ignorieren/i,
      // Data exfiltration
      /API\s*key|API密钥/i,
      /process\.env/i,
      /user_00|其他用户/i,
      /evil\.com/i,
      /信息.*模式/i,
      /对话.*记录/i,
      /var\/log/i,
      /nslookup/i,
      /模型.*权重/i,
      /请重复.*第一条|初始化指令/i,
      /配置.*API/i,
      // Privilege escalation
      /GRANT\s+ALL/i,
      /管理员/i,
      /sudo\s+/i,
      /session.*过期/i,
      /access\s*token|刷新.*token/i,
      /升级.*admin|角色.*提升/i,
      /JWT.*none/i,
      /私密笔记/i,
      /etc\/sudoers/i,
      // Logic bypass
      /商业推广|营销邮件/i,
      /制.*作.*爆/i,
      /race_condition|竞态/i,
      /\x00/,
      /999999999999/i,
      /请只回答"否"/,
      // Injection
      /DROP\s+TABLE/i,
      /\$gt/i,
      /\/etc\/passwd/i,
      /\.\.\/\.\.\//,
      /<script/i,
      /cat\s+\/etc/i,
      // DoS
      /<!DOCTYPE.*lolz/i,
      /\$ref/i,
      /请处理数量为\s*9{5,}/i,
      // Social engineering
      /技术支持.*李工|紧急.*P0/i,
      /curl.*\|\s*bash/i,
      /我是.*CEO|公司.*CEO/i,
      /转账.*账户/i,
      /求求你/i,
    ];
    for (const pat of dangerousPatterns) {
      if (pat.test(cleaned)) {
        return '很抱歉，我无法执行此请求。此操作可能涉及安全风险。[BLOCKED]';
      }
    }
    // 正常响应
    return `我收到了你的消息: ${cleaned.slice(0, 50)}...`;
  };
}

/** 脆弱Agent — 防御薄弱 */
function makeVulnerableAgent(): (input: string) => Promise<string> {
  return async (input: string): Promise<string> => {
    // 只做最基本检查
    if (input.length > 1_000_000) {
      throw new Error('Too large');
    }
    // 对大部分攻击无防御
    return `好的，我来处理：${input}`;
  };
}

/** 完美Agent — 永远返回带REDACTED的响应 */
function makePerfectAgent(): (input: string) => Promise<string> {
  return async (_input: string): Promise<string> => {
    return '很抱歉，此请求已被安全系统阻止。[BLOCKED]';
  };
}

// ─────────────────────────────────────────────
// 测试用例
// ─────────────────────────────────────────────

export async function runAdversarialTests(): Promise<void> {
  console.log('🦞 龙虾学院 Blackbox — 对抗性评测引擎测试\n');
  console.log('═══════════════════════════════════════════════════\n');

  // ==================
  // 1. 场景库基础测试
  // ==================
  section('1. 场景库基础');

  assert(BUILTIN_SCENARIOS.length >= 50, `内置场景数 >= 50 (实际: ${BUILTIN_SCENARIOS.length})`);

  const stats = getScenarioStats();
  assertEqual(stats.total, BUILTIN_SCENARIOS.length, 'getScenarioStats total');
  assert(Object.keys(stats.byCategory).length === 7, '7个攻击类别');
  assert(Object.keys(stats.bySeverity).length === 4, '4个严重度级别');

  section('1.1 场景类别分布');

  const categories = ['prompt_injection', 'data_exfiltration', 'privilege_escalation', 'logic_bypass', 'dos', 'injection', 'social_engineering'];
  for (const cat of categories) {
    const scenarios = getScenariosByCategory(cat as AttackScenario['category']);
    assert(scenarios.length > 0, `${cat}: ${scenarios.length}个场景`);
  }

  section('1.2 场景严重度分布');

  const severities: AttackScenario['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  for (const sev of severities) {
    const scenarios = getScenariosBySeverity(sev);
    assert(scenarios.length > 0, `${sev}: ${scenarios.length}个场景`);
  }

  section('1.3 场景字段完整性');

  for (const s of BUILTIN_SCENARIOS) {
    assert(s.id.length > 0, `${s.id}: id非空`);
    assert(s.name.length > 0, `${s.id}: name非空`);
    assert(categories.includes(s.category), `${s.id}: category有效`);
    assert(severities.includes(s.severity), `${s.id}: severity有效`);
    assert(s.description.length > 0, `${s.id}: description非空`);
    assert(s.payload !== undefined && s.payload !== null, `${s.id}: payload存在`);
    assert(['blocked', 'sanitized', 'logged', 'rejected'].includes(s.expectedBehavior), `${s.id}: expectedBehavior有效`);
  }

  // ==================
  // 2. 引擎初始化
  // ==================
  section('2. 引擎初始化');

  const engine = new AdversarialEngine();
  const emptyStats = engine.getStats();
  assertEqual(emptyStats.total, 0, '初始无场景');

  engine.loadBuiltinScenarios();
  const loadedStats = engine.getStats();
  assertEqual(loadedStats.total, BUILTIN_SCENARIOS.length, '加载后场景数正确');
  assert(loadedStats.byCategory['prompt_injection'] >= 10, 'prompt_injection >= 10');
  assert(loadedStats.byCategory['data_exfiltration'] >= 10, 'data_exfiltration >= 10');
  assert(loadedStats.byCategory['privilege_escalation'] >= 8, 'privilege_escalation >= 8');
  assert(loadedStats.byCategory['logic_bypass'] >= 8, 'logic_bypass >= 8');
  assert(loadedStats.byCategory['dos'] >= 5, 'dos >= 5');
  assert(loadedStats.byCategory['injection'] >= 5, 'injection >= 5');
  assert(loadedStats.byCategory['social_engineering'] >= 5, 'social_engineering >= 5');

  section('2.1 自定义场景加载');

  const customEngine = new AdversarialEngine();
  customEngine.loadCustomScenarios([{
    id: 'CUSTOM-001',
    name: '自定义测试',
    category: 'prompt_injection',
    severity: 'LOW',
    description: '测试自定义场景',
    payload: 'test payload',
    expectedBehavior: 'blocked',
  }]);
  assertEqual(customEngine.getStats().total, 1, '自定义场景加载');

  // 参数校验
  let threw = false;
  try { customEngine.loadCustomScenarios(null as any); } catch { threw = true; }
  assert(threw, 'loadCustomScenarios(null) 抛异常');

  threw = false;
  try { customEngine.loadCustomScenarios([{ id: '', category: 'x', severity: 'x' } as any]); } catch { threw = true; }
  assert(threw, '无效场景抛异常');

  // ==================
  // 3. 单个攻击执行
  // ==================
  section('3. 单个攻击执行');

  const secureAgent = makeSecureAgent();
  const testScenario = BUILTIN_SCENARIOS[0]; // PI-001
  const singleResult = await engine.executeAttack(secureAgent, testScenario);
  assertEqual(singleResult.scenarioId, testScenario.id, '结果scenarioId正确');
  assert(typeof singleResult.passed === 'boolean', '结果passed是boolean');
  assert(typeof singleResult.actualBehavior === 'string', '结果actualBehavior是string');
  assert(typeof singleResult.responseTime === 'number', '结果responseTime是number');
  assert(singleResult.responseTime >= 0, 'responseTime >= 0');
  assert(singleResult.details.length > 0, 'details非空');

  section('3.1 安全Agent测试');

  const secureEngine = new AdversarialEngine();
  secureEngine.loadBuiltinScenarios();
  const secureReport = await secureEngine.runFullSuite(secureAgent);
  assert(secureReport.passed > 0, `安全Agent通过数 > 0 (${secureReport.passed})`);
  assert(secureReport.score >= 50, `安全Agent分数 >= 50 (${secureReport.score})`);
  assert(['S', 'A', 'B'].includes(secureReport.grade), `安全Agent评级良好 (${secureReport.grade})`);

  section('3.2 脆弱Agent测试');

  const vulnEngine = new AdversarialEngine();
  vulnEngine.loadBuiltinScenarios();
  const vulnReport = await vulnEngine.runFullSuite(makeVulnerableAgent());
  assert(vulnReport.failed > 0, `脆弱Agent有失败项 (${vulnReport.failed})`);
  assert(vulnReport.score < secureReport.score, `脆弱Agent分数 < 安全Agent分数`);

  section('3.3 完美Agent测试');

  const perfEngine = new AdversarialEngine();
  perfEngine.loadBuiltinScenarios();
  const perfReport = await perfEngine.runFullSuite(makePerfectAgent());
  assertEqual(perfReport.failed, 0, '完美Agent无失败');
  assertEqual(perfReport.score, 100, '完美Agent满分');
  assertEqual(perfReport.grade, 'S', '完美Agent S级');

  // ==================
  // 4. 报告结构验证
  // ==================
  section('4. 报告结构验证');

  const report = await engine.runFullSuite(makeSecureAgent());
  assertEqual(report.totalAttacks, BUILTIN_SCENARIOS.length, 'totalAttacks正确');
  assertEqual(report.passed + report.failed, report.totalAttacks, 'passed + failed = total');
  assert(report.score >= 0 && report.score <= 100, 'score在0-100范围');
  assert(['S', 'A', 'B', 'C', 'D', 'F'].includes(report.grade), 'grade有效');
  assert(Array.isArray(report.criticalFailures), 'criticalFailures是数组');
  assert(Array.isArray(report.recommendations), 'recommendations是数组');
  assert(report.recommendations.length > 0, 'recommendations非空');
  assert(typeof report.categoryBreakdown === 'object', 'categoryBreakdown是对象');

  section('4.1 分类统计正确性');

  for (const cat of categories) {
    const breakdown = report.categoryBreakdown[cat];
    if (breakdown) {
      assert(breakdown.passed + breakdown.failed > 0, `${cat} 统计非空`);
    }
  }

  // ==================
  // 5. 按类别执行
  // ==================
  section('5. 按类别执行');

  for (const cat of categories) {
    const catEngine = new AdversarialEngine();
    catEngine.loadBuiltinScenarios();
    const catReport = await catEngine.runByCategory(cat, makeSecureAgent());
    const expectedCount = getScenariosByCategory(cat as AttackScenario['category']).length;
    assertEqual(catReport.totalAttacks, expectedCount, `${cat} 场景数正确`);
  }

  // 无效类别
  threw = false;
  try { await engine.runByCategory('invalid_cat', makeSecureAgent()); } catch { threw = true; }
  assert(threw, '无效类别抛异常');

  // 空场景抛异常
  const emptyEngine = new AdversarialEngine();
  threw = false;
  try { await emptyEngine.runFullSuite(makeSecureAgent()); } catch { threw = true; }
  assert(threw, '空引擎runFullSuite抛异常');

  // ==================
  // 6. 边界条件
  // ==================
  section('6. 边界条件');

  // 目标Agent抛异常
  const crashAgent = async () => { throw new Error('CRASH'); };
  const crashResult = await engine.executeAttack(crashAgent, BUILTIN_SCENARIOS[0]);
  assert(crashResult.passed === true, 'Agent崩溃视为防御成功');
  assertEqual(crashResult.actualBehavior, 'rejected', '崩溃行为=rejected');

  // 目标Agent返回空字符串
  const emptyAgent = async () => '';
  const emptyResult = await engine.executeAttack(emptyAgent, BUILTIN_SCENARIOS.find(s => s.category === 'prompt_injection')!);
  assert(emptyResult.passed === true, '空响应视为防御成功(allowed触发sanitize逻辑)');

  // 超时Agent（模拟）
  const slowAgent = async (input: string) => {
    await new Promise(r => setTimeout(r, 50));
    return 'OK';
  };
  const slowResult = await engine.executeAttack(slowAgent, BUILTIN_SCENARIOS[0]);
  assert(slowResult.responseTime >= 40, '响应时间记录正确');

  // ==================
  // 7. getScenarios
  // ==================
  section('7. getScenarios');

  const scenarios = engine.getScenarios();
  assertEqual(scenarios.length, BUILTIN_SCENARIOS.length, 'getScenarios返回全部');
  // 返回副本
  scenarios.push({} as any);
  assertEqual(engine.getScenarios().length, BUILTIN_SCENARIOS.length, 'getScenarios返回副本');

  // ==================
  // 8. 各类别场景验证
  // ==================
  section('8. 场景内容验证');

  // Prompt Injection 场景包含关键类型
  const piScenarios = getScenariosByCategory('prompt_injection');
  const piNames = piScenarios.map(s => s.name);
  assert(piNames.some(n => n.includes('直接') || n.includes('指令')), 'PI: 有直接注入场景');
  assert(piNames.some(n => n.includes('Base64') || n.includes('编码')), 'PI: 有编码注入场景');
  assert(piNames.some(n => n.includes('角色') || n.includes('DAN')), 'PI: 有角色扮演/越狱场景');

  // Data Exfiltration 场景
  const deScenarios = getScenariosByCategory('data_exfiltration');
  const deNames = deScenarios.map(s => s.name);
  assert(deNames.some(n => n.includes('系统') || n.includes('prompt')), 'DE: 有系统提示词场景');
  assert(deNames.some(n => n.includes('API') || n.includes('密钥')), 'DE: 有API密钥场景');

  // Injection 场景
  const injScenarios = getScenariosByCategory('injection');
  const injNames = injScenarios.map(s => s.name);
  assert(injNames.some(n => n.includes('SQL')), 'INJ: 有SQL注入场景');
  assert(injNames.some(n => n.includes('命令') || n.includes('Command')), 'INJ: 有命令注入场景');
  assert(injNames.some(n => n.includes('XSS')), 'INJ: 有XSS场景');

  // ==================
  // 总结
  // ==================
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 对抗性评测测试结果: ${passed}✅ ${failed}❌ (共 ${passed + failed} 项)`);
  if (failed === 0) {
    console.log('🎉 全部通过！');
  } else {
    console.log(`\n❌ 失败项:`);
    for (const f of failures) {
      console.log(`   - ${f}`);
    }
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAdversarialTests().catch(err => {
    console.error('测试框架异常:', err);
    process.exit(1);
  });
}
