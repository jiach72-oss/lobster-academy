/**
 * 明镜 CLI — enroll 入学命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LobsterBlackbox } from '../../src/index';
import { loadConfig, saveConfig } from '../config';

export const enrollCommand = new Command('enroll')
  .description('🪞 注册入学 — 加入明镜')
  .requiredOption('-a, --agent <agent-id>', 'Agent 唯一标识')
  .requiredOption('-d, --department <department>', '院系 (chatbot|agent|saas|fintech|healthcare|general)')
  .action(async (opts: { agent: string; department: string }) => {
    try {
      // 生成密钥对
      const keyPair = LobsterBlackbox.generateKeyPair();

      const box = new LobsterBlackbox({
        agentId: opts.agent,
        mode: 'local',
        signingKey: keyPair.secretKey,
      });

      const enrollment = box.enroll(opts.department);
      const letter = box.welcomeLetter();

      // 输出入学通知书
      console.log(letter);

      // 保存配置
      saveConfig({
        agentId: opts.agent,
        studentId: enrollment.studentId,
        department: enrollment.department,
        enrolledAt: enrollment.enrolledAt,
        signingKey: keyPair.secretKey,
        publicKey: keyPair.publicKey,
        mode: 'local',
      });

      console.log(chalk.green('✅ 配置已保存到 ~/.lobster/config.json'));
      console.log(chalk.gray(`   公钥: ${keyPair.publicKey.substring(0, 32)}...`));
    } catch (err) {
      console.error(chalk.red(`❌ 入学失败: ${(err as Error).message}`));
      process.exit(1);
    }
  });
