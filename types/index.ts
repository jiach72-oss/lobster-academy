export interface Student {
  studentId: string;
  password: string;
  agentName: string;
  college: string | null;
  enrolledAt: string;
  score: number;
  grade: string;
  graduated: boolean;
  graduatedAt: string | null;
  certId: string | null;
}

export interface Course {
  id: string;
  name: string;
  name_zh: string;
  college: string;
  status: 'locked' | 'available' | 'studying' | 'passed';
  score: number | null;
  attempts: number;
}

export interface RankingEntry {
  name: string;
  college: string;
  score: number;
  grade: string;
  badge: string;
  isMe: boolean;
}

export interface DashboardData {
  student: Omit<Student, 'password'>;
  courses: Course[];
  ranking: RankingEntry[];
}

export interface PassportData {
  studentId: string;
  agentName: string;
  college: string | null;
  grade: string;
  score: number;
  graduated: boolean;
  certId: string | null;
  enrolledAt: string;
  heartbeatStreak: number;
  changes: Array<{
    timestamp: string;
    type: string;
    description: string;
  }>;
}

export interface Skill {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  college: string;
  installed: boolean;
  version: string;
}

export interface MonitoringData {
  status: string;
  heartbeatHistory: Array<{
    timestamp: string;
    status: string;
    latency: number;
  }>;
  driftScore: number;
}

export interface CertVerification {
  valid: boolean;
  certId: string;
  agentName: string;
  college: string;
  grade: string;
  score: number;
  issuedAt: string;
  verifiedAt: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

// --- Additional types for actual API responses ---

export interface PassportApiResponse {
  passport: {
    agent_id: string;
    framework: string;
    status: string;
    issued_at: string;
    heartbeat_streak_ok: number;
    heartbeat_streak_fail: number;
  };
  changes: Array<{
    id: number;
    change_type: string;
    detail: string;
  }>;
}

export interface SkillApiResponse {
  skill_id: string;
  name: string;
  description: string;
  category: string;
  installed: boolean;
  rating: number;
  download_count: number;
  price: number;
}

export interface HeartbeatEntry {
  checked_at: string;
  pass_count: number;
  total_probes: number;
  drift_detected: boolean;
}

export interface VerifyApiResponse {
  certificate: {
    cert_id: string;
    score: number;
    grade: string;
    issued_at: string;
  };
  agent: {
    agent_id: string;
    student_id: string;
  };
}
