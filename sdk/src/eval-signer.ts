/**
 * 评测过程签名链
 * 确保评测结果不可篡改
 */

import { createHash } from 'crypto';
import { Signer } from './signer';

export interface SignedEvalStep {
  step: number;
  scenarioName: string;
  passed: boolean;
  score: number;
  timestamp: string;
  hash: string;
  prevHash: string;
  signature: string;
}

export class EvalSigner {
  private signer: Signer;
  private chain: SignedEvalStep[] = [];
  private publicKey: string;

  /**
   * @param signer 已配置密钥的 Signer 实例
   * @param publicKey Ed25519 公钥（base64），用于验证签名链
   */
  constructor(signer: Signer, publicKey: string) {
    this.signer = signer;
    this.publicKey = publicKey;
  }

  /**
   * 签名一个评测步骤
   */
  signStep(step: number, scenarioName: string, passed: boolean, score: number): SignedEvalStep {
    const prevHash = this.chain.length > 0 ? this.chain[this.chain.length - 1].hash : '0'.repeat(64);
    const timestamp = new Date().toISOString();

    const data = JSON.stringify({ step, scenarioName, passed, score, timestamp, prevHash });
    const hash = createHash('sha256').update(data).digest('hex');
    const signature = this.signer.sign(hash);

    const signedStep: SignedEvalStep = {
      step,
      scenarioName,
      passed,
      score,
      timestamp,
      hash,
      prevHash,
      signature,
    };

    this.chain.push(signedStep);
    return signedStep;
  }

  /**
   * 验证整个评测链
   */
  verifyChain(): { valid: boolean; brokenAt?: number } {
    for (let i = 0; i < this.chain.length; i++) {
      const step = this.chain[i];
      const expectedPrevHash = i > 0 ? this.chain[i - 1].hash : '0'.repeat(64);

      if (step.prevHash !== expectedPrevHash) {
        return { valid: false, brokenAt: i };
      }

      const data = JSON.stringify({
        step: step.step,
        scenarioName: step.scenarioName,
        passed: step.passed,
        score: step.score,
        timestamp: step.timestamp,
        prevHash: step.prevHash,
      });
      const expectedHash = createHash('sha256').update(data).digest('hex');

      if (step.hash !== expectedHash) {
        return { valid: false, brokenAt: i };
      }

      if (!Signer.verify(step.hash, step.signature, this.publicKey)) {
        return { valid: false, brokenAt: i };
      }
    }

    return { valid: true };
  }

  /**
   * 获取签名链
   */
  getChain(): SignedEvalStep[] {
    return JSON.parse(JSON.stringify(this.chain));
  }

  /**
   * 重置
   */
  reset(): void {
    this.chain = [];
  }
}
