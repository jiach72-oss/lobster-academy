/**
 * 龙虾学院 Blackbox — 全插件演示
 * 展示 OpenAI / LangChain / CrewAI / 自定义 四种集成方式
 */

import { LobsterBlackbox } from '../src/index';
import { AgentAdapter, wrapAgentFunction } from '../plugins/custom';

async function demo() {
  console.log('🦞 龙虾学院 Blackbox — 全插件演示\n');

  const box = new LobsterBlackbox({ agentId: 'plugin-demo' });

  // =========================================
  // 1. 自定义 Agent 适配器
  // =========================================
  console.log('═══ 1. 自定义 Agent 适配器 ═══');

  const adapter = new AgentAdapter(box.getRecorder());

  // 模拟 Agent 执行流程
  await adapter.emit({
    type: 'agent_start',
    agentName: 'Researcher',
    input: { task: '调研竞品' },
  });

  await adapter.emit({
    type: 'agent_think',
    agentName: 'Researcher',
    reasoning: '先搜索相关信息，然后分析对比',
  });

  await adapter.emit({
    type: 'agent_tool_call',
    agentName: 'Researcher',
    toolCalls: [{
      tool: 'web_search',
      params: { query: 'AI agent audit tools' },
      result: '找到5个相关工具',
      duration: 1200,
    }],
  });

  await adapter.emit({
    type: 'agent_output',
    agentName: 'Researcher',
    output: { answer: '竞品分析报告：...' },
    duration: 3500,
  });

  console.log(`  ✅ Agent 适配器: ${adapter.count} 个事件已录制`);

  // =========================================
  // 2. 函数包装器
  // =========================================
  console.log('\n═══ 2. 函数包装器 ═══');

  const myAgentFn = wrapAgentFunction(
    box.getRecorder(),
    'DataAnalyst',
    async (input: { query: string }) => {
      // 模拟处理
      await new Promise(r => setTimeout(r, 100));
      return { result: `分析完成: ${input.query}` };
    }
  );

  const result = await myAgentFn({ query: '月度销售数据' });
  console.log(`  ✅ 函数包装器: ${result.result}`);

  // =========================================
  // 3. 报告
  // =========================================
  console.log('\n═══ 3. 汇总报告 ═══');

  const report = box.generateReport();
  console.log(box.toText(report));

  console.log('\n🎉 全插件演示完成！');
  console.log('📦 插件支持: OpenAI ✅ | LangChain ✅ | CrewAI ✅ | 自定义Agent ✅');
}

demo().catch(console.error);
