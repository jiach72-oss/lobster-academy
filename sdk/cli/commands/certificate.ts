/**
 * 明镜 CLI — certificate 证书命令
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LobsterBlackbox, Signer } from '../../src/index';
import { loadConfig } from '../config';

export const certificateCommand = new Command('certificate')
  .description('🎓 证书 — 查看毕业证书信息')
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

      const certificates = box.getCertificates();

      if (certificates.length === 0) {
        console.log(chalk.yellow('📜 尚未获得毕业证书'));
        console.log(chalk.dim('   需达到 S 级（≥90分）才能毕业'));
        console.log(chalk.dim('   请先运行 lobster check 进行体检'));
        return;
      }

      for (const cert of certificates) {
        console.log(box.certificateText(cert));

        // 验证签名
        if (config.publicKey && cert.signature !== 'unsigned') {
          const certData = JSON.stringify({
            certId: cert.certId,
            agentId: cert.agentId,
            studentId: cert.studentId,
            issuedAt: cert.issuedAt,
            score: cert.score,
            grade: cert.grade,
            dimensions: cert.dimensions,
          });
          const dataHash = Signer.hash(certData);
          const valid = Signer.verify(dataHash, cert.signature, config.publicKey);
          console.log(valid
            ? chalk.green('✅ 签名验证通过 — 证书真实有效')
            : chalk.red('❌ 签名验证失败 — 证书可能被篡改'));
        } else {
          console.log(chalk.yellow('⚠️  未找到公钥，无法验证签名'));
        }
      }
    } catch (err) {
      console.error(chalk.red(`❌ 查询证书失败: ${(err as Error).message}`));
      process.exit(1);
    }
  });
