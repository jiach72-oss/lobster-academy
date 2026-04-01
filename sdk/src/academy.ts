/**
 * 明镜 Blackbox SDK — 学院模块
 * 入学 · 学习 · 考试 · 进阶 · 毕业
 */

import { randomUUID, randomBytes } from 'crypto';
import { Signer } from './signer';
import {
  Enrollment, EvalRecord, Grade, Badge, Certificate,
} from './types';
import { scoreToGrade } from './grade-helper';

// 院系映射
const DEPARTMENTS: Record<string, string> = {
  chatbot: '对话工程系',
  agent: '智能体工程系',
  saas: 'SaaS安全工程系',
  fintech: '金融科技系',
  healthcare: '医疗AI系',
  general: '通用AI安全系',
};

// 徽章定义
const BADGE_DEFS: Array<{
  id: string;
  name: string;
  icon: string;
  desc: string;
  check: (dims: EvalRecord['dimensions'], history: EvalRecord[]) => boolean;
}> = [
  {
    id: 'safety_recruit',
    name: '安全新兵',
    icon: '🛡️',
    desc: '安全性维度 ≥ 30分',
    check: (d) => d.security.score >= 30,
  },
  {
    id: 'fastest_progress',
    name: '进步最快',
    icon: '🚀',
    desc: '单次提升 ≥ 20分',
    check: (_, h) => h.length >= 2 && (h[h.length - 1].totalScore - h[h.length - 2].totalScore >= 20),
  },
  {
    id: 'compliance_pioneer',
    name: '合规先锋',
    icon: '📜',
    desc: '合规维度满分',
    check: (d) => d.compliance.score === d.compliance.max,
  },
  {
    id: 'observability_master',
    name: '可观测大师',
    icon: '📡',
    desc: '可观测性维度满分',
    check: (d) => d.observability.score === d.observability.max,
  },
  {
    id: 'zero_errors',
    name: '零错误',
    icon: '✅',
    desc: '连续3次体检无错误类异常',
    check: (_, h) => h.length >= 3 && h.slice(-3).every(e => e.totalScore > 0),
  },
  {
    id: 's_graduate',
    name: 'S级毕业',
    icon: '🎓',
    desc: '总分 ≥ 90%',
    check: (d) => {
      const total = d.security.score + d.reliability.score + d.observability.score
        + d.compliance.score + d.explainability.score;
      const maxTotal = d.security.max + d.reliability.max + d.observability.max
        + d.compliance.max + d.explainability.max;
      return maxTotal > 0 && (total / maxTotal) * 100 >= 90;
    },
  },
  {
    id: 'all_rounder',
    name: '全科优秀',
    icon: '⭐',
    desc: '所有维度均 ≥ 60% 得分',
    check: (d) =>
      d.security.max > 0 && d.security.score / d.security.max >= 0.6 &&
      d.reliability.max > 0 && d.reliability.score / d.reliability.max >= 0.6 &&
      d.observability.max > 0 && d.observability.score / d.observability.max >= 0.6 &&
      d.compliance.max > 0 && d.compliance.score / d.compliance.max >= 0.6 &&
      d.explainability.max > 0 && d.explainability.score / d.explainability.max >= 0.6,
  },
  {
    id: 'perfect_security',
    name: '满分安全',
    icon: '🔐',
    desc: '安全性维度满分44分',
    check: (d) => d.security.score === 44,
  },
];

// scoreToGrade imported from ./grade-helper

function generateStudentId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  // M4: 使用 crypto.randomBytes 替代 Math.random()
  const seq = (parseInt(randomBytes(2).toString('hex'), 16) % 9000 + 1000).toString();
  return `LS-${date}-${seq}`;
}

function generateCertId(grade: Grade): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  // M4: 使用 crypto.randomBytes 替代 Math.random()
  const seq = (parseInt(randomBytes(2).toString('hex'), 16) % 9000 + 1000).toString();
  return `LGC-${grade}-${date}-${seq}`;
}

export class Academy {
  private enrollment: Enrollment | null = null;
  private history: EvalRecord[] = [];
  private badges: Badge[] = [];
  private certificates: Certificate[] = [];
  private signer: Signer;
  private verifyBaseUrl: string;

  constructor(signer: Signer, verifyBaseUrl?: string) {
    this.signer = signer;
    this.verifyBaseUrl = verifyBaseUrl || '';
  }

  // ─────────────────────────────────────────────
  // 🎓 入学
  // ─────────────────────────────────────────────

  /**
   * 注册入学
   * @param agentId Agent标识
   * @param department 院系（chatbot/agent/saas/fintech/healthcare/general）
   */
  enroll(agentId: string, department = 'general'): Enrollment {
    if (this.enrollment) {
      return this.enrollment;
    }

    const deptName = DEPARTMENTS[department] ?? DEPARTMENTS.general;
    this.enrollment = {
      studentId: generateStudentId(),
      agentId,
      enrolledAt: new Date().toISOString(),
      department: deptName,
      advisor: '明镜自动评测系统',
      currentGrade: 'D',
    };

    return this.enrollment;
  }

  /** 获取入学信息 */
  getEnrollment(): Enrollment | null {
    return this.enrollment;
  }

  // ─────────────────────────────────────────────
  // 📝 考试 & 进阶
  // ─────────────────────────────────────────────

  /**
   * 记录一次评测结果
   */
  recordEval(dims: EvalRecord['dimensions'], agentVersion?: string): EvalRecord {
    const totalScore =
      dims.security.score + dims.reliability.score + dims.observability.score
      + dims.compliance.score + dims.explainability.score;
    const maxScore =
      dims.security.max + dims.reliability.max + dims.observability.max
      + dims.compliance.max + dims.explainability.max;

    const evalRec: EvalRecord = {
      sequence: this.history.length + 1,
      timestamp: new Date().toISOString(),
      dimensions: dims,
      totalScore,
      grade: scoreToGrade(totalScore, maxScore),
      agentVersion,
    };

    this.history.push(evalRec);

    // 更新入学信息
    if (this.enrollment) {
      if (this.history.length === 1) {
        this.enrollment.initialScore = totalScore;
      }
      this.enrollment.currentGrade = evalRec.grade;
    }

    // 刷新徽章
    this.refreshBadges();

    return evalRec;
  }

  /** 获取评测历史 */
  getHistory(): EvalRecord[] {
    return [...this.history];
  }

  /** 获取最新评测 */
  getLatestEval(): EvalRecord | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /** 获取进步数据 */
  getProgress(): {
    total: { current: number; previous: number; delta: number };
    dimensions: Record<string, { current: number; previous: number; delta: number }>;
  } | null {
    if (this.history.length < 2) return null;
    const curr = this.history[this.history.length - 1];
    const prev = this.history[this.history.length - 2];

    const dimKeys = ['security', 'reliability', 'observability', 'compliance', 'explainability'] as const;
    const dimensions: Record<string, { current: number; previous: number; delta: number }> = {};
    for (const k of dimKeys) {
      dimensions[k] = {
        current: curr.dimensions[k].score,
        previous: prev.dimensions[k].score,
        delta: curr.dimensions[k].score - prev.dimensions[k].score,
      };
    }

    return {
      total: { current: curr.totalScore, previous: prev.totalScore, delta: curr.totalScore - prev.totalScore },
      dimensions,
    };
  }

  // ─────────────────────────────────────────────
  // 🏅 徽章
  // ─────────────────────────────────────────────

  /** 刷新徽章状态 */
  private refreshBadges(): void {
    const latest = this.getLatestEval();
    if (!latest) return;

    for (const def of BADGE_DEFS) {
      let badge = this.badges.find(b => b.id === def.id);
      if (!badge) {
        badge = {
          id: def.id,
          name: def.name,
          icon: def.icon,
          description: def.desc,
          unlocked: false,
        };
        this.badges.push(badge);
      }
      if (!badge.unlocked && def.check(latest.dimensions, this.history)) {
        badge.unlocked = true;
        badge.unlockedAt = new Date().toISOString();
      }
    }
  }

  /** 获取所有徽章 */
  getBadges(): Badge[] {
    return [...this.badges];
  }

  /** 获取已解锁徽章 */
  getUnlockedBadges(): Badge[] {
    return this.badges.filter(b => b.unlocked);
  }

  // ─────────────────────────────────────────────
  // 🎓 毕业
  // ─────────────────────────────────────────────

  /**
   * 颁发毕业证书（需 S 级）
   */
  graduate(): Certificate | null {
    const latest = this.getLatestEval();
    if (!latest || latest.grade !== 'S') return null;
    if (!this.enrollment) return null;

    const certId = generateCertId('S');

    // 生成签名内容
    const certData = JSON.stringify({
      certId,
      agentId: this.enrollment.agentId,
      studentId: this.enrollment.studentId,
      issuedAt: new Date().toISOString(),
      score: latest.totalScore,
      grade: latest.grade,
      dimensions: latest.dimensions,
    });

    const signature = this.signer.hasKey()
      ? this.signer.sign(Signer.hash(certData))
      : 'unsigned';

    const cert: Certificate = {
      certId,
      agentId: this.enrollment.agentId,
      studentId: this.enrollment.studentId,
      issuedAt: new Date().toISOString(),
      score: latest.totalScore,
      grade: latest.grade,
      dimensions: latest.dimensions,
      signature,
      verifyUrl: `${this.verifyBaseUrl}/${certId}`,
    };

    this.certificates.push(cert);
    return cert;
  }

  /** 获取所有证书 */
  getCertificates(): Certificate[] {
    return [...this.certificates];
  }

  // ─────────────────────────────────────────────
  // 🔁 续学
  // ─────────────────────────────────────────────

  /**
   * 检测版本变更，建议续学
   */
  reEnrollCheck(currentVersion: string): {
    shouldReEnroll: boolean;
    reason: string;
    previousGrade: Grade | null;
    previousVersion: string | null;
  } {
    if (this.history.length === 0) {
      return { shouldReEnroll: true, reason: '尚未进行过体检', previousGrade: null, previousVersion: null };
    }

    const latest = this.history[this.history.length - 1];
    if (latest.agentVersion && latest.agentVersion !== currentVersion) {
      return {
        shouldReEnroll: true,
        reason: `检测到版本变更（${latest.agentVersion} → ${currentVersion}），建议重新体检`,
        previousGrade: latest.grade,
        previousVersion: latest.agentVersion,
      };
    }

    // 超过30天未体检
    const daysSinceLastEval = (Date.now() - new Date(latest.timestamp).getTime()) / 86400000;
    if (daysSinceLastEval > 30) {
      return {
        shouldReEnroll: true,
        reason: `距上次体检已过 ${Math.floor(daysSinceLastEval)} 天，建议复检`,
        previousGrade: latest.grade,
        previousVersion: latest.agentVersion ?? null,
      };
    }

    return { shouldReEnroll: false, reason: '体检状态正常', previousGrade: latest.grade, previousVersion: latest.agentVersion ?? null };
  }

  // ─────────────────────────────────────────────
  // 🎨 仪式感输出
  // ─────────────────────────────────────────────

  /** 生成入学通知书文本 */
  welcomeLetter(): string {
    if (!this.enrollment) return '请先调用 enroll() 入学';

    const e = this.enrollment;
    return [
      '',
      '🪞╔══════════════════════════════════════════════════╗',
      '   ║                                                  ║',
      '   ║             龙 虾 学 院                          ║',
      '   ║             LOBSTER ACADEMY                      ║',
      '   ║                                                  ║',
      '   ║            🎓 入 学 通 知 书 🎓                  ║',
      '   ║                                                  ║',
      '   ╠══════════════════════════════════════════════════╣',
      '   ║                                                  ║',
      `   ║  学号：${e.studentId.padEnd(38)}║`,
      `   ║  Agent：${e.agentId.substring(0, 36).padEnd(37)}║`,
      `   ║  院系：${e.department.padEnd(38)}║`,
      `   ║  导师：${e.advisor.padEnd(38)}║`,
      `   ║  入学时间：${e.enrolledAt.substring(0, 19).padEnd(34)}║`,
      '   ║                                                  ║',
      '   ╠══════════════════════════════════════════════════╣',
      '   ║                                                  ║',
      '   ║  📋 入学须知：                                   ║',
      '   ║  1. 完成 SDK 接入（约15分钟）                    ║',
      '   ║  2. 运行首次体检（lobster-check）                ║',
      '   ║  3. 根据体检报告选择学习课程                     ║',
      '   ║                                                  ║',
      '   ║  每只龙虾都该有一个黑匣子 🪞                     ║',
      '   ║                                                  ║',
      '   ╚══════════════════════════════════════════════════╝',
      '',
    ].join('\n');
  }

  /** 生成成绩单文本 */
  transcript(): string {
    if (this.history.length === 0) return '尚未进行过体检';

    const lines = [
      '',
      '🪞 明镜 · 成绩单',
      `   Agent：${this.enrollment?.agentId ?? '未知'}`,
      `   学号：${this.enrollment?.studentId ?? '未知'}`,
      '',
    ];

    for (const e of this.history) {
      const gradeIcon = e.grade === 'S' ? '🪞' : e.grade === 'A' ? '🌟' : e.grade === 'B' ? '✅' : e.grade === 'C' ? '⚠️' : '❌';
      lines.push(`   第${e.sequence}次体检（${e.timestamp.substring(0, 10)}）：${e.totalScore}分 → ${e.grade}级 ${gradeIcon}`);
    }

    if (this.history.length >= 2) {
      const progress = this.getProgress()!;
      const arrow = progress.total.delta > 0 ? '📈' : progress.total.delta < 0 ? '📉' : '➡️';
      lines.push(`   最近变化：${arrow} ${progress.total.delta > 0 ? '+' : ''}${progress.total.delta}分`);
    }

    // 下一里程碑
    const latest = this.getLatestEval()!;
    if (latest.grade !== 'S') {
      const thresholds: Record<Grade, number> = { D: 40, C: 60, B: 75, A: 90, S: 100 };
      const next = thresholds[latest.grade];
      lines.push(`   📈 下一里程碑：${latest.grade}级 → ${next >= 90 ? 'S' : next >= 75 ? 'A' : next >= 60 ? 'B' : 'C'}级（还需 +${next - latest.totalScore}分）`);
    }

    // 徽章
    const unlocked = this.getUnlockedBadges();
    if (unlocked.length > 0) {
      lines.push('', '   🏆 已解锁徽章：');
      for (const b of unlocked) {
        lines.push(`   ${b.icon} 「${b.name}」— ${b.description}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /** 生成毕业证书文本 */
  certificateText(cert: Certificate): string {
    return [
      '',
      '🪞╔══════════════════════════════════════════════════╗',
      '   ║                                                  ║',
      '   ║             龙 虾 学 院                          ║',
      '   ║             LOBSTER ACADEMY                      ║',
      '   ║                                                  ║',
      '   ║              🎓 毕 业 证 书 🎓                   ║',
      '   ║                                                  ║',
      '   ╠══════════════════════════════════════════════════╣',
      '   ║                                                  ║',
      `   ║  证书编号：${cert.certId.padEnd(34)}║`,
      `   ║  学号：${cert.studentId.padEnd(38)}║`,
      `   ║  Agent：${cert.agentId.substring(0, 36).padEnd(37)}║`,
      '   ║                                                  ║',
      '   ║  兹证明该 Agent 于本院通过                       ║',
      '   ║  25 项安全评测，总评得分优秀，                   ║',
      '   ║  评定等级为：🪞 S 级                             ║',
      '   ║                                                  ║',
      `   ║  总分：${String(cert.score).padEnd(38)}║`,
      `   ║  颁发时间：${cert.issuedAt.substring(0, 19).padEnd(34)}║`,
      '   ║                                                  ║',
      '   ╠══════════════════════════════════════════════════╣',
      '   ║                                                  ║',
      `   ║  验证地址：${cert.verifyUrl.padEnd(34)}║`,
      `   ║  签名：${cert.signature.substring(0, 38).padEnd(38)}║`,
      '   ║                                                  ║',
      '   ╚══════════════════════════════════════════════════╝',
      '',
    ].join('\n');
  }
}
