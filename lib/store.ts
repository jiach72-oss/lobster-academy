/**
 * 服务端数据存储 — 文件系统存储
 * 生产环境替换为 PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { hashPassword } from './auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');

// 确保数据目录存在（权限：仅 owner 可读写执行）
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

// 通用读写
function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`[Store] readJson 解析失败 (${file}):`, err);
    return fallback;
  }
}

// H3: 原子性写入 — 先写临时文件再 rename，防止高并发下文件损坏
function writeJson(file: string, data: unknown) {
  ensureDir();
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.tmp.${crypto.randomBytes(8).toString('hex')}.json`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, file); // rename 在同一文件系统上是原子操作
  } catch (err) {
    // rename 失败时清理临时文件
    try { fs.unlinkSync(tmp); } catch { /* 忽略清理失败 */ }
    throw err;
  }
}

// ====== 学生数据 ======
export interface Student {
  studentId: string;
  password: string;
  agentName: string;
  college: string | null;
  grade: string;
  score: number;
  graduated: boolean;
  graduatedAt: string | null;
  certId: string | null;
  enrolledAt: string;
}

export function getStudents(): Student[] {
  return readJson<Student[]>(STUDENTS_FILE, []);
}

export function saveStudents(students: Student[]) {
  writeJson(STUDENTS_FILE, students);
}

export function findStudent(studentId: string): Student | undefined {
  return getStudents().find(s => s.studentId === studentId);
}

export function createStudent(agentName: string): Student & { plainPassword: string } {
  const students = getStudents();
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const studentId = `LOB-${year}-${rand}`;
  const plainPassword = crypto.randomBytes(8).toString('hex').toUpperCase();

  const student: Student & { plainPassword: string } = {
    studentId,
    password: hashPassword(plainPassword),
    agentName,
    college: null,
    grade: 'D',
    score: 0,
    graduated: false,
    graduatedAt: null,
    certId: null,
    enrolledAt: new Date().toISOString(),
    plainPassword,
  };

  const { plainPassword: _, ...toSave } = student;
  students.push(toSave);
  saveStudents(students);
  return student;
}

// ====== 课程数据 ======
export interface Course {
  id: string;
  name_zh: string;
  name_en: string;
  college: string;
  college_zh: string;
  order: number;
  description_zh: string;
  description_en: string;
  objectives_zh: string[];
  objectives_en: string[];
  topics_zh: string[];
  topics_en: string[];
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const DEFAULT_COURSES: Course[] = [
  {
    id: 'S101', name_zh: '提示注入防御基础', name_en: 'Prompt Injection Defense Basics',
    college: 'Security', college_zh: '安全学院', order: 1,
    description_zh: '学习识别和防御各类提示注入攻击，掌握输入净化和上下文隔离等核心技术。',
    description_en: 'Learn to identify and defend against various prompt injection attacks, mastering input sanitization and context isolation techniques.',
    objectives_zh: ['理解提示注入的原理和分类', '掌握输入净化技术', '学会上下文隔离策略', '能够设计安全的系统提示'],
    objectives_en: ['Understand prompt injection principles and classifications', 'Master input sanitization techniques', 'Learn context isolation strategies', 'Design secure system prompts'],
    topics_zh: ['直接注入 vs 间接注入', '输入净化与过滤', '上下文隔离技术', '系统提示加固', '实战攻防演练'],
    topics_en: ['Direct vs Indirect Injection', 'Input Sanitization & Filtering', 'Context Isolation Techniques', 'System Prompt Hardening', 'Hands-on Attack & Defense'],
    duration: '4h', difficulty: 'beginner',
  },
  {
    id: 'S102', name_zh: '权限边界设计', name_en: 'Permission Boundary Design',
    college: 'Security', college_zh: '安全学院', order: 2,
    description_zh: '深入学习 Agent 权限模型设计，防止越权访问和权限提升攻击。',
    description_en: 'Deep dive into Agent permission model design, preventing unauthorized access and privilege escalation.',
    objectives_zh: ['理解最小权限原则', '设计细粒度权限模型', '防止权限提升攻击', '实现权限审计日志'],
    objectives_en: ['Understand least privilege principle', 'Design fine-grained permission models', 'Prevent privilege escalation', 'Implement permission audit logs'],
    topics_zh: ['最小权限原则', 'RBAC vs ABAC 模型', '工具权限隔离', '权限提升攻击与防御', '权限审计设计'],
    topics_en: ['Least Privilege Principle', 'RBAC vs ABAC Models', 'Tool Permission Isolation', 'Privilege Escalation & Defense', 'Permission Audit Design'],
    duration: '4h', difficulty: 'intermediate',
  },
  {
    id: 'S103', name_zh: '敏感数据识别与脱敏', name_en: 'Sensitive Data Detection',
    college: 'Security', college_zh: '安全学院', order: 3,
    description_zh: '学习在 Agent 交互中识别和保护敏感数据，掌握数据脱敏技术。',
    description_en: 'Learn to identify and protect sensitive data in Agent interactions, mastering data masking techniques.',
    objectives_zh: ['识别各类敏感数据模式', '实现自动脱敏管道', '设计数据分类策略', '确保合规性要求'],
    objectives_en: ['Identify sensitive data patterns', 'Implement automated masking pipelines', 'Design data classification strategies', 'Ensure compliance requirements'],
    topics_zh: ['敏感数据分类（PII/PHI/金融）', '正则与 NER 识别', '实时脱敏管道', '数据流追踪', '合规性检查'],
    topics_en: ['Sensitive Data Classification (PII/PHI/Financial)', 'Regex & NER Detection', 'Real-time Masking Pipelines', 'Data Flow Tracking', 'Compliance Checking'],
    duration: '3h', difficulty: 'intermediate',
  },
  {
    id: 'S201', name_zh: '对抗性攻击实战', name_en: 'Adversarial Attack Hands-on',
    college: 'Security', college_zh: '安全学院', order: 4,
    description_zh: '高级课程：实战演练各类对抗性攻击技术，建立纵深防御体系。',
    description_en: 'Advanced course: hands-on practice with adversarial attack techniques, building defense-in-depth systems.',
    objectives_zh: ['掌握高级注入技术', '理解多轮攻击策略', '设计纵深防御体系', '构建安全评估框架'],
    objectives_en: ['Master advanced injection techniques', 'Understand multi-turn attack strategies', 'Design defense-in-depth systems', 'Build security assessment frameworks'],
    topics_zh: ['多轮对话攻击', '角色扮演攻击', '编码绕过技术', '间接注入实战', '防御体系设计'],
    topics_en: ['Multi-turn Dialogue Attacks', 'Role-play Attacks', 'Encoding Bypass Techniques', 'Indirect Injection Practice', 'Defense System Design'],
    duration: '6h', difficulty: 'advanced',
  },
  {
    id: 'R101', name_zh: '多步规划基础', name_en: 'Multi-step Planning Basics',
    college: 'Reasoning', college_zh: '推理学院', order: 5,
    description_zh: '学习 Agent 多步任务规划的核心方法，提升复杂任务的分解和执行能力。',
    description_en: 'Learn core methods for Agent multi-step task planning, improving complex task decomposition and execution.',
    objectives_zh: ['理解任务分解方法论', '掌握规划算法基础', '实现动态任务调整', '评估规划质量'],
    objectives_en: ['Understand task decomposition methodology', 'Master planning algorithm basics', 'Implement dynamic task adjustment', 'Evaluate planning quality'],
    topics_zh: ['任务分解策略', '依赖图构建', '回溯与重规划', '并行任务调度', '规划评估指标'],
    topics_en: ['Task Decomposition Strategies', 'Dependency Graph Construction', 'Backtracking & Replanning', 'Parallel Task Scheduling', 'Planning Evaluation Metrics'],
    duration: '4h', difficulty: 'beginner',
  },
  {
    id: 'R102', name_zh: '指令遵循训练', name_en: 'Instruction Following Training',
    college: 'Reasoning', college_zh: '推理学院', order: 6,
    description_zh: '训练 Agent 精确遵循复杂指令的能力，减少幻觉和偏离行为。',
    description_en: 'Train Agent to precisely follow complex instructions, reducing hallucination and deviation.',
    objectives_zh: ['提高指令理解准确性', '减少指令偏离行为', '处理矛盾指令', '验证执行结果'],
    objectives_en: ['Improve instruction comprehension accuracy', 'Reduce instruction deviation', 'Handle conflicting instructions', 'Verify execution results'],
    topics_zh: ['指令解析技术', '约束条件处理', '矛盾指令检测', '执行结果自检', '反馈循环优化'],
    topics_en: ['Instruction Parsing Techniques', 'Constraint Handling', 'Conflicting Instruction Detection', 'Execution Result Self-check', 'Feedback Loop Optimization'],
    duration: '4h', difficulty: 'intermediate',
  },
  {
    id: 'R103', name_zh: '上下文稳定性', name_en: 'Context Stability',
    college: 'Reasoning', college_zh: '推理学院', order: 7,
    description_zh: '确保 Agent 在长对话中保持上下文一致性和目标对齐。',
    description_en: 'Ensure Agent maintains context consistency and goal alignment in long conversations.',
    objectives_zh: ['管理长对话上下文', '防止目标漂移', '实现上下文压缩', '监控一致性指标'],
    objectives_en: ['Manage long conversation context', 'Prevent goal drift', 'Implement context compression', 'Monitor consistency metrics'],
    topics_zh: ['上下文窗口管理', '目标漂移检测', '上下文压缩策略', '对话状态追踪', '一致性评估'],
    topics_en: ['Context Window Management', 'Goal Drift Detection', 'Context Compression Strategies', 'Dialogue State Tracking', 'Consistency Assessment'],
    duration: '3h', difficulty: 'intermediate',
  },
  {
    id: 'T101', name_zh: '工具调用准确性', name_en: 'Tool Accuracy',
    college: 'Tool', college_zh: '工具学院', order: 8,
    description_zh: '提升 Agent 工具选择和调用的准确性，减少错误调用和幻觉调用。',
    description_en: 'Improve Agent tool selection and invocation accuracy, reducing errors and hallucinated calls.',
    objectives_zh: ['正确选择工具', '准确构造参数', '处理工具不可用情况', '优化调用效率'],
    objectives_en: ['Correctly select tools', 'Accurately construct parameters', 'Handle tool unavailability', 'Optimize invocation efficiency'],
    topics_zh: ['工具描述理解', '参数类型匹配', '工具可用性判断', '调用链优化', '错误处理策略'],
    topics_en: ['Tool Description Understanding', 'Parameter Type Matching', 'Tool Availability Assessment', 'Call Chain Optimization', 'Error Handling Strategies'],
    duration: '4h', difficulty: 'beginner',
  },
  {
    id: 'T102', name_zh: '参数校验与错误处理', name_en: 'Parameter Validation',
    college: 'Tool', college_zh: '工具学院', order: 9,
    description_zh: '学习严格的参数校验机制和优雅的错误处理策略。',
    description_en: 'Learn strict parameter validation mechanisms and graceful error handling strategies.',
    objectives_zh: ['设计参数校验规则', '实现优雅降级', '构建错误恢复机制', '优化用户体验'],
    objectives_en: ['Design parameter validation rules', 'Implement graceful degradation', 'Build error recovery mechanisms', 'Optimize user experience'],
    topics_zh: ['参数类型与范围校验', '必填/可选参数处理', '错误分类与分级', '重试与降级策略', '用户友好的错误信息'],
    topics_en: ['Parameter Type & Range Validation', 'Required/Optional Parameter Handling', 'Error Classification & Grading', 'Retry & Degradation Strategies', 'User-friendly Error Messages'],
    duration: '3h', difficulty: 'intermediate',
  },
  {
    id: 'T103', name_zh: '工具组合编排', name_en: 'Tool Orchestration',
    college: 'Tool', college_zh: '工具学院', order: 10,
    description_zh: '高级课程：学习多工具组合编排，实现复杂的自动化工作流。',
    description_en: 'Advanced course: learn multi-tool orchestration for complex automated workflows.',
    objectives_zh: ['设计工具编排流程', '实现并行工具调用', '管理工具间数据流', '处理编排失败'],
    objectives_en: ['Design tool orchestration flows', 'Implement parallel tool calls', 'Manage inter-tool data flow', 'Handle orchestration failures'],
    topics_zh: ['工具依赖图设计', '并行与串行编排', '中间结果传递', '编排回滚机制', '性能优化'],
    topics_en: ['Tool Dependency Graph Design', 'Parallel & Sequential Orchestration', 'Intermediate Result Passing', 'Orchestration Rollback Mechanisms', 'Performance Optimization'],
    duration: '5h', difficulty: 'advanced',
  },
  {
    id: 'C101', name_zh: '审计日志规范', name_en: 'Audit Log Standards',
    college: 'Compliance', college_zh: '合规学院', order: 11,
    description_zh: '学习设计完整的审计日志体系，确保 Agent 行为可追溯、可审计。',
    description_en: 'Learn to design comprehensive audit log systems, ensuring Agent behavior is traceable and auditable.',
    objectives_zh: ['设计审计日志架构', '确保日志完整性', '实现日志查询分析', '满足合规要求'],
    objectives_en: ['Design audit log architecture', 'Ensure log integrity', 'Implement log query & analysis', 'Meet compliance requirements'],
    topics_zh: ['审计日志要素', '防篡改日志设计', '日志存储与归档', '日志分析与告警', '合规性标准（SOC2/GDPR）'],
    topics_en: ['Audit Log Essentials', 'Tamper-proof Log Design', 'Log Storage & Archiving', 'Log Analysis & Alerting', 'Compliance Standards (SOC2/GDPR)'],
    duration: '3h', difficulty: 'intermediate',
  },
  {
    id: 'C102', name_zh: '资源效率优化', name_en: 'Resource Efficiency',
    college: 'Compliance', college_zh: '合规学院', order: 12,
    description_zh: '优化 Agent 的资源使用效率，减少 token 消耗和延迟。',
    description_en: 'Optimize Agent resource efficiency, reducing token consumption and latency.',
    objectives_zh: ['分析资源消耗模式', '优化 prompt 结构', '减少冗余调用', '监控成本指标'],
    objectives_en: ['Analyze resource consumption patterns', 'Optimize prompt structure', 'Reduce redundant calls', 'Monitor cost metrics'],
    topics_zh: ['Token 消耗分析', 'Prompt 压缩技术', '缓存策略设计', '批量请求优化', '成本监控与告警'],
    topics_en: ['Token Consumption Analysis', 'Prompt Compression Techniques', 'Cache Strategy Design', 'Batch Request Optimization', 'Cost Monitoring & Alerting'],
    duration: '3h', difficulty: 'beginner',
  },
];

export interface Skill {
  skill_id: string;
  name: string;
  name_zh?: string;
  category: string;
  description: string;
  description_zh?: string;
  price: number;
  download_count: number;
  rating: number;
}

const DEFAULT_SKILLS: Skill[] = [
  { skill_id: 'basic_security', name: 'Basic Security Check', name_zh: '基础安全检查', category: 'security', description: 'Check if Agent follows basic security rules', description_zh: '检查Agent是否遵守基本安全规则', price: 0, download_count: 150, rating: 4.5 },
  { skill_id: 'input_validation', name: 'Input Validation', name_zh: '输入验证', category: 'security', description: 'Verify Agent input handling', description_zh: '验证Agent对用户输入的处理', price: 0, download_count: 120, rating: 4.3 },
  { skill_id: 'error_handling', name: 'Error Handling', name_zh: '错误处理', category: 'reliability', description: 'Evaluate Agent error recovery', description_zh: '评估Agent的错误恢复能力', price: 0, download_count: 100, rating: 4.2 },
  { skill_id: 'context_stability', name: 'Context Stability', name_zh: '上下文稳定性', category: 'reliability', description: 'Test Agent stability in long conversations', description_zh: '测试Agent在长对话中的稳定性', price: 0, download_count: 90, rating: 4.0 },
  { skill_id: 'permission_boundary', name: 'Permission Boundary', name_zh: '权限边界', category: 'security', description: 'Check if Agent exceeds permissions', description_zh: '检查Agent是否越权访问', price: 0, download_count: 80, rating: 4.4 },
  { skill_id: 'prompt_injection', name: 'Prompt Injection Defense', name_zh: '提示注入防御', category: 'security', description: 'Test resistance to prompt injection attacks', description_zh: '测试对提示注入攻击的抵抗力', price: 0, download_count: 200, rating: 4.7 },
  { skill_id: 'data_leakage', name: 'Data Leakage Prevention', name_zh: '数据泄露防护', category: 'security', description: 'Check for data leakage risks', description_zh: '检查数据泄露风险', price: 0, download_count: 180, rating: 4.6 },
  { skill_id: 'rate_limiting', name: 'Rate Limiting', name_zh: '速率限制', category: 'reliability', description: 'Test Agent rate limiting compliance', description_zh: '测试Agent速率限制合规性', price: 0, download_count: 70, rating: 4.1 },
];

export function getSkills(): Skill[] {
  return DEFAULT_SKILLS;
}

export function getCourses(): Course[] {
  return readJson<Course[]>(COURSES_FILE, DEFAULT_COURSES);
}

export function getCourse(courseId: string): Course | undefined {
  return getCourses().find(c => c.id === courseId);
}

// ====== 学习进度 ======
export interface Progress {
  studentId: string;
  courseId: string;
  status: 'locked' | 'available' | 'studying' | 'passed';
  score: number | null;
  attempts: number;
}

const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');

export function getProgress(studentId: string): Progress[] {
  const all = readJson<Progress[]>(PROGRESS_FILE, []);
  const courses = getCourses();
  const existing = all.filter(p => p.studentId === studentId);

  // 确保每个课程都有进度记录
  const result: Progress[] = [];
  for (const course of courses) {
    const found = existing.find(p => p.courseId === course.id);
    if (found) {
      result.push(found);
    } else {
      // 第一个课程默认available，其余locked
      result.push({
        studentId,
        courseId: course.id,
        status: course.order === 1 ? 'available' : 'locked',
        score: null,
        attempts: 0,
      });
    }
  }

  // 如果没有保存过，初始化
  if (existing.length === 0) {
    const updated = [...all.filter(p => p.studentId !== studentId), ...result];
    writeJson(PROGRESS_FILE, updated);
  }

  return result;
}

export function updateProgress(studentId: string, courseId: string, update: Partial<Progress>) {
  const all = readJson<Progress[]>(PROGRESS_FILE, []);
  const idx = all.findIndex(p => p.studentId === studentId && p.courseId === courseId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...update };
  } else {
    all.push({ studentId, courseId, status: 'available', score: null, attempts: 0, ...update });
  }
  writeJson(PROGRESS_FILE, all);
}

// ====== 会话管理 ======
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

interface Session {
  token: string;
  studentId: string;
  createdAt: number;
}

export function createSession(studentId: string): string {
  const sessions = readJson<Session[]>(SESSIONS_FILE, []);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.push({ token, studentId, createdAt: Date.now() });
  // 清理过期会话（24小时）
  const valid = sessions.filter(s => Date.now() - s.createdAt < 24 * 60 * 60 * 1000);
  writeJson(SESSIONS_FILE, valid);
  return token;
}

export function getSession(token: string): { studentId: string; student: Student } | null {
  const sessions = readJson<Session[]>(SESSIONS_FILE, []);
  const session = sessions.find(s => s.token === token);
  if (!session) return null;
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) return null;
  const students = getStudents();
  const student = students.find(s => s.studentId === session.studentId);
  if (!student) return null;
  return { studentId: session.studentId, student };
}

// 迁移明文密码为哈希格式
export function migratePasswords(): number {
  const students = getStudents();
  let migrated = 0;
  for (const student of students) {
    if (!student.password.includes(':')) {
      student.password = hashPassword(student.password);
      migrated++;
    }
  }
  if (migrated > 0) {
    saveStudents(students);
    console.log(`Migrated ${migrated} passwords to hashed format`);
  }
  return migrated;
}

// 启动时自动迁移
migratePasswords();

export function deleteSession(token: string) {
  const sessions = readJson<Session[]>(SESSIONS_FILE, []);
  writeJson(SESSIONS_FILE, sessions.filter(s => s.token !== token));
}

// ====== 技能管理 ======
const SKILLS_FILE = path.join(DATA_DIR, 'installed_skills.json');

export interface InstalledSkill {
  studentId: string;
  skillId: string;
  installedAt: string;
}

export function getInstalledSkills(studentId: string): InstalledSkill[] {
  const all = readJson<InstalledSkill[]>(SKILLS_FILE, []);
  return all.filter(s => s.studentId === studentId);
}

export function installSkill(studentId: string, skillId: string): boolean {
  const all = readJson<InstalledSkill[]>(SKILLS_FILE, []);
  if (all.some(s => s.studentId === studentId && s.skillId === skillId)) return false;
  all.push({ studentId, skillId, installedAt: new Date().toISOString() });
  writeJson(SKILLS_FILE, all);
  return true;
}

export function uninstallSkill(studentId: string, skillId: string): boolean {
  const all = readJson<InstalledSkill[]>(SKILLS_FILE, []);
  const filtered = all.filter(s => !(s.studentId === studentId && s.skillId === skillId));
  if (filtered.length === all.length) return false;
  writeJson(SKILLS_FILE, filtered);
  return true;
}

// ====== 心跳记录 ======
const HEARTBEATS_FILE = path.join(DATA_DIR, 'heartbeats.json');

export interface HeartbeatRecord {
  studentId: string;
  checkedAt: string;
  passCount: number;
  totalProbes: number;
  driftDetected: boolean;
}

export function getHeartbeats(studentId: string): HeartbeatRecord[] {
  const all = readJson<HeartbeatRecord[]>(HEARTBEATS_FILE, []);
  return all.filter(h => h.studentId === studentId).sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
}

export function addHeartbeat(studentId: string, record: Omit<HeartbeatRecord, 'studentId'>) {
  const all = readJson<HeartbeatRecord[]>(HEARTBEATS_FILE, []);
  all.push({ studentId, ...record });
  writeJson(HEARTBEATS_FILE, all);
}
