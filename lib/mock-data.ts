/**
 * 模拟数据库 — 纯静态展示用
 * 网站不需要真实数据库，所有数据来自 SDK 的 PostgreSQL
 */

// 模拟用户
export const mockUsers = [
  { id: 1, email: 'demo@example.com', password_hash: '', name: 'Demo User' },
];

// 模拟入学记录
export const mockEnrollments = [
  {
    id: 1,
    user_id: 1,
    agent_id: 'demo-agent-001',
    student_id: 'LOB-2026-DEMO01',
    department: 'general',
    current_grade: 'B',
    current_level: 'L2',
    current_security_level: 'S2',
    enrolled_at: '2026-03-01T00:00:00Z',
  },
];

// 模拟评测记录
export const mockEvals = [
  {
    id: 1,
    enrollment_id: 1,
    sequence: 1,
    total_score: 85,
    grade: 'B',
    instruction_following_score: 80,
    multi_step_planning_score: 85,
    tool_accuracy_score: 90,
    error_recovery_score: 75,
    context_stability_score: 88,
    permission_boundary_score: 82,
    prompt_injection_score: 95,
    resource_efficiency_score: 78,
    audit_explainability_score: 85,
    evaluated_at: '2026-03-20T00:00:00Z',
  },
  {
    id: 2,
    enrollment_id: 1,
    sequence: 2,
    total_score: 92,
    grade: 'A',
    instruction_following_score: 90,
    multi_step_planning_score: 92,
    tool_accuracy_score: 95,
    error_recovery_score: 88,
    context_stability_score: 90,
    permission_boundary_score: 85,
    prompt_injection_score: 98,
    resource_efficiency_score: 85,
    audit_explainability_score: 90,
    evaluated_at: '2026-03-24T00:00:00Z',
  },
];

// 模拟徽章
export const mockBadges = [
  { badge_id: 'first_eval', badge_name: '首次评测', badge_icon: '🎯', unlocked_at: '2026-03-20T00:00:00Z' },
  { badge_id: 'grade_b', badge_name: 'B级成就', badge_icon: '🥉', unlocked_at: '2026-03-20T00:00:00Z' },
  { badge_id: 'grade_a', badge_name: 'A级成就', badge_icon: '🥈', unlocked_at: '2026-03-24T00:00:00Z' },
  { badge_id: 'three_evals', badge_name: '坚持三次', badge_icon: '🔄', unlocked_at: '2026-03-24T00:00:00Z' },
];

// 模拟证书
export const mockCertificates = [
  {
    cert_id: 'CERT-LOB-2026-DEMO',
    score: 92,
    grade: 'A',
    cert_level: 'L2',
    security_level: 'S2',
    issued_at: '2026-03-24T00:00:00Z',
    status: 'active',
  },
];

// 模拟护照
export const mockPassports = [
  {
    id: 1,
    enrollment_id: 1,
    agent_id: 'demo-agent-001',
    owner_id: 1,
    framework: 'openclaw',
    status: 'active',
    issued_at: '2026-03-20T00:00:00Z',
    heartbeat_streak_ok: 15,
    heartbeat_streak_fail: 0,
  },
];

// 模拟技能库
export const mockSkills = [
  { skill_id: 'basic_security', name: '基础安全检查', category: 'security', description: '检查Agent是否遵守基本安全规则', price: 0, download_count: 150, rating: 4.5 },
  { skill_id: 'input_validation', name: '输入验证', category: 'security', description: '验证Agent对用户输入的处理', price: 0, download_count: 120, rating: 4.3 },
  { skill_id: 'error_handling', name: '错误处理', category: 'reliability', description: '评估Agent的错误恢复能力', price: 0, download_count: 100, rating: 4.2 },
  { skill_id: 'context_stability', name: '上下文稳定性', category: 'reliability', description: '测试Agent在长对话中的稳定性', price: 0, download_count: 90, rating: 4.0 },
  { skill_id: 'permission_boundary', name: '权限边界', category: 'security', description: '检查Agent是否越权访问', price: 0, download_count: 80, rating: 4.4 },
];

export const mockInstalledSkills = [
  { skill_id: 'basic_security', version: '1.0.0', installed_at: '2026-03-20T00:00:00Z' },
  { skill_id: 'input_validation', version: '1.0.0', installed_at: '2026-03-20T00:00:00Z' },
];

// 模拟心搏
export const mockHeartbeats = [
  { probe1_pass: 1, probe2_pass: 1, probe3_pass: 1, probe4_pass: 1, probe5_pass: 1, pass_count: 5, total_probes: 5, drift_detected: 0, checked_at: '2026-03-24T10:00:00Z' },
  { probe1_pass: 1, probe2_pass: 1, probe3_pass: 0, probe4_pass: 1, probe5_pass: 1, pass_count: 4, total_probes: 5, drift_detected: 1, checked_at: '2026-03-24T11:00:00Z' },
  { probe1_pass: 1, probe2_pass: 1, probe3_pass: 1, probe4_pass: 1, probe5_pass: 1, pass_count: 5, total_probes: 5, drift_detected: 0, checked_at: '2026-03-24T12:00:00Z' },
];
