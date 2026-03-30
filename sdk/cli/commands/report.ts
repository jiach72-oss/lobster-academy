/**
 * 龙虾学院 CLI — report 报告命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LobsterBlackbox, ReporterV2, ReportFormat, ReportData } from '../../src/index';
import { loadConfig } from '../config';

export const reportCommand = new Command('report')
  .description('📊 报告 — 生成 Agent 审计报告')
  .requiredOption('-a, --agent <agent-id>', 'Agent 唯一标识')
  .option('-f, --format <format>', '输出格式 (json|markdown|html|text)', 'text')
  .action(async (opts: { agent: string; format: string }) => {
    try {
      const config = loadConfig();
      if (!config || config.agentId !== opts.agent) {
        console.error(chalk.red('❌ 未找到该 Agent 的入学配置，请先运行 lobster enroll'));
        process.exit(1);
      }

      const box = new LobsterBlackbox({
        agentId: opts.agent,
        mode: 'local',
        signingKey: config.signingKey,
      });

      const fmt = opts.format as ReportFormat;
      if (!['json', 'markdown', 'html', 'text'].includes(fmt)) {
        console.error(chalk.red(`❌ 不支持的格式: ${fmt}，可选: json, markdown, html, text`));
        process.exit(1);
      }

      // 用 ReporterV2 生成报告
      const reporter = new ReporterV2({ defaultFormat: fmt });

      // 从 Recorder 获取记录并构建 ReportData
      const records = box.getRecorder().getRecords();
      const reportData: ReportData = {
        id: `report-${Date.now()}`,
        agentId: opts.agent,
        title: `龙虾学院审计报告 — ${opts.agent}`,
        totalScore: 0,
        grade: 'N/A',
        dimensions: [],
        generatedAt: new Date().toISOString(),
        metadata: {
          totalRecords: records.length,
          department: config.department,
          studentId: config.studentId,
        },
      };

      const output = reporter.generate(reportData, fmt);
      console.log(output);

      console.log(chalk.green(`\n✅ 报告生成完成 (格式: ${fmt})`));
    } catch (err) {
      console.error(chalk.red(`❌ 报告生成失败: ${(err as Error).message}`));
      process.exit(1);
    }
  });
