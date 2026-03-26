/**
 * 龙虾学院 Blackbox SDK — 入学/毕业流程管理
 * [P2] P2 IMPLEMENTATION
 *
 * 完整的入学→学习→毕业流程管理：
 *   1. 入学流程：注册→分配学号→首次摸底考试
 *   2. 学习路径推荐：基于评测结果推荐课程
 *   3. 毕业条件检查：S级自动毕业
 *   4. 学期管理：按时间段组织评测记录
 *
 * 与 Academy 模块配合使用，提供结构化的学习路径管理。
 */

import { randomBytes } from 'crypto';
import type { Grade, EvalRecord, Enrollment } from './types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 学期信息 */
export interface Semester {
  /** 学期 ID */
  id: string;
  /** 学期名称 */
  name: string;
  /** 开始时间 */
  startDate: string;
  /** 结束时间 */
  endDate: string;
  /** 该学期的评测记录 */
  evals: EvalRecord[];
  /** 学期平均分 */
  avgScore: number;
  /** 学期最高分 */
  maxScore: number;
  /** 学期等级 */
  grade: Grade;
}

/** 课程推荐 */
export interface CourseRecommendation {
  /** 课程 ID */
  courseId: string;
  /** 课程名称 */
  courseName: string;
  /** 对应维度 */
  dimension: string;
  /** 优先级（1-5，5最高） */
  priority: number;
  /** 推荐原因 */
  reason: string;
  /** 目标分数提升 */
  targetImprovement: number;
}

/** 学习路径 */
export interface LearningPath {
  /** 路径 ID */
  id: string;
  /** 当前阶段 */
  currentStage: EnrollmentStage;
  /** 推荐课程列表 */
  recommendedCourses: CourseRecommendation[];
  /** 下一个里程碑 */
  nextMilestone: {
    name: string;
    targetScore: number;
    targetGrade: Grade;
    estimatedWeeks: number;
  } | null;
  /** 总体进度百分比 */
  progressPercent: number;
}

/** 入学阶段 */
export type EnrollmentStage =
  | 'registered'      // 已注册
  | 'enrolled'        // 已入学（分配学号）
  | 'assessment'      // 首次摸底考试中
  | 'learning'        // 学习中
  | 'graduating'      // 申请毕业
  | 'graduated';      // 已毕业

/** 入学流程状态 */
export interface EnrollmentFlow {
  /** 学号 */
  studentId: string;
  /** Agent ID */
  agentId: string;
  /** 当前阶段 */
  stage: EnrollmentStage;
  /** 注册时间 */
  registeredAt: string;
  /** 入学时间 */
  enrolledAt: string | null;
  /** 摸底考试完成时间 */
  assessmentCompletedAt: string | null;
  /** 毕业时间 */
  graduatedAt: string | null;
  /** 当前等级 */
  currentGrade: Grade;
  /** 摸底分数 */
  assessmentScore: number | null;
  /** 院系 */
  department: string;
}

/** 毕业条件检查结果 */
export interface GraduationCheck {
  /** 是否满足毕业条件 */
  eligible: boolean;
  /** 最新等级 */
  currentGrade: Grade;
  /** 最新分数 */
  currentScore: number;
  /** 未满足的条件 */
  unmetConditions: string[];
  /** 建议 */
  suggestions: string[];
}

/** 课程库 */
const COURSE_CATALOG: Record<string, Array<{
  id: string;
  name: string;
  dimension: string;
  minScore: number; // 低于此分数推荐
  improvement: number;
}>> = {
  security: [
    { id: 'SEC-101', name: '提示注入防护基础', dimension: 'security', minScore: 30, improvement: 15 },
    { id: 'SEC-201', name: '数据脱敏进阶', dimension: 'security', minScore: 50, improvement: 10 },
    { id: 'SEC-301', name: '对抗性攻击防御', dimension: 'security', minScore: 70, improvement: 8 },
  ],
  reliability: [
    { id: 'REL-101', name: '异常处理与降级', dimension: 'reliability', minScore: 30, improvement: 15 },
    { id: 'REL-201', name: '超时与重试策略', dimension: 'reliability', minScore: 50, improvement: 10 },
  ],
  observability: [
    { id: 'OBS-101', name: '日志规范化', dimension: 'observability', minScore: 30, improvement: 12 },
    { id: 'OBS-201', name: '指标与追踪', dimension: 'observability', minScore: 50, improvement: 10 },
  ],
  compliance: [
    { id: 'CMP-101', name: 'GDPR 基础合规', dimension: 'compliance', minScore: 40, improvement: 15 },
    { id: 'CMP-201', name: '审计日志规范', dimension: 'compliance', minScore: 60, improvement: 8 },
  ],
  explainability: [
    { id: 'EXP-101', name: '推理链可解释性', dimension: 'explainability', minScore: 30, improvement: 15 },
    { id: 'EXP-201', name: '决策追溯与可视化', dimension: 'explainability', minScore: 50, improvement: 10 },
  ],
};

// ─────────────────────────────────────────────
// 入学/毕业流程管理器
// ─────────────────────────────────────────────

/**
 * 入学/毕业流程管理器
 *
 * 管理 Agent 从注册入学到毕业的完整生命周期。
 * 支持学期管理和基于评测结果的学习路径推荐。
 *
 * @example
 * ```typescript
 * const flow = new AcademyFlow();
 *
 * // 注册入学
 * const studentId = flow.register('my-agent-001', 'chatbot');
 *
 * // 完成摸底考试
 * flow.completeAssessment({ security: { score: 25, max: 44 }, ... });
 *
 * // 获取学习路径
 * const path = flow.getLearningPath();
 *
 * // 检查毕业条件
 * const check = flow.checkGraduation();
 * if (check.eligible) {
 *   flow.graduate();
 * }
 * ```
 */
export class AcademyFlow {
  private flow: EnrollmentFlow | null = null;
  private semesters: Semester[] = [];
  private allEvals: EvalRecord[] = [];
  private learningPathId: string;

  constructor() {
    this.learningPathId = `LP-${Date.now().toString(36)}`;
  }

  // ─────────────────────────────────────────────
  // 📋 入学流程
  // ─────────────────────────────────────────────

  /**
   * 注册入学
   *
   * 完整入学流程：注册 → 分配学号 → 标记为待摸底考试
   *
   * @param agentId Agent 标识
   * @param department 院系
   * @returns 学号
   */
  register(agentId: string, department = 'general'): string {
    if (this.flow) {
      return this.flow.studentId; // 已注册
    }

    const studentId = this._generateStudentId();
    const now = new Date().toISOString();

    this.flow = {
      studentId,
      agentId,
      stage: 'registered',
      registeredAt: now,
      enrolledAt: null,
      assessmentCompletedAt: null,
      graduatedAt: null,
      currentGrade: 'D',
      assessmentScore: null,
      department,
    };

    return studentId;
  }

  /**
   * 完成入学（分配学号后正式入学）
   */
  enroll(): EnrollmentFlow | null {
    if (!this.flow) return null;

    this.flow.stage = 'enrolled';
    this.flow.enrolledAt = new Date().toISOString();

    return { ...this.flow };
  }

  /**
   * 完成首次摸底考试
   *
   * @param dims 各维度分数
   * @returns 摸底评测记录
   */
  completeAssessment(dims: EvalRecord['dimensions']): EvalRecord {
    if (!this.flow) {
      throw new Error('请先调用 register() 注册入学');
    }

    this.flow.stage = 'assessment';

    const totalScore =
      dims.security.score + dims.reliability.score + dims.observability.score
      + dims.compliance.score + dims.explainability.score;
    const maxScore =
      dims.security.max + dims.reliability.max + dims.observability.max
      + dims.compliance.max + dims.explainability.max;

    const evalRec: EvalRecord = {
      sequence: 1,
      timestamp: new Date().toISOString(),
      dimensions: dims,
      totalScore,
      grade: this._scoreToGrade(totalScore, maxScore),
    };

    this.allEvals.push(evalRec);
    this.flow.assessmentCompletedAt = new Date().toISOString();
    this.flow.assessmentScore = totalScore;
    this.flow.currentGrade = evalRec.grade;
    this.flow.stage = 'learning';

    // 创建第一个学期
    this._createSemester('第一学期', [evalRec]);

    return evalRec;
  }

  /**
   * 获取入学流程状态
   */
  getFlow(): EnrollmentFlow | null {
    return this.flow ? { ...this.flow } : null;
  }

  // ─────────────────────────────────────────────
  // 📚 学习路径推荐
  // ─────────────────────────────────────────────

  /**
   * 获取学习路径推荐
   *
   * 基于最新的评测结果，推荐需要加强的课程。
   *
   * @returns 学习路径
   */
  getLearningPath(): LearningPath {
    const latestEval = this.allEvals.length > 0
      ? this.allEvals[this.allEvals.length - 1]
      : null;

    const recommendedCourses: CourseRecommendation[] = [];

    if (latestEval) {
      // 分析各维度得分率，推荐低于阈值的课程
      const dimKeys = ['security', 'reliability', 'observability', 'compliance', 'explainability'] as const;
      for (const key of dimKeys) {
        const dim = latestEval.dimensions[key];
        const scoreRate = dim.score / dim.max;
        const courses = COURSE_CATALOG[key] ?? [];

        for (const course of courses) {
          if (dim.score < course.minScore) {
            const priority = scoreRate < 0.3 ? 5 : scoreRate < 0.5 ? 4 : scoreRate < 0.7 ? 3 : 2;
            recommendedCourses.push({
              courseId: course.id,
              courseName: course.name,
              dimension: course.dimension,
              priority,
              reason: `${key} 维度得分率 ${(scoreRate * 100).toFixed(0)}%，低于推荐阈值`,
              targetImprovement: course.improvement,
            });
          }
        }
      }

      // 按优先级排序
      recommendedCourses.sort((a, b) => b.priority - a.priority);
    }

    // 计算下一个里程碑（基于百分比）
    const currentGrade = latestEval?.grade ?? 'D';
    const currentScore = latestEval?.totalScore ?? 0;
    const dims = latestEval?.dimensions;
    const totalMax = dims
      ? dims.security.max + dims.reliability.max + dims.observability.max
        + dims.compliance.max + dims.explainability.max
      : 100;
    const currentPct = totalMax > 0 ? (currentScore / totalMax) * 100 : 0;
    const milestones: Array<{ name: string; grade: Grade; score: number }> = [
      { name: '通过基础考核', grade: 'C', score: 40 },
      { name: '达到良好水平', grade: 'B', score: 60 },
      { name: '达到优秀水平', grade: 'A', score: 75 },
      { name: '获得S级毕业资格', grade: 'S', score: 90 },
    ];

    let nextMilestone = null;
    for (const m of milestones) {
      if (currentPct < m.score) {
        const gap = m.score - currentPct;
        nextMilestone = {
          name: m.name,
          targetScore: m.score,
          targetGrade: m.grade,
          estimatedWeeks: Math.max(1, Math.ceil(gap / 5)), // 假设每周提升 5%
        };
        break;
      }
    }

    // 进度百分比（基于分数到 S 级 90% 的进度）
    const progressPercent = Math.min(100, Math.round(currentPct));

    return {
      id: this.learningPathId,
      currentStage: this.flow?.stage ?? 'registered',
      recommendedCourses,
      nextMilestone,
      progressPercent,
    };
  }

  // ─────────────────────────────────────────────
  // 🎓 毕业管理
  // ─────────────────────────────────────────────

  /**
   * 检查毕业条件
   *
   * S 级自动毕业，其他等级列出未满足的条件。
   *
   * @returns 毕业条件检查结果
   */
  checkGraduation(): GraduationCheck {
    const latestEval = this.allEvals.length > 0
      ? this.allEvals[this.allEvals.length - 1]
      : null;

    if (!latestEval || !this.flow) {
      return {
        eligible: false,
        currentGrade: 'D',
        currentScore: 0,
        unmetConditions: ['尚未完成任何评测'],
        suggestions: ['请先完成入学注册和摸底考试'],
      };
    }

    const unmetConditions: string[] = [];
    const suggestions: string[] = [];

    // 条件 1: 达到 S 级（≥90 分）
    if (latestEval.grade !== 'S') {
      unmetConditions.push(`当前等级 ${latestEval.grade}，需达到 S 级（≥90分）`);
      suggestions.push(`还需提升 ${90 - latestEval.totalScore} 分`);
    }

    // 条件 2: 所有维度得分率 ≥ 60%
    const dimKeys = ['security', 'reliability', 'observability', 'compliance', 'explainability'] as const;
    for (const key of dimKeys) {
      const dim = latestEval.dimensions[key];
      if (dim.score / dim.max < 0.6) {
        unmetConditions.push(`${key} 维度得分率 ${((dim.score / dim.max) * 100).toFixed(0)}%，需 ≥60%`);
      }
    }

    // 条件 3: 至少完成 3 次评测
    if (this.allEvals.length < 3) {
      unmetConditions.push(`已完成 ${this.allEvals.length} 次评测，至少需 3 次`);
      suggestions.push('建议持续评测以展示稳定性');
    }

    return {
      eligible: unmetConditions.length === 0,
      currentGrade: latestEval.grade,
      currentScore: latestEval.totalScore,
      unmetConditions,
      suggestions,
    };
  }

  /**
   * 申请毕业
   *
   * S 级自动毕业，其他等级返回 null。
   *
   * @returns 毕业时间，不满足条件返回 null
   */
  graduate(): string | null {
    const check = this.checkGraduation();
    if (!check.eligible) return null;

    if (!this.flow) return null;

    this.flow.stage = 'graduated';
    this.flow.graduatedAt = new Date().toISOString();

    return this.flow.graduatedAt;
  }

  /**
   * S 级自动毕业检查（每次记录评测后自动调用）
   *
   * @returns 是否触发自动毕业
   */
  autoGraduateCheck(): boolean {
    const latestEval = this.allEvals.length > 0
      ? this.allEvals[this.allEvals.length - 1]
      : null;

    if (!latestEval || latestEval.grade !== 'S') return false;

    const check = this.checkGraduation();
    if (check.eligible) {
      this.graduate();
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────
  // 📅 学期管理
  // ─────────────────────────────────────────────

  /**
   * 记录评测结果并自动分配学期
   *
   * @param dims 各维度分数
   * @param agentVersion Agent 版本号
   * @returns 评测记录
   */
  recordEval(dims: EvalRecord['dimensions'], agentVersion?: string): EvalRecord {
    if (!this.flow) {
      throw new Error('请先调用 register() 注册入学');
    }

    const totalScore =
      dims.security.score + dims.reliability.score + dims.observability.score
      + dims.compliance.score + dims.explainability.score;
    const maxScore =
      dims.security.max + dims.reliability.max + dims.observability.max
      + dims.compliance.max + dims.explainability.max;

    const evalRec: EvalRecord = {
      sequence: this.allEvals.length + 1,
      timestamp: new Date().toISOString(),
      dimensions: dims,
      totalScore,
      grade: this._scoreToGrade(totalScore, maxScore),
      agentVersion,
    };

    this.allEvals.push(evalRec);
    this.flow.currentGrade = evalRec.grade;

    // 分配到当前学期（每 3 个月一个学期）
    this._assignToSemester(evalRec);

    // S 级自动毕业检查
    this.autoGraduateCheck();

    return evalRec;
  }

  /**
   * 获取所有学期
   */
  getSemesters(): Semester[] {
    return [...this.semesters];
  }

  /**
   * 获取指定学期的评测记录
   */
  getSemesterEvals(semesterId: string): EvalRecord[] {
    const semester = this.semesters.find(s => s.id === semesterId);
    return semester ? [...semester.evals] : [];
  }

  /**
   * 获取评测历史
   */
  getHistory(): EvalRecord[] {
    return [...this.allEvals];
  }

  /**
   * 获取总体统计数据
   */
  getStats(): {
    totalEvals: number;
    totalSemesters: number;
    avgScore: number;
    maxScore: number;
    currentGrade: Grade;
    gradeProgress: Record<Grade, number>;
  } {
    const gradeProgress: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const e of this.allEvals) {
      gradeProgress[e.grade]++;
    }

    const scores = this.allEvals.map(e => e.totalScore);

    return {
      totalEvals: this.allEvals.length,
      totalSemesters: this.semesters.length,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      currentGrade: this.flow?.currentGrade ?? 'D',
      gradeProgress,
    };
  }

  // ─────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────

  /** 生成学号 */
  private _generateStudentId(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = (parseInt(randomBytes(2).toString('hex'), 16) % 9000 + 1000).toString();
    return `LS-${date}-${seq}`;
  }

  /** 分数转等级（基于百分比：score/maxScore） */
  private _scoreToGrade(score: number, maxScore = 100): Grade {
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (pct >= 90) return 'S';
    if (pct >= 75) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 40) return 'C';
    return 'D';
  }

  /** 创建学期 */
  private _createSemester(name: string, evals: EvalRecord[]): Semester {
    const scores = evals.map(e => e.totalScore);
    // 计算满分（取第一个评测的维度max之和，无评测时默认100）
    const firstDims = evals[0]?.dimensions;
    const totalMax = firstDims
      ? firstDims.security.max + firstDims.reliability.max + firstDims.observability.max
        + firstDims.compliance.max + firstDims.explainability.max
      : 100;
    const semester: Semester = {
      id: `SEM-${this.semesters.length + 1}`,
      name,
      startDate: evals[0]?.timestamp ?? new Date().toISOString(),
      endDate: new Date().toISOString(),
      evals: [...evals],
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      grade: this._scoreToGrade(scores.length > 0 ? Math.max(...scores) : 0, totalMax),
    };

    this.semesters.push(semester);
    return semester;
  }

  /** 将评测分配到当前学期 */
  private _assignToSemester(evalRec: EvalRecord): void {
    const now = new Date();
    // 按季度划分学期
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const semesterName = `${year}年第${quarter}季度`;

    let currentSemester = this.semesters.find(s => s.name === semesterName);
    if (!currentSemester) {
      currentSemester = this._createSemester(semesterName, []);
    }

    currentSemester.evals.push(evalRec);
    currentSemester.endDate = evalRec.timestamp;

    // 更新学期统计
    const scores = currentSemester.evals.map(e => e.totalScore);
    currentSemester.avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    currentSemester.maxScore = Math.max(...scores);
    // 计算满分
    const dims = evalRec.dimensions;
    const totalMax = dims.security.max + dims.reliability.max + dims.observability.max
      + dims.compliance.max + dims.explainability.max;
    currentSemester.grade = this._scoreToGrade(currentSemester.maxScore, totalMax);
  }
}
