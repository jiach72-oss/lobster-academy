/**
 * 明镜 CLI — verify 签名验证命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Signer } from '../../src/index';

export const verifyCommand = new Command('verify')
  .description('🔐 验证 — 验证 Ed25519 签名')
  .requiredOption('-s, --signature <sig>', '签名（base64 编码）')
  .requiredOption('-k, --public-key <key>', '公钥（base64 编码）')
  .requiredOption('-d, --data <data>', '待验证的数据（字符串）')
  .action(async (opts: { signature: string; publicKey: string; data: string }) => {
    try {
      const dataHash = Signer.hash(opts.data);
      const valid = Signer.verify(dataHash, opts.signature, opts.publicKey);

      if (valid) {
        console.log(chalk.green('✅ 签名验证通过'));
        console.log(chalk.dim(`   数据哈希: ${dataHash.substring(0, 32)}...`));
        console.log(chalk.dim(`   公钥: ${opts.publicKey.substring(0, 32)}...`));
      } else {
        console.log(chalk.red('❌ 签名验证失败'));
        console.log(chalk.dim('   可能原因：'));
        console.log(chalk.dim('   - 签名与数据不匹配'));
        console.log(chalk.dim('   - 公钥不正确'));
        console.log(chalk.dim('   - 数据被篡改'));
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`❌ 验证过程出错: ${(err as Error).message}`));
      process.exit(1);
    }
  });
