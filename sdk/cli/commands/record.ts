/**
 * 龙虾学院 CLI — record 录制命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { LobsterBlackbox } from '../../src/index';
import { loadConfig } from '../config';

export const recordCommand = new Command('record')
  .description('🎬 录制 — 记录一条 Agent 决策')
  .requiredOption('-a, --agent <agent-id>', 'Agent 唯一标识')
  .requiredOption('-i, --input <json-file>', '输入数据 JSON 文件')
  .requiredOption('-o, --output <json-file>', '输出数据 JSON 文件')
  .option('-r, --reasoning <text>', '推理过程（可选）')
  .option('-t, --type <type>', '记录类型 (decision|tool_call|error|system)', 'decision')
  .option('-d, --duration <ms>', '耗时（毫秒）')
  .action(async (opts: { agent: string; input: string; output: string; reasoning?: string; type?: string; duration?: string }) => {
    try {
      const config = loadConfig();
      if (!config || config.agentId !== opts.agent) {
        console.error(chalk.red('❌ 未找到该 Agent 的入学配置，请先运行 lobster enroll'));
        process.exit(1);
      }

      // 读取输入文件
      if (!fs.existsSync(opts.input)) {
        console.error(chalk.red(`❌ 输入文件不存在: ${opts.input}`));
        process.exit(1);
      }
      if (!fs.existsSync(opts.output)) {
        console.error(chalk.red(`❌ 输出文件不存在: ${opts.output}`));
        process.exit(1);
      }

      const inputData = JSON.parse(fs.readFileSync(opts.input, 'utf-8'));
      const outputData = JSON.parse(fs.readFileSync(opts.output, 'utf-8'));

      const box = new LobsterBlackbox({
        agentId: opts.agent,
        mode: 'local',
        signingKey: config.signingKey,
      });

      const record = await box.record({
        type: (opts.type as any) ?? 'decision',
        input: inputData,
        reasoning: opts.reasoning,
        output: outputData,
        duration: opts.duration ? parseInt(opts.duration, 10) : undefined,
      });

      console.log(chalk.green('✅ 决策已录制'));
      console.log(chalk.dim(`   ID: ${record.id}`));
      console.log(chalk.dim(`   时间: ${record.timestamp}`));
      console.log(chalk.dim(`   哈希: ${record.hash?.substring(0, 16)}...`));
      if (record.signature) {
        console.log(chalk.dim(`   签名: ${record.signature.substring(0, 16)}...`));
      }
    } catch (err) {
      console.error(chalk.red(`❌ 录制失败: ${(err as Error).message}`));
      process.exit(1);
    }
  });
