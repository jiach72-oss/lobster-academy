#!/usr/bin/env node

/**
 * 🪞 Lobster — 明镜 CLI
 * 
 * 一行命令接入明镜，让每只 AI 龙虾都拥有自己的黑匣子。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { enrollCommand } from './commands/enroll';
import { checkCommand } from './commands/check';
import { recordCommand } from './commands/record';
import { reportCommand } from './commands/report';
import { statusCommand } from './commands/status';
import { certificateCommand } from './commands/certificate';
import { verifyCommand } from './commands/verify';

// 从 package.json 读取版本号
let version = '0.1.0';
try {
  const pkg = require('../../package.json');
  version = pkg.version;
} catch {
  // fallback
}

const program = new Command();

program
  .name('lobster')
  .description(chalk.blue('🪞 明镜 CLI — 每只龙虾都该有一个黑匣子'))
  .version(version, '-v, --version', '显示版本号')
  .addHelpText('before', `
${chalk.blue.bold('🪞 明镜 Blackbox SDK')}
${chalk.dim('每只 AI 龙虾都该有一个黑匣子')}
`);

// 注册所有命令
program.addCommand(enrollCommand);
program.addCommand(checkCommand);
program.addCommand(recordCommand);
program.addCommand(reportCommand);
program.addCommand(statusCommand);
program.addCommand(certificateCommand);
program.addCommand(verifyCommand);

// 错误处理
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
});

program.parseAsync(process.argv).catch((err) => {
  // 防止信息泄露：不输出完整堆栈
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`❌ 错误: ${message}`));
  process.exit(1);
});
