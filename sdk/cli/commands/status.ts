/**
 * 明镜 CLI — status 状态命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LobsterBlackbox } from '../../src/index';
import { loadConfig } from '../config';

export const statusCommand = new Command('status')
  .description('📋 状态 — 查看 Agent 当前状态')
  .requiredOption('-a, --agent <agent-id>', 'Agent 唯一标识')
  .action(async (opts: { agent: string }) => {
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

      box.enroll(config.department ?? 'general');
      const enrollment = box.getEnrollment();
      const latestEval = box.getLatestEval();
      const badges = box.getUnlockedBadges();
      const history = box.getHistory();

      console.log('');
      console.log(chalk.blue.bold('🪞 明镜 · Agent 状态'));
      console.log(chalk.dim('─'.repeat(40)));
      console.log(`  Agent ID:  ${chalk.white(opts.agent)}`);
      console.log(`  学号:      ${chalk.white(config.studentId ?? '未入学')}`);
      console.log(`  院系:      ${chalk.white(config.department ?? '未选择')}`);
      console.log(`  入学时间:  ${config.enrolledAt ? chalk.white(config.enrolledAt.substring(0, 19)) : chalk.gray('未入学')}`);
      console.log(`  当前等级:  ${enrollment ? chalk.yellow(enrollment.currentGrade + '级') : chalk.gray('未知')}`);

      if (latestEval) {
        const gradeIcon = latestEval.grade === 'S' ? '🪞' : latestEval.grade === 'A' ? '🌟' : '✅';
        console.log(chalk.dim('─'.repeat(40)));
        console.log(chalk.yellow('  最近评测:'));
        console.log(`    时间:  ${latestEval.timestamp.substring(0, 19)}`);
        console.log(`    总分:  ${chalk.bold(latestEval.totalScore.toFixed(1))} → ${latestEval.grade}级 ${gradeIcon}`);
        console.log(`    安全性:      ${latestEval.dimensions.security.score.toFixed(1)}/100`);
        console.log(`    可靠性:      ${latestEval.dimensions.reliability.score.toFixed(1)}/100`);
        console.log(`    可观测性:    ${latestEval.dimensions.observability.score.toFixed(1)}/100`);
        console.log(`    合规性:      ${latestEval.dimensions.compliance.score.toFixed(1)}/100`);
        console.log(`    可解释性:    ${latestEval.dimensions.explainability.score.toFixed(1)}/100`);
      } else {
        console.log(chalk.dim('  尚未进行过体检'));
      }

      console.log(chalk.dim('─'.repeat(40)));
      console.log(`  评测次数:  ${chalk.white(String(history.length))}`);

      if (badges.length > 0) {
        console.log(chalk.yellow('  已解锁徽章:'));
        for (const b of badges) {
          console.log(`    ${b.icon} ${b.name} — ${b.description}`);
        }
      } else {
        console.log(chalk.dim('  尚未解锁任何徽章'));
      }

      console.log('');
    } catch (err) {
      console.error(chalk.red(`❌ 查询状态失败: ${(err as Error).message}`));
      process.exit(1);
    }
  });
